const CrudControllerBase = require('./crud-controller.base');

class ConversationsController extends CrudControllerBase {
  constructor() {
    super('conversations', 'conversation');
  }
}

module.exports = new ConversationsController();
