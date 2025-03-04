const CrudControllerBase = require('./crud-controller.base');
const agentService = require('../services/agent.service');
const conversationsService = require('../stores/conversations.store');

class ConversationsController extends CrudControllerBase {
  constructor() {
    super('conversations', 'conversation', conversationsService);
  }

  registerEndpoints(router) {
    super.registerEndpoints(router);

    router.post(`/${ this.modelName }/:id/messages`, (req, res) => {
      this.createMessage(req, res).catch((e) => this.errorHandler(e, res));
    });

    router.get(`/${ this.modelName }/project/:projectId`, (req, res) => {
      this.getByProjectId(req, res).catch((e) => this.errorHandler(e, res));
    });
  }

  async createMessage(req, res) {
    const messageData = req.body;
    const conversationId = req.params.id;
    const conversation = await conversationsService.getById(conversationId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (!conversation.messages) {
      conversation.messages = [];
    }

    messageData.createdAt = new Date().toISOString();
    messageData.sender = 'user';

    conversation.messages.push(messageData);

    await conversationsService.update(conversationId, conversation);

    agentService.sendMessage(conversation).catch(console.error);

    res.status(201).json(messageData);
  }

  async getByProjectId(req, res) {
    const projectId = req.params.projectId;
    const conversations = await conversationsService.getByProjectId(projectId);
    res.json(conversations);
  }
}

module.exports = new ConversationsController();
