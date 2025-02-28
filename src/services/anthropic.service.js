const { Anthropic } = require('@anthropic-ai/sdk');
require('dotenv').config();

class AnthropicService {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async chatCompletion(messages, streamCallback) {
    const formattedMessages = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    const stream = await this.anthropic.messages.create({
      messages: formattedMessages,
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 100,
      stream: true,
    });

    for await (const event of stream) {
      this.translateStreamEvent(event, streamCallback);
    }
  }

  translateStreamEvent(event, streamCallback) {
    const type = event.type;

    switch (type) {
      case 'content_block_start':
        return streamCallback({ type: 'start' });
      case 'content_block_stop':
        return streamCallback({ type: 'end' });
      case 'content_block_delta':
        return streamCallback({ type: 'delta', delta: event.delta.text });
    }
  }
}

module.exports = new AnthropicService();
