const CrudServiceBase = require('./crud-service.base');
const projectsService = require("./projects.service");

class TasksService extends CrudServiceBase {
  constructor() {
    super('tasks', 'task');
  }

  async prepareBeforeSave(task) {
    await super.prepareBeforeSave(task);
    const project = await projectsService.getById(task.projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    project.tasks = project.tasks || [];

    if (!project.tasks.includes(task.id)) {
      project.tasks.push(task.id);
      await projectsService.update(project.id, project);
    }
  }

  async getByProjectId(projectId) {
    const project = await projectsService.getById(projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    const tasks = []

    for (const taskId of project.tasks ?? []) {
      const task = await this.getById(taskId);
      tasks.push(task);
    }

    return tasks;
  }
}

module.exports = new TasksService();
