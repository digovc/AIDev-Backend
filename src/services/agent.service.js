const anthropicService = require('./anthropic.service');
const socketIOService = require('./socket-io.service');
const conversationsService = require('./conversations.service');

class AgentService {
  async sendMessage(conversation, tools = []) {
    const newMessage = {
      id: `${ new Date().getTime() }`,
      sender: 'assistant',
      blocks: [],
    };

    const messages = conversation.messages.map(msg => ({
      sender: msg.sender,
      content: msg.blocks.filter(x => x.type === 'text').map(block => block.content).join(' ')
    }));

    conversation.messages.push(newMessage);
    await this.saveNewMessage(conversation);
    socketIOService.io.emit('message-created', { conversationId: conversation.id, message: newMessage });

    const toolDefinitions = tools.map(tool => tool.getDefinition());
    await anthropicService.chatCompletion(messages, toolDefinitions, (event) => this.receiveStream(conversation, newMessage, tools, event));
  }

  async receiveStream(conversation, newMessage, tools, event) {
    console.log('Received event:', event);
    const type = event.type;

    switch (type) {
      case 'message_start':
        newMessage.inputTokens = event.inputTokens;
        break;
      case 'message_stop':
        return this.saveNewMessage(conversation, newMessage);
      case 'block_start':
        return this.createBlock(newMessage, event);
      case 'block_delta':
        return this.appendBlockContent(newMessage, event.delta);
      case 'block_stop':
        return this.closeBlock(conversation, newMessage, tools);
    }
  }

  async saveNewMessage(conversation) {
    await conversationsService.update(conversation.id, conversation);
  }

  async createBlock(newMessage, event) {
    const block = {
      type: event.blockType,
      id: event.id,
      tool: event.tool,
      content: ''
    };

    newMessage.blocks.push(block);
  }

  async appendBlockContent(newMessage, content) {
    const lastBlock = newMessage.blocks[newMessage.blocks.length - 1];
    lastBlock.content += content;
  }

  async closeBlock(conversation, newMessage, tools) {
    const lastBlock = newMessage.blocks[newMessage.blocks.length - 1];
    await this.saveNewMessage(conversation);

    if (lastBlock.type === 'tool_use') {
      await this.useTool(conversation, newMessage, tools, lastBlock);
    }
  }

  sendToClient(conversation, newMessage, delta) {
    socketIOService.io.emit('message-delta', {
      conversationId: conversation.id,
      messageId: newMessage.id,
      delta: delta,
    });
  }

  async useTool(conversation, newMessage, tools, block) {
    const tool = tools.find(tool => tool.getDefinition().name === block.tool);
    const input = JSON.parse(block.content || '{}');
    const result = await tool.executeTool(conversation, input);

    const toolResult = [{
      type: "tool_result",
      tool_use_id: block.id,
      content: result,
    }]

    const toolMessage = {
      id: `${ new Date().getTime() }`,
      sender: 'tool',
      blocks: [
        { type: 'text', content: JSON.stringify(toolResult) }
      ]
    };

    conversation.messages.push(toolMessage);
    await this.saveNewMessage(conversation);
    await this.sendMessage(conversation, tools);
  }
}

module.exports = new AgentService();
