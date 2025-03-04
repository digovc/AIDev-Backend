const { Anthropic } = require('@anthropic-ai/sdk');
require('dotenv').config();

class AnthropicService {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async chatCompletion(messages, tools, streamCallback) {
    const systemMessage = messages.find(msg => msg.sender === 'system')?.content;

    const formattedMessages = messages.filter(m => m.sender !== 'system').map(msg => ({
      role: this.getSender(msg.sender),
      content: msg.content
    }));

    const stream = await this.anthropic.messages.create({
      system: systemMessage,
      messages: formattedMessages,
      model: 'claude-3-5-haiku-latest',
      max_tokens: 4096,
      stream: true,
      tools: tools,
    });

    const messageFlow = { blocks: [] };

    for await (const event of stream) {
      this.translateStreamEvent(messageFlow, event, streamCallback);
    }
  }

  getSender(sender) {
    switch (sender) {
      case 'tool':
      case 'user_system':
        return 'user';
      default:
        return sender;
    }
  }

  translateStreamEvent(messageFlow, event, streamCallback) {
    const type = event.type;

    switch (type) {
      case 'message_start':
        messageFlow.inputTokens = event.message.usage.input_tokens;
        streamCallback({ type: 'message_start', inputTokens: messageFlow.inputTokens });
        break;
      case 'message_stop':
        streamCallback({ type: 'message_stop', flow: messageFlow });
        break;
      case 'content_block_start':
        switch (event.content_block.type) {
          case 'text':
            messageFlow.currentBlock = { type: event.content_block.type, id: new Date().getTime(), content: '' };
            streamCallback({ type: 'block_start', blockType: messageFlow.currentBlock.type });
            break
          case 'tool_use':
            messageFlow.currentBlock = {
              type: event.content_block.type,
              tool: event.content_block.name,
              id: event.content_block.id,
              content: '',
            };
            streamCallback({
              type: 'block_start',
              blockType: messageFlow.currentBlock.type,
              tool: messageFlow.currentBlock.tool,
              id: messageFlow.currentBlock.id,
              content: messageFlow.currentBlock.input,
            });
            break
        }
        break;
      case 'content_block_stop':
        messageFlow.blocks.push(messageFlow.currentBlock);
        messageFlow.currentBlock = null;
        streamCallback({ type: 'block_stop' });
        break;
      case 'content_block_delta':
        switch (event.delta.type) {
          case 'text_delta':
            messageFlow.currentBlock.content += event.delta.text;
            streamCallback({ type: 'block_delta', delta: event.delta.text });
            break;
          case 'input_json_delta':
            messageFlow.currentBlock.input += event.delta.partial_json;
            streamCallback({ type: 'block_delta', delta: event.delta.partial_json });
            break;
        }
        break;
    }
  }
}

module.exports = new AnthropicService();
