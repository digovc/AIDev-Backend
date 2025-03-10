const fs = require('fs');
const path = require('path');

class SettingsController {
  constructor() {
    this.settingsPath = path.resolve('.aidev/settings.json');
  }

  _ensureDirectoryExists() {
    const dir = path.dirname(this.settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  registerEndpoints(router) {
    router.get('/settings', (req, res) => {
      try {
        this._ensureDirectoryExists();
        
        if (!fs.existsSync(this.settingsPath)) {
          return res.json({});
        }

        const settings = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
        res.json(settings);
      } catch (error) {
        console.error('Error reading settings:', error);
        res.status(500).json({ error: 'Failed to read settings' });
      }
    });

    router.post('/settings', (req, res) => {
      try {
        this._ensureDirectoryExists();

        const newSettings = req.body;
        fs.writeFileSync(this.settingsPath, JSON.stringify(newSettings, null, 2), 'utf8');
        res.json(newSettings);
      } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
      }
    });
  }
}

module.exports = new SettingsController();