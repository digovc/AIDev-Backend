const express = require('express');
const projectsController = require('./controllers/projects.controller');
const conversationsController = require("./controllers/conversations.controller");
const tasksController = require("./controllers/tasks.controller");

class Router {
  constructor() {
    this._router = express.Router();

    // Health check endpoint
    this._router.get('/health-check', (req, res) => {
      res.json({ status: 'ok', version: '1.0.0 alpha' });
    });

    // Register all controller endpoints
    projectsController.registerEndpoints(this._router);
    conversationsController.registerEndpoints(this._router);
    tasksController.registerEndpoints(this._router);
  }

  getRouter() {
    return this._router;
  }
}

module.exports = new Router();
