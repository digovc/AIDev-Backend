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
    console.log('OpenAI chunk:', chunk);

    // Message start event
    if (chunk.id && !messageFlow.id) {
      messageFlow.id = chunk.id;
      messageFlow.inputTokens = chunk.usage?.prompt_tokens || 0;
      streamCallback({ type: 'message_start', inputTokens: messageFlow.inputTokens });
    }

    const delta = chunk.choices[0].delta;

    // Handle tool calls
    if (delta.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        // Tool call initialization
        if (toolCall.id && !messageFlow.currentBlock) {
          messageFlow.currentBlock = {
            type: 'tool_use',
            tool: toolCall.function?.name || '',
            toolUseId: toolCall.id,
            content: '',
          };

          streamCallback({
            type: 'block_start',
            blockType: 'tool_use',
            tool: messageFlow.currentBlock.tool,
            toolUseId: messageFlow.currentBlock.toolUseId,
          });
        }

        // Tool call content update
        if (toolCall.function?.arguments && messageFlow.currentBlock) {
          messageFlow.currentBlock.content += toolCall.function.arguments;
          streamCallback({
            type: 'block_delta',
            delta: toolCall.function.arguments
          });
        }

        // Tool call completion (may need adjustment based on OpenAI stream behavior)
        if (toolCall.index !== undefined && messageFlow.currentBlock && !delta.content) {
          messageFlow.blocks.push(messageFlow.currentBlock);
          streamCallback({ type: 'block_stop' });
          messageFlow.currentBlock = null;
        }
      }
    }

    // Handle regular text content
    if (delta.content) {
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
      messageFlow.currentBlock.content += delta.content;
      streamCallback({ type: 'block_delta', delta: delta.content });
    }

    // Message completion
    if (chunk.choices[0].finish_reason) {
      // Close current block if there is one
      if (messageFlow.currentBlock) {
        messageFlow.blocks.push(messageFlow.currentBlock);
        streamCallback({ type: 'block_stop' });
        messageFlow.currentBlock = null;
      }

      // Signal message completion
      streamCallback({ type: 'message_stop', flow: messageFlow });
    }
  }
}

module.exports = new OpenAIService();
