const CrudControllerBase = require('./crud-controller.base');
const agentService = require('../services/agent.service');
const conversationsService = require('../services/conversations.service');

class ConversationsController extends CrudControllerBase {
  constructor() {
    super('conversations', 'conversation', conversationsService);
  }

  registerEndpoints(router) {
    super.registerEndpoints(router);

    router.post(`/${ this.modelName }/:id/messages`, (req, res) => {
      this.createMessage(req, res).catch((e) => this.errorHandler(e, res));
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

    // Salvar a conversa atualizada
    await conversationsService.update(conversationId, conversation);

    agentService.sendMessage(conversation).catch(console.error);

    // Retornar a mensagem criada com status 201 (Created)
    res.status(201).json(messageData);
  }
}

module.exports = new ConversationsController();
