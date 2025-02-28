const CrudServiceBase = require('./crud-service.base');
const projectsService = require("./projects.service");

class TasksService extends CrudServiceBase {
  constructor() {
    super('tasks', 'task');
  }

  async prepareBeforeSave(itemData) {
    await super.prepareBeforeSave(itemData);
    const project = await projectsService.getById(itemData.projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    project.tasks = project.tasks || [];

    if (!project.tasks.includes(itemData.id)) {
      project.tasks.push(itemData.id);
    }

    await projectsService.update(project.id, project);
  }

  async findByProjectId(projectId) {
    // First, get the project
    const project = await projectsService.getById(projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    // If the project has no tasks, return empty array
    if (!project.tasks || project.tasks.length === 0) {
      return [];
    }

    // Get all tasks referenced in the project
    const tasks = [];

    for (const taskId of project.tasks) {
      const task = await this.getById(taskId);
      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  }
}

module.exports = new TasksService();
