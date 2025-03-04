const CrudServiceBase = require('./crud-service.base');
const projectsService = require("./projects.service");

class ConversationsService extends CrudServiceBase {
  constructor() {
    super('conversations', 'conversation');
  }

  async prepareBeforeSave(conversation) {
    await super.prepareBeforeSave(conversation);

    conversation.title = conversation.title || `Conversation ${ conversation.id }`;
    const project = await projectsService.getById(conversation.projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    project.conversations = project.conversations || [];

    if (!project.conversations.find(c => c.id === conversation.id)) {
      project.conversations.push({ id: conversation.id, title: conversation.title });
    }

    await projectsService.update(project.id, project);
  }

  async findByProjectId(projectId) {
    // First, get the project
    const project = await projectsService.getById(projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    // If the project has no conversations, return empty array
    if (!project.conversations || project.conversations.length === 0) {
      return [];
    }

    // Get all conversations referenced in the project
    const conversations = [];

    for (const conversationId of project.conversations) {
      const conversation = await this.getById(conversationId);
      if (conversation) {
        conversations.push(conversation);
      }
    }

    return conversations;
  }
}

module.exports = new ConversationsService();
