const anthropicService = require('./anthropic.service');
const messagesStore = require('../stores/messages.store');
const socketIOService = require("./socket-io.service");

class AgentService {
  async sendMessage(conversation, tools = []) {
    const assistantMessage = {
      id: `${ new Date().getTime() }`,
      conversationId: conversation.id,
      sender: 'assistant',
      blocks: [],
    };

    const messagesFromConversation = await messagesStore.getByConversationId(conversation.id);

    const messages = messagesFromConversation.map(msg => ({
      sender: msg.sender,
      content: msg.blocks.filter(x => x.type === 'text').map(block => block.content).join(' ')
    }));

    await messagesStore.create(assistantMessage);
    const toolDefinitions = tools.map(tool => tool.getDefinition());
    await anthropicService.chatCompletion(messages, toolDefinitions, (event) => this.receiveStream(conversation, assistantMessage, tools, event));
  }

  async receiveStream(conversation, assistantMessage, tools, event) {
    const type = event.type;

    switch (type) {
      case 'message_start':
        assistantMessage.inputTokens = event.inputTokens;
        break;
      case 'message_stop':
        await messagesStore.update(assistantMessage.id, assistantMessage);
        break;
      case 'block_start':
        return this.createBlock(assistantMessage, event);
      case 'block_delta':
        return this.appendBlockContent(assistantMessage, event.delta);
      case 'block_stop':
        return this.closeBlock(conversation, assistantMessage, tools);
    }
  }

  async createBlock(assistantMessage, event) {
    const block = {
      id: event.id,
      messageId: assistantMessage.id,
      type: event.blockType,
      tool: event.tool,
      content: ''
    };

    assistantMessage.blocks.push(block);
    socketIOService.io.emit('block-created', block);
  }

  async appendBlockContent(assistantMessage, content) {
    const lastBlock = assistantMessage.blocks[assistantMessage.blocks.length - 1];
    lastBlock.content += content;
    socketIOService.io.emit('block-delta', content);
  }

  async closeBlock(conversation, assistantMessage, tools) {
    const lastBlock = assistantMessage.blocks[assistantMessage.blocks.length - 1];
    await messagesStore.update(assistantMessage.id, assistantMessage);

    if (lastBlock.type === 'tool_use') {
      await this.useTool(conversation, assistantMessage, tools, lastBlock);
    }
  }

  async useTool(conversation, assistantMessage, tools, block) {
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
      conversationId: conversation.id,
      sender: 'tool',
      blocks: [
        { type: 'text', content: JSON.stringify(toolResult) }
      ]
    };

    await messagesStore.create(toolMessage);
    await this.sendMessage(conversation, tools);
  }
}

module.exports = new AgentService();
