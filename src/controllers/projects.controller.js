const CrudControllerBase = require('./crud-controller.base');
const projectsStore = require('../stores/projects.store');

class ProjectsController extends CrudControllerBase {
  constructor() {
    super('projects', 'project', projectsStore);
  }
}

module.exports = new ProjectsController();
