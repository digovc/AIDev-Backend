const fs = require('fs').promises;
const CrudControllerBase = require('./crud-controller.base');
const { router } = require("express/lib/application");

class ConversationsController extends CrudControllerBase {
  constructor() {
    super('conversations', 'conversation');
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
    const conversation = await this.getItemById(conversationId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (!conversation.messages) {
      conversation.messages = [];
    }

    messageData.createdAt = new Date().toISOString();
    messageData.from = 'user';

    conversation.messages.push(messageData);

    // Salvar a conversa atualizada
    const itemFilePath = await this.getItemFilePath(conversationId);
    conversation.updatedAt = new Date().toISOString();

    await fs.writeFile(itemFilePath, JSON.stringify(conversation, null, 2));

    // Retornar a mensagem criada com status 201 (Created)
    res.status(201).json(messageData);
  }
}

module.exports = new ConversationsController();
