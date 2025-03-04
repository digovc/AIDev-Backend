const CrudServiceBase = require('./store.base');

class ProjectsStore extends CrudServiceBase {
  constructor() {
    super('projects', 'project');
  }
}

module.exports = new ProjectsStore();
