const CrudControllerBase = require('./crud-controller.base');

class MessagesController extends CrudControllerBase {
  constructor() {
    super('messages', 'message');
  }
}

module.exports = new MessagesController();
