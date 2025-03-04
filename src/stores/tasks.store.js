const StoreBase = require('./store.base');
const projectsStore = require("./projects.store");

class TasksStore extends StoreBase {
  constructor() {
    super('tasks', 'task');
  }

  async prepareBeforeSave(task) {
    await super.prepareBeforeSave(task);
    const project = await projectsStore.getById(task.projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    project.tasks = project.tasks || [];

    if (!project.tasks.includes(task.id)) {
      project.tasks.push(task.id);
      await projectsStore.update(project.id, project);
    }
  }

  async getByProjectId(projectId) {
    const project = await projectsStore.getById(projectId);

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

module.exports = new TasksStore();
