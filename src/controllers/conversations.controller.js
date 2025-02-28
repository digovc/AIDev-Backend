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

    conversation.messages.push(messageData);
    // Save the updated conversation
  }
}

module.exports = new ConversationsController();
