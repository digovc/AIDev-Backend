const CrudControllerBase = require('./crud-controller.base');
const tasksService = require('../services/tasks.service');

class TasksController extends CrudControllerBase {
  constructor() {
    super('tasks', 'task', tasksService);
  }
}

module.exports = new TasksController();
