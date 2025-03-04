const CrudServiceBase = require('./store.base');

class ProjectsService extends CrudServiceBase {
  constructor() {
    super('projects', 'project');
  }
}

module.exports = new ProjectsService();
