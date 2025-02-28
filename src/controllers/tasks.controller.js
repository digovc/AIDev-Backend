const CrudControllerBase = require('./crud-controller.base');
const tasksService = require('../services/tasks.service');

class TasksController extends CrudControllerBase {
  constructor() {
    super('tasks', 'task', tasksService);
  }

  registerEndpoints(router) {
    super.registerEndpoints(router);

    router.get(`/${ this.modelName }/by-project/:projectId`, (req, res) => {
      this.getByProjectId(req, res).catch((e) => this.errorHandler(e, res));
    });
  }

  async getByProjectId(req, res) {
    const projectId = req.params.projectId;
    const conversations = await this.service.findByProjectId(projectId);
    res.json(conversations);
  }
}

module.exports = new TasksController();
