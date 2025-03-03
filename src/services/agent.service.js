const anthropicService = require('./anthropic.service');
const socketIOService = require('./socket-io.service');
const conversationsService = require('./conversations.service');

class AgentService {
  async sendMessage(conversation, tools = []) {
    const newMessage = {
      id: `${ new Date().getTime() }`,
      sender: 'assistant',
      tempContent: '',
      blocks: [],
    };

    socketIOService.io.emit('message-created', { conversationId: conversation.id, message: newMessage });

    const messages = conversation.messages.map(msg => ({
      sender: msg.sender,
      content: msg.blocks.map(block => block.content).join(' ')
    }));

    const response = await anthropicService.chatCompletion(messages, tools, (event) => this.receiveStream(conversation, newMessage, tools, event));
    console.log('Received response:', response);
  }

  async receiveStream(conversation, newMessage, tools, event) {
    const type = event.type;

    switch (type) {
      case 'end':
        return this.saveNewMessage(conversation, newMessage);
      case 'delta':
        return this.sendToClient(conversation, newMessage, event.delta);
      case 'tool':
        return this.useTool(conversation, newMessage, tools, event);
    }
  }

  async saveNewMessage(conversation, newMessage, event) {
    newMessage.blocks.push({ type: 'text', content: newMessage.tempContent });
    delete newMessage.tempContent;
    conversation.messages.push(newMessage);
    await conversationsService.update(conversation.id, conversation);
  }

  sendToClient(conversation, newMessage, delta) {
    newMessage.tempContent += delta;

    socketIOService.io.emit('message-delta', {
      conversationId: conversation.id,
      messageId: newMessage.id,
      delta: delta,
    });
  }

  async useTool(conversation, newMessage, tools, event) {
    const tool = tools.find(tool => tool.name === event.tool);
    const result = await tool.callback(conversation, event.input);

  }
}

module.exports = new AgentService();
