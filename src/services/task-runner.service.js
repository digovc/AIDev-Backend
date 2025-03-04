const promptParserService = require('./prompt-parser.service');
const tasksStore = require('../stores/tasks.store');
const agentService = require('./agent.service');
const conversationsStore = require('../stores/conversations.store');
const messagesStore = require('../stores/messages.store');
const projectsStore = require('../stores/projects.store');
const listFilesTool = require('../tools/list-files.tool');
const listTasksTool = require('../tools/list-tasks.tool');
const writeFileTool = require('../tools/write-file.tool');
const socketIOService = require("./socket-io.service");

class TaskRunnerService {
  executingTasks = [];
  cancelationTokens = []

  async runTask(taskId) {
    if (this.executingTasks.includes(taskId)) {
      return;
    }

    this.executingTasks.push(taskId);
    const cancelationToken = this.getCancelationToken(taskId);
    socketIOService.io.emit('task-executing', taskId);
    await this.tryRunTask(taskId, cancelationToken);
  }

  getCancelationToken(taskId) {
    const oldToken = this.cancelationTokens.find(t => t.taskId === taskId);

    if (oldToken) {
      oldToken.cancel = false;
      return oldToken;
    }

    const newToken = {
      taskId, cancel: false, isCanceled: () => {
        if (newToken.cancel) {
          socketIOService.io.emit('task-not-executing', newToken.taskId);
          this.executingTasks = this.executingTasks.filter(t => t !== newToken.taskId);
        }
        return newToken.cancel
      }
    };
    this.cancelationTokens.push(newToken);
    return newToken;
  }

  stopTask(taskId) {
    const cancelationToken = this.cancelationTokens.find(t => t.taskId === taskId);

    if (cancelationToken) {
      cancelationToken.cancel = true;
    }
  }

  async tryRunTask(taskId, cancelationToken) {
    console.log(`Running task ${ taskId }`);
    const task = await tasksStore.getById(taskId);
    task.status = 'running';
    await tasksStore.update(task.id, task);
    const conversation = await this.getTaksConversation(task);

    if (!conversation.messages.length) {
      await this.createSystemMessage(task, conversation);
    }

    const tools = [
      listFilesTool,
      listTasksTool,
      writeFileTool,
    ];

    try {
      await agentService.sendMessage(conversation, cancelationToken, tools);
    } catch (error) {
      await this.logError(task, conversation, error);
    }
  }

  async logError(task, conversation, error) {
    const errorMessage = {
      id: new Date().getTime(),
      conversationId: conversation.id,
      sender: 'log',
      timestamp: new Date().toISOString(),
      blocks: [{ type: 'text', content: `Erro ao executar a tarefa: ${ error.message }` }]
    }

    await messagesStore.create(errorMessage);
    socketIOService.io.emit('task-not-executing', task.id);
  }

  async getTaksConversation(task) {
    if (task.conversationId) {
      return await conversationsStore.getById(task.conversationId);
    } else {
      return this.createTaskConversation(task);
    }
  }

  async createTaskConversation(task) {
    const conversation = {
      projectId: task.projectId,
      taskId: task.id,
      messages: [],
    };

    const createdConversation = await conversationsStore.create(conversation);
    task.conversationId = createdConversation.id;
    await tasksStore.update(task.id, task);
    return createdConversation;
  }

  async createSystemMessage(task, conversation) {
    const project = await projectsStore.getById(task.projectId);
    const runTaskPrompt = './assets/prompts/run-task.md';
    const systemPrompt = await promptParserService.parsePrompt(runTaskPrompt, { project, task });
    const now = new Date();

    const systemMessage = {
      id: `${ now.getTime() }`,
      conversationId: conversation.id,
      sender: 'system',
      timestamp: now.toISOString(),
      blocks: [{ type: 'text', content: systemPrompt }]
    };

    await messagesStore.create(systemMessage);

    const userMEssage = {
      id: `${ now.getTime() + 1 }`,
      conversationId: conversation.id,
      sender: 'user_system',
      timestamp: now.toISOString(),
      blocks: [{ type: 'text', content: 'Execute a tarefa por favor' }]
    }

    await messagesStore.create(userMEssage);
  }
}

module.exports = new TaskRunnerService();
