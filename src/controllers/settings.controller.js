const CrudControllerBase = require('./crud-controller.base');
const settingsStore = require('../stores/settings.store');

class SettingsController extends CrudControllerBase {
  constructor() {
    super('settings', 'Settings', settingsStore);
  }

  registerEndpoints(router) {
    router.get('/settings', (req, res) => {
      this.get(req, res).catch((e) => this.errorHandler(e, res));
    });

    router.post('/settings', (req, res) => {
      this.create(req, res).catch((e) => this.errorHandler(e, res));
    });
  }
}

module.exports = new SettingsController();
