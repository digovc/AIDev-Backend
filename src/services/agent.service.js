class AgentService {
  async sendMessage(conversation, message) {
    console.log('Sending message:', message, 'to project:', {}, 'and conversation:', conversation);
  }
}

module.exports = new AgentService();
