const CrudServiceBase = require('./crud-service.base');
const projectsService = require("./projects.service");

class ProjectsService extends CrudServiceBase {
  constructor() {
    super('projects', 'project');
  }

  async prepareBeforeSave(itemData) {
    await super.prepareBeforeSave(itemData);
    const project = await projectsService.getById(itemData.projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    project.tasks = project.tasks || [];
    project.tasks.push(itemData.id);

    await projectsService.update(project.id, project);
  }
}

module.exports = new ProjectsService();
