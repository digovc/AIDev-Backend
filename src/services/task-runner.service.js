const promptParserService = require('./prompt-parser.service');
const tasksService = require('./tasks.service');
const projectsService = require('./projects.service');

class TaskRunnerService {
  async runTask(taskId) {
    console.log(`Running task ${ taskId }`);
    const task = await tasksService.getById(taskId);
    const project = await projectsService.getById(task.projectId);
    const runTaskPrompt = './assets/prompts/run-task.md';
    const prompt = await promptParserService.parsePrompt(runTaskPrompt, { project, task });
    console.log(prompt);
  }
}

module.exports = new TaskRunnerService();
