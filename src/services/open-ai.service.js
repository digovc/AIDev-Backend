const OpenAI = require('openai');

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async chatCompletion(messages, cancelationToken, tools, streamCallback) {
    if (cancelationToken.isCanceled()) {
      return;
    }

    const formattedMessages = this.getMessages(messages);

    const stream = await this.openai.chat.completions.create({
      messages: formattedMessages,
      model: 'gpt-4o',
      max_tokens: 4096,
      stream: true,
      tools: tools.length > 0 ? tools : undefined,
    });

    const messageFlow = { blocks: [] };

    for await (const chunk of stream) {
      if (cancelationToken.isCanceled()) {
        return stream.controller.abort();
      }

      this.translateStreamEvent(messageFlow, chunk, streamCallback);
    }
  }

  getMessages(messages) {
    const formattedMessages = []

    for (const message of messages) {
      if (!message.blocks?.length) {
        continue
      }

      switch (message.sender) {
        case 'system':
          formattedMessages.push({
            role: 'system',
            content: this.getTextContent(message.blocks)
          });
          break;
        case 'log':
          break;
        default:
          const formattedMessage = {
            role: this.getRole(message.sender),
            content: []
          };

          for (const block of message.blocks) {
            switch (block.type) {
              case 'text':
                formattedMessage.content.push({ type: 'text', text: block.content });
                break;
              case 'tool_use':
                // OpenAI doesn't have direct tool_use in messages, as it generates tool calls automatically
                break;
              case 'tool_result':
                formattedMessage.tool_call_id = block.toolUseId;
                formattedMessage.content = JSON.stringify(block.content);
                break;
            }
          }

          // If content is still an empty array, convert to string for simple text messages
          if (Array.isArray(formattedMessage.content) && formattedMessage.content.length === 0) {
            formattedMessage.content = '';
          } else if (Array.isArray(formattedMessage.content) && formattedMessage.content.length === 1 &&
            formattedMessage.content[0].type === 'text') {
            formattedMessage.content = formattedMessage.content[0].text;
          }

          formattedMessages.push(formattedMessage);
      }
    }

    return formattedMessages;
  }

  getTextContent(blocks) {
    return blocks.map(block => block.content).join('\n');
  }

  getRole(sender) {
    switch (sender) {
      case 'tool':
        return 'assistant';
      case 'user_system':
        return 'user';
      default:
        return sender;
    }
  }

  translateStreamEvent(messageFlow, chunk, streamCallback) {
    console.log('OpenAI chunk:', JSON.stringify(chunk, null, 2));

    // Handle message start
    this.handleMessageStart(messageFlow, chunk, streamCallback);

    const delta = chunk.choices[0].delta;

    // Handle tool calls
    if (delta.tool_calls) {
      this.handleToolCalls(messageFlow, chunk, delta.tool_calls, streamCallback);
    }

    // Handle regular text content
    if (delta.content) {
      this.handleTextContent(messageFlow, delta.content, streamCallback);
    }

    // Handle message completion
    if (chunk.choices[0].finish_reason) {
      this.handleMessageCompletion(messageFlow, streamCallback);
    }
  }

  handleMessageStart(messageFlow, chunk, streamCallback) {
    if (chunk.id && !messageFlow.id) {
      messageFlow.id = chunk.id;
      messageFlow.inputTokens = chunk.usage?.prompt_tokens || 0;
      streamCallback({ type: 'message_start', inputTokens: messageFlow.inputTokens });
    }
  }

  handleToolCalls(messageFlow, chunk, toolCalls, streamCallback) {
    for (const toolCall of toolCalls) {
      this.handleToolCallInitialization(messageFlow, toolCall, streamCallback);
      this.handleToolCallUpdate(messageFlow, toolCall, streamCallback);
      this.handleToolCallCompletion(messageFlow, chunk, toolCall, streamCallback);
    }
  }

  handleToolCallInitialization(messageFlow, toolCall, streamCallback) {
    // Tool call initialization with ID and function name
    if (toolCall.id && !messageFlow.toolCalls) {
      messageFlow.toolCalls = {};
    }

    // Initialize this specific tool call if it's new
    if (toolCall.id && !messageFlow.toolCalls[toolCall.id]) {
      messageFlow.toolCalls[toolCall.id] = {
        type: 'tool_use',
        tool: toolCall.function?.name || '',
        toolUseId: toolCall.id,
        content: '',
        isComplete: false
      };

      // Start a new block if this is the current active tool call
      if (!messageFlow.currentBlock) {
        messageFlow.currentBlock = messageFlow.toolCalls[toolCall.id];

        streamCallback({
          type: 'block_start',
          blockType: 'tool_use',
          tool: messageFlow.currentBlock.tool,
          toolUseId: messageFlow.currentBlock.toolUseId,
        });
      }
    }
  }

  handleToolCallUpdate(messageFlow, toolCall, streamCallback) {
    // Update tool name if it's provided in this chunk
    if (toolCall.function?.name && messageFlow.toolCalls[toolCall.id]) {
      messageFlow.toolCalls[toolCall.id].tool = toolCall.function.name;

      // Update current block tool name if this is the active tool call
      if (messageFlow.currentBlock && messageFlow.currentBlock.toolUseId === toolCall.id) {
        messageFlow.currentBlock.tool = toolCall.function.name;
      }
    }

    // Tool call arguments update - handle incrementally received chunks
    if (toolCall.function && 'arguments' in toolCall.function) {
      const argsDelta = toolCall.function.arguments || '';
      messageFlow.currentBlock.content += argsDelta;

      // Only send callback if there's actual delta content
      if (argsDelta) {
        streamCallback({
          type: 'block_delta',
          delta: argsDelta
        });
      }
    }
  }

  handleToolCallCompletion(messageFlow, chunk, toolCall, streamCallback) {
    // Tool call completion - finish_reason would be the proper way but we don't always get it
    // So we can treat a tool call as potentially complete when we receive a chunk containing its index
    const isToolCallFinished = chunk.choices[0].finish_reason === 'tool_calls';
    const isToolCallPotentiallyComplete = toolCall.index !== undefined &&
      messageFlow.currentBlock &&
      messageFlow.currentBlock.toolUseId === toolCall.id &&
      !messageFlow.currentBlock.isComplete;

    if (isToolCallFinished || isToolCallPotentiallyComplete) {
      messageFlow.toolCalls[toolCall.id].isComplete = true;

      // Only finalize if this is the current active block
      if (messageFlow.currentBlock && messageFlow.currentBlock.toolUseId === toolCall.id) {
        messageFlow.blocks.push(messageFlow.currentBlock);
        streamCallback({ type: 'block_stop' });
        messageFlow.currentBlock = null;
      }
    }
  }

  handleTextContent(messageFlow, content, streamCallback) {
    // Start a new text block if needed
    if (!messageFlow.currentBlock) {
      messageFlow.currentBlock = {
        type: 'text',
        id: new Date().getTime(),
        content: ''
      };
      streamCallback({ type: 'block_start', blockType: 'text' });
    }

    // Update the block content
    messageFlow.currentBlock.content += content;
    streamCallback({ type: 'block_delta', delta: content });
  }

  handleMessageCompletion(messageFlow, streamCallback) {
    // Close current block if there is one
    if (messageFlow.currentBlock) {
      messageFlow.blocks.push(messageFlow.currentBlock);
      streamCallback({ type: 'block_stop' });
      messageFlow.currentBlock = null;
    }

    // If there are any pending tool calls that were initialized but not completed
    // we should finalize them now
    if (messageFlow.toolCalls) {
      for (const toolId in messageFlow.toolCalls) {
        const toolCall = messageFlow.toolCalls[toolId];
        if (!toolCall.isComplete) {
          toolCall.isComplete = true;
          messageFlow.blocks.push(toolCall);
        }
      }
    }

    // Signal message completion
    streamCallback({ type: 'message_stop', flow: messageFlow });
  }
}

module.exports = new OpenAIService();
