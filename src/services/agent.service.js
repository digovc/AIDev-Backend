const anthropicService = require('./anthropic.service');
const fs = require('fs').promises;
const listFilesTool = require("../tools/list-files.tool");
const listTasksTool = require("../tools/list-tasks.tool");
const messagesStore = require('../stores/messages.store');
const path = require('path');
const projectsStore = require('../stores/projects.store');
const promptParserService = require('./prompt-parser.service');
const readFileTool = require("../tools/read-file.tool");
const socketIOService = require("./socket-io.service");
const tasksStore = require('../stores/tasks.store');
const writeFileTool = require("../tools/write-file.tool");
const writeTaskTool = require("../tools/write-task.tool");

class AgentService {
  async sendMessage(conversation, cancelationToken, task) {
    const messages = await messagesStore.getByConversationId(conversation.id);

    await this.addReferences(conversation, task, messages);

    const assistantMessage = {
      id: `${ new Date().getTime() }`,
      conversationId: conversation.id,
      sender: 'assistant',
      blocks: [],
    };

    await messagesStore.create(assistantMessage);

    const tools = [
      listFilesTool,
      listTasksTool,
      readFileTool,
      writeFileTool,
      writeTaskTool
    ];

    const toolDefinitions = tools.map(tool => tool.getDefinition());
    await anthropicService.chatCompletion(messages, cancelationToken, toolDefinitions, (event) => this.receiveStream(conversation, cancelationToken, assistantMessage, tools, event));
  }

  async addReferences(conversation, task, messages) {
    if (conversation.taskId && !task) {
      task = await tasksStore.getById(conversation.taskId);
    }

    if (!task) {
      return;
    }

    if (!task.references || !task.references.length) {
      return;
    }

    const systemMessage = messages[0];

    if (systemMessage.sender !== 'user_system') {
      return;
    }

    const project = await projectsStore.getById(task.projectId);

    if (!project) {
      return;
    }

    for (const reference of task.references) {
      const file = reference.path;
      const extension = path.extname(file).replace('.', '');
      const absolutePath = path.join(project.path, file);
      const fileContent = await fs.readFile(absolutePath, 'utf8');

      const content = await promptParserService.parsePrompt('./assets/prompts/reference.md', {
        path: file,
        extension,
        content: fileContent
      });

      const block = { type: 'text', content };
      systemMessage.blocks.push(block);
    }
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
      blocks: [{ type: 'text', content: `Erro ao continuar a conversa: ${ error.message }` }]
    }
    await messagesStore.create(errorMessage);
  }

  async receiveStream(conversation, cancelationToken, assistantMessage, tools, event) {
    const type = event.type;

    switch (type) {
      case 'message_start':
        assistantMessage.inputTokens = event.inputTokens;
        break;
      case 'message_stop':
        await this.finishMessage(conversation, cancelationToken, assistantMessage, event);
        break;
      case 'block_start':
        return this.createBlock(assistantMessage, event);
      case 'block_delta':
        return this.appendBlockContent(assistantMessage, event.delta);
      case 'block_stop':
        return this.closeBlock(conversation, cancelationToken, assistantMessage, tools);
    }
  }

  async finishMessage(conversation, cancelationToken, assistantMessage, event) {
    await messagesStore.update(assistantMessage.id, assistantMessage);

    if (event.flow?.blocks?.every(block => block.type !== 'tool_use')) {
      cancelationToken.cancel();
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
    let result;

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

    await this.sendMessage(conversation, cancelationToken);
  }
}

module.exports = new AgentService();
