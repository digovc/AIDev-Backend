const anthropicService = require('./anthropic.service');
const socketIOService = require('./socket-io.service');

class AgentService {
  async sendMessage(conversation) {
    const newMessage = {
      id: `${ new Date().getTime() }`,
      sender: 'assistant',
      blocks: [],
      streamEvents: [],
    };

    socketIOService.getIO().emit('message-created', { conversationId: conversation.id, message: newMessage });

    const messages = conversation.messages.map(msg => ({
      sender: msg.sender,
      content: msg.blocks.map(block => block.content).join(' ')
    }));

    const response = await anthropicService.chatCompletion(messages, (event) => this.receiveStream(conversation, newMessage, event));
    console.log('Received response:', response);
  }

  async receiveStream(conversation, newMessage, event) {
    console.log('Received event:', event);
    newMessage.streamEvents.push(event);

    socketIOService.getIO().emit('message-stream', {
      conversationId: conversation.id,
      messageId: newMessage.id,
      event
    });
  }
}

module.exports = new AgentService();
