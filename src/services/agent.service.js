const anthropicService = require('./anthropic.service');

class AgentService {
  async sendMessage(conversation, message) {
    const messages = conversation.messages.map(msg => ({ sender: msg.sender, content: msg.blocks.map(block => block.content).join(' ') }));
    const response = await anthropicService.chatCompletion(messages)
    console.log('Received response:', response);
  }
}

module.exports = new AgentService();
