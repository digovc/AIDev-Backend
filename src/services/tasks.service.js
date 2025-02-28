const CrudServiceBase = require('./crud-service.base');

class TasksService extends CrudServiceBase {
  constructor() {
    super('tasks', 'task');
  }
}

module.exports = new TasksService();
