const CrudServiceBase = require('./crud-service.base');
const projectsService = require("./projects.service");
const socketIOService = require("../services/socket-io.service");

class ConversationsService extends CrudServiceBase {
  constructor() {
    super('conversations', 'conversation');
  }

  async create(conversation) {
    await super.create(conversation);
    socketIOService.io.emit('conversation-created', conversation);
    return conversation;
  }

  async prepareBeforeSave(conversation) {
    await super.prepareBeforeSave(conversation);

    conversation.title = conversation.title || `Conversation ${ conversation.id }`;
    const project = await projectsService.getById(conversation.projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    project.conversations = project.conversations || [];

    if (!project.conversations.includes(conversation.id)) {
      project.conversations.push(conversation.id);
      await projectsService.update(project.id, project);
    }
  }

  async getByProjectId(projectId) {
    const project = await projectsService.getById(projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    const conversations = []

    for (const conversationId of project.conversations ?? []) {
      const conversation = await this.getById(conversationId);
      conversations.push(conversation);
    }

    return conversations;
  }
}

module.exports = new ConversationsService();
