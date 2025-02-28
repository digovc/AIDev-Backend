const express = require('express');

class Router {
  constructor() {
    this._router = express.Router();

    // Health check endpoint
    this._router.get('/health-check', (req, res) => {
      res.json({ status: 'ok', version: '1.0.0 alpha' });
    });

    // Register all controller endpoints
    projectsController.registerEndpoints(this._router);
  }

  getRouter() {
    return this._router;
  }
}

module.exports = new Router();
