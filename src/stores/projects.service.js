const CrudServiceBase = require('./crud-service.base');

class ProjectsService extends CrudServiceBase {
  constructor() {
    super('projects', 'project');
  }
}

module.exports = new ProjectsService();
