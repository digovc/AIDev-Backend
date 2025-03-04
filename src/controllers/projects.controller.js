const CrudControllerBase = require('./crud-controller.base');
const projectsService = require('../stores/projects.service');

class ProjectsController extends CrudControllerBase {
  constructor() {
    super('projects', 'project', projectsService);
  }
}

module.exports = new ProjectsController();
