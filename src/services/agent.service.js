const anthropicService = require('./anthropic.service');
const messagesStore = require('../stores/messages.store');
const socketIOService = require("./socket-io.service");
const listFilesTool = require("../tools/list-files.tool");
const listTasksTool = require("../tools/list-tasks.tool");
const writeFileTool = require("../tools/write-file.tool");

class AgentService {
  async sendMessage(conversation, cancelationToken) {
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

    const tools = [
      listFilesTool,
      listTasksTool,
      writeFileTool,
    ];

    await messagesStore.create(assistantMessage);
    const toolDefinitions = tools.map(tool => tool.getDefinition());
    await anthropicService.chatCompletion(messages, cancelationToken, toolDefinitions, (event) => this.receiveStream(conversation, cancelationToken, assistantMessage, tools, event));
  }

  async continueConversation(conversation) {
    await this.sendMessage(conversation, {});
  }

  async receiveStream(conversation, cancelationToken, assistantMessage, tools, event) {
    const type = event.type;

    switch (type) {
      case 'message_start':
        assistantMessage.inputTokens = event.inputTokens;
        break;
      case 'message_stop':
        await messagesStore.update(assistantMessage.id, assistantMessage);
        socketIOService.io.emit('task-not-executing', cancelationToken.taskId);
        break;
      case 'block_start':
        return this.createBlock(assistantMessage, event);
      case 'block_delta':
        return this.appendBlockContent(assistantMessage, event.delta);
      case 'block_stop':
        return this.closeBlock(conversation, cancelationToken, assistantMessage, tools);
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

    socketIOService.io.emit('block-delta', {
      id: lastBlock.id,
      messageId: lastBlock.messageId,
      delta: content
    });
  }

  async closeBlock(conversation, cancelationToken, assistantMessage, tools) {
    const lastBlock = assistantMessage.blocks[assistantMessage.blocks.length - 1];
    await messagesStore.update(assistantMessage.id, assistantMessage);

    if (lastBlock.type === 'tool_use') {
      await this.useTool(conversation, cancelationToken, assistantMessage, tools, lastBlock);
    }
  }

  async useTool(conversation, cancelationToken, assistantMessage, tools, block) {
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
    socketIOService.io.emit('task-executing', cancelationToken.taskId);
    await this.sendMessage(conversation, cancelationToken, tools);
  }
}

module.exports = new AgentService();
