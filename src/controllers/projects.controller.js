const CrudControllerBase = require('./crud-controller.base');
const projectsService = require('../stores/projects.store');

class ProjectsController extends CrudControllerBase {
  constructor() {
    super('projects', 'project', projectsService);
  }
}

module.exports = new ProjectsController();
