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

    const oldTask = project.tasks.find(t => t.id === task.id);

    if (oldTask) {
      oldTask.title = task.title;
      oldTask.status = task
    } else {
      project.tasks.push({ id: task.id, title: task.title, status: task.status });
    }

    await projectsService.update(project.id, project);
  }
}

module.exports = new TasksService();
