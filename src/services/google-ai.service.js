const settingsStore = require('../stores/settings.store');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GoogleAIService {
  async chatCompletion(model, messages, cancelationToken, tools, streamCallback) {
    if (cancelationToken.isCanceled()) {
      return;
    }

    const formattedMessages = this.getMessages(messages);
    const settings = await settingsStore.getSettings();
    const apiKey = settings.google.apiKey;

    if (!apiKey) {
      throw new Error('API key is required');
    }

    const googleAI = new GoogleGenerativeAI(apiKey);
    const googleModel = googleAI.getGenerativeModel({ model: model });

    const stream = await googleModel.generateContentStream({
      contents: formattedMessages,
      tools: tools,
    });

    const currentBlock = {}

    for await (const chunk of stream) {
      if (cancelationToken.isCanceled()) {
        return stream.stream.throw(new Error('Canceled'));
      }

      this.translateStreamEvent(chunk, currentBlock, streamCallback);
    }
  }

  translateStreamEvent(chunk, currentBlock, streamCallback) {
    if (chunk.choices.length === 0) return;
    const choice = chunk.choices[0];
    const delta = choice.delta;

    if (delta.role === 'assistant') {
      currentBlock.type = delta.tool_calls ? 'tool_use' : 'text';
      streamCallback({ type: 'message_start', inputTokens: 0 });

      if (currentBlock.type === 'tool_use') {
        const toolCall = delta.tool_calls[0];
        currentBlock.toolUseId = toolCall.id;

        streamCallback({
          type: 'block_start',
          blockType: 'tool_use',
          tool: toolCall.function.name,
          toolUseId: toolCall.id,
          content: toolCall.function.arguments,
        });
      } else {
        currentBlock.toolUseId = undefined;
        streamCallback({ type: 'block_start', blockType: 'text' });
      }
    } else if (choice.finish_reason) {
      streamCallback({ type: 'message_stop' });
    } else if (currentBlock.type === 'tool_use' && delta.tool_calls) {
      const toolCall = delta.tool_calls[0];
      streamCallback({ type: 'block_delta', delta: toolCall.function.arguments });
    } else if (delta.tool_calls && delta.tool_calls[0].id !== currentBlock.toolUseId) {
      const toolCall = delta.tool_calls[0];
      currentBlock.type = 'tool_use';
      currentBlock.toolUseId = toolCall.id;
      streamCallback({ type: 'block_stop' });

      streamCallback({
        type: 'block_start',
        blockType: 'tool_use',
        tool: toolCall.function.name,
        toolUseId: toolCall.id,
        content: toolCall.function.arguments,
      });
    } else if (currentBlock.type === 'text' && delta.content) {
      streamCallback({ type: 'block_delta', delta: delta.content });
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
                const toolCall = {
                  id: block.toolUseId,
                  type: 'function',
                  function: { name: block.tool, arguments: block.content }
                }

                delete formattedMessage.content;
                formattedMessage.tool_calls = [toolCall];
                break;
              case 'tool_result':
                formattedMessage.role = 'tool';
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
        return 'toll';
      case 'user_system':
        return 'user';
      default:
        return sender;
    }
  }

  setBaseURL(baseURL) {
    this.baseURL = baseURL;
  }
}

module.exports = new GoogleAIService();
