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
      role: msg.sender,
      content: msg.content
    }));

    const stream = await this.anthropic.messages.create({
      system: systemMessage,
      messages: formattedMessages,
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 100,
      stream: true,
      tools: tools,
    });

    for await (const event of stream) {
      this.translateStreamEvent(event, streamCallback);
    }
  }

  translateStreamEvent(event, streamCallback, tools) {
    console.log('Received event:', event);
    const type = event.type;

    switch (type) {
      case 'content_block_start':
        return streamCallback({ type: 'start' });
      case 'content_block_stop':
        return streamCallback({ type: 'end' });
      case 'content_block_delta':
        return streamCallback({ type: 'delta', delta: event.delta.text });
      case 'tool_use':
        return streamCallback({ type: 'tool', tool: event.name, id: event.id, input: event.input });
    }
  }
}

module.exports = new AnthropicService();
