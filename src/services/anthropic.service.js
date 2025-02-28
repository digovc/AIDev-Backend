const { Anthropic } = require('@anthropic/sdk');
require('dotenv').config();

class AnthropicService {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async chatCompletion(messages, options = {}) {
    try {
      const defaultOptions = {
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 100
      };

      const mergedOptions = { ...defaultOptions, ...options };

      // Convert messages to Anthropic format if needed
      const formattedMessages = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      return await this.anthropic.messages.create({
        messages: formattedMessages,
        model: mergedOptions.model,
        max_tokens: mergedOptions.max_tokens,
        temperature: mergedOptions.temperature,
      });
    } catch (error) {
      console.error('Error in Anthropic chat completion:', error);
      throw error;
    }
  }
}

module.exports = new AnthropicService();
