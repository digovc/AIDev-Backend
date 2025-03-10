const StoreBase = require('./store.base');

class SettingsStore extends StoreBase {
  constructor() {
    super('settings');
    this.settings = {};
  }
}

module.exports = new SettingsStore();
