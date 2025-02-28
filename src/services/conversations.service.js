const CrudServiceBase = require('./crud-service.base');
const projectsService = require("./projects.service");

class ConversationsService extends CrudServiceBase {
  constructor() {
    super('conversations', 'conversation');
  }

  async prepareBeforeSave(itemData) {
    await super.prepareBeforeSave(itemData);
    const project = await projectsService.getById(itemData.projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    project.conversations = project.conversations || [];
    project.conversations.push(itemData.id);

    await projectsService.update(project.id, project);
  }
}

module.exports = new ConversationsService();
