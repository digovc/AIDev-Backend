const CrudServiceBase = require('./crud-service.base');

class ConversationsService extends CrudServiceBase {
  constructor() {
    super('conversations', 'conversation');
  }
}

module.exports = new ConversationsService();
