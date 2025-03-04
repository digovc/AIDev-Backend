const StoreBase = require('./store.base');

class MessagesStore extends StoreBase {
  constructor() {
    super('messages', 'message');
  }
}

module.exports = new MessagesStore();
