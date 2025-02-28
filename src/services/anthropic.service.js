const { Anthropic } = require('@anthropic-ai/sdk');
require('dotenv').config();

class AnthropicService {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async chatCompletion(messages, streamCallback) {
    const options = {
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 100,
      stream: true,
    };

    // Convert messages to Anthropic format if needed
    const formattedMessages = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    const stream = await this.anthropic.messages.create({
      messages: formattedMessages,
      ...options
    });

    for await (const event of stream) {
      streamCallback(event);
    }
  }
}

module.exports = new AnthropicService();
