const CrudControllerBase = require('./crud-controller.base');

class ProjectsController extends CrudControllerBase {
  constructor() {
    super('projects', 'project');
  }
}

module.exports = new ProjectsController();
