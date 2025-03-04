const CrudControllerBase = require('./crud-controller.base');
const messagesStore = require('../stores/messages.store');

class MessagesController extends CrudControllerBase {
  constructor() {
    super('messages', 'message', messagesStore);
  }

  registerEndpoints(router) {
    super.registerEndpoints(router);

    router.get(`/${this.modelName}/conversation/:conversationId`, (req, res) => {
      this.getByConversationId(req, res).catch((e) => this.errorHandler(e, res));
    });
  }

  async getByConversationId(req, res) {
    const conversationId = req.params.conversationId;
    const messages = await messagesStore.getByConversationId(conversationId);
    res.json(messages);
  }
}

module.exports = new MessagesController();
