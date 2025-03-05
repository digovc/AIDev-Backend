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

    const messages = await messagesStore.getByConversationId(conversation.id);

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
    try {
      await this.sendMessage(conversation, { isCanceled: () => false });
    } catch (e) {
      await this.logError(conversation, e);
    }
  }

  async logError(conversation, error) {
    const errorMessage = {
      id: new Date().getTime(),
      conversationId: conversation.id,
      sender: 'log',
      timestamp: new Date().toISOString(),
      blocks: [{ type: 'text', content: `Erro ao executar a tarefa: ${ error.message }` }]
    }

    await messagesStore.create(errorMessage);
    if (conversation.taskId) {
      socketIOService.io.emit('task-not-executing', conversation.taskId);
    }
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
      id: `${ new Date().getTime() }`,
      messageId: assistantMessage.id,
      type: event.blockType,
      tool: event.tool,
      toolUseId: event.toolUseId,
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

    if (lastBlock.type !== 'tool_use') {
      return;
    }

    if (!lastBlock.content || lastBlock.content === '') {
      lastBlock.content = '{}';
    }

    lastBlock.content = JSON.parse(lastBlock.content);
    await messagesStore.update(assistantMessage.id, assistantMessage);
    await this.useTool(conversation, cancelationToken, assistantMessage, tools, lastBlock);
  }

  async useTool(conversation, cancelationToken, assistantMessage, tools, block) {
    const tool = tools.find(tool => tool.getDefinition().name === block.tool);
    let result = {}

    try {
      result = await tool.executeTool(conversation, block.content);
    } catch (e) {
      result = { error: e.message }
    }

    const toolMessage = {
      id: `${ new Date().getTime() }`,
      conversationId: conversation.id,
      sender: 'tool',
      blocks: [
        { type: 'tool_result', toolUseId: block.toolUseId, content: result, isError: !!result.error }
      ]
    };

    await messagesStore.create(toolMessage);
    socketIOService.io.emit('task-executing', cancelationToken.taskId);
    await this.sendMessage(conversation, cancelationToken, tools);
  }
}

module.exports = new AgentService();
