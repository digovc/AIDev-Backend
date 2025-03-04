const CrudControllerBase = require('./crud-controller.base');
const tasksService = require('../services/tasks.service');
const taskRunnerService = require('../services/task-runner.service');

class TasksController extends CrudControllerBase {
  constructor() {
    super('tasks', 'task', tasksService);
  }

  registerEndpoints(router) {
    super.registerEndpoints(router);

    router.post(`/${ this.modelName }/run/:taskId`, (req, res) => {
      this.runTask(req, res).catch((e) => this.errorHandler(e, res));
    });
  }

  async runTask(req, res) {
    const taskId = req.params.taskId;

    if (!taskId) {
      return res.status(400).json({ success: false, message: 'Task ID is required' });
    }

    taskRunnerService.runTask(taskId).catch(console.error);
    res.json({ success: true, message: 'Running task' });
  }
}

module.exports = new TasksController();
