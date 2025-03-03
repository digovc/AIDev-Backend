const promptParserService = require('./prompt-parser.service');
const tasksService = require('./tasks.service');
const agentService = require('./agent.service');
const conversationsService = require('./conversations.service');
const projectsService = require('./projects.service');
const listFilesTool = require('../../assets/jsons/list-files-tool.json');
const listTasksTool = require('../../assets/jsons/list-tasks-tool.json');
const writeFileTool = require('../../assets/jsons/write-file-tool.json');

class TaskRunnerService {
  async runTask(taskId) {
    console.log(`Running task ${ taskId }`);
    const task = await tasksService.getById(taskId);
    const conversation = await this.getTaksConversation(task);

    if (!conversation.messages.length) {
      await this.createSystemMessage(task, conversation);
    }

    const tools = [
      listFilesTool,
      listTasksTool,
      writeFileTool,
    ];

    await agentService.sendMessage(conversation, tools);
  }

  async getTaksConversation(task) {
    if (task.conversationId) {
      return await conversationsService.getById(task.conversationId);
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

    const createdConversation = await conversationsService.create(conversation);
    task.conversationId = createdConversation.id;
    await tasksService.update(task.id, task);
    return createdConversation;
  }

  async createSystemMessage(task, conversation) {
    const project = await projectsService.getById(task.projectId);
    const runTaskPrompt = './assets/prompts/run-task.md';
    const systemPrompt = await promptParserService.parsePrompt(runTaskPrompt, { project, task });
    const now = new Date();

    const systemMessage = {
      id: `${ now.getTime() }`,
      sender: 'system',
      timestamp: now.toISOString(),
      blocks: [{ type: 'text', content: systemPrompt }]
    };

    conversation.messages.push(systemMessage);

    const userMEssage = {
      id: `${ now.getTime() + 1 }`,
      sender: 'user',
      timestamp: now.toISOString(),
      blocks: [{ type: 'text', content: 'Execute a tarefa por favor' }]
    }

    conversation.messages.push(userMEssage);

    await conversationsService.update(conversation.id, conversation);
  }
}

module.exports = new TaskRunnerService();
