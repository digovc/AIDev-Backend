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

    const oldConversation = project.conversations.find(c => c.id === conversation.id);

    if (oldConversation) {
      oldConversation.title = conversation.title;
    } else {
      project.conversations.push({ id: conversation.id, title: conversation.title });
    }

    await projectsService.update(project.id, project);
  }
}

module.exports = new ConversationsService();
