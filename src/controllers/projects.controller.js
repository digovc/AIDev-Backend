class ProjectsController {
  registerEndpoints(router) {
    router.post('/projects', (req, res) => {
      this.create(req, res).catch((e) => this._errorHandler(e, res));
    });

    router.put('/projects/:id', (req, res) => {
      this.update(req, res).catch((e) => this._errorHandler(e, res));
    });

    router.delete('/projects/:id', (req, res) => {
      this.delete(req, res).catch((e) => this._errorHandler(e, res));
    });

    router.get('/projects', (req, res) => {
      this.list(req, res).catch((e) => this._errorHandler(e, res));
    });

    router.get('/projects/:id', (req, res) => {
      this.get(req, res).catch((e) => this._errorHandler(e, res));
    });
  }

  _errorHandler(err, res) {
    console.log(err);
    res.status(500).send({ error: err.message });
  }

  async create(req, res) {

  }

  async delete(req, res) {

  }

  async get(req, res) {

  }

  async list(req, res) {

  }

  async update(req, res) {
  }
}

module.exports = new ProjectsController();
