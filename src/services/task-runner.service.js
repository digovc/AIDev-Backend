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
    try {
      if (this.executingTasks.includes(taskId)) {
        return;
      }

      this.executingTasks.push(taskId);
      const cancelationToken = { taskId, cancel: false };
      this.cancelationTokens.push(cancelationToken);
      socketIOService.io.emit('task-executing', taskId);
      await this.tryRunTask(taskId, cancelationToken);
    } finally {
      this.executingTasks = this.executingTasks.filter(t => t !== taskId);
      this.cancelationTokens = this.cancelationTokens.filter(t => t.taskId !== taskId);
      socketIOService.io.emit('task-not-executing', taskId);
    }
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

    await agentService.sendMessage(conversation, cancelationToken, tools);
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
