const fs = require('fs').promises;
const path = require('path');

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

  async _getProjectsDir() {
    const projectsDir = path.join(process.cwd(), 'data', 'projects');

    // Ensure the directory exists
    try {
      await fs.access(projectsDir);
    } catch (error) {
      await fs.mkdir(projectsDir, { recursive: true });
    }

    return projectsDir;
  }

  async _getAllProjects() {
    const projectsDir = await this._getProjectsDir();
    const files = await fs.readdir(projectsDir);

    const projects = [];
    for (const file of files) {
      if (file.startsWith('project_') && file.endsWith('.json')) {
        const filePath = path.join(projectsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const project = JSON.parse(content);
        projects.push(project);
      }
    }

    return projects;
  }

  async _getProjectById(id) {
    const projects = await this._getAllProjects();
    return projects.find(project => project.id === id);
  }

  async _getProjectFilePath(id) {
    const projectsDir = await this._getProjectsDir();
    const files = await fs.readdir(projectsDir);

    for (const file of files) {
      if (file.startsWith('project_') && file.endsWith('.json')) {
        const filePath = path.join(projectsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const project = JSON.parse(content);

        if (project.id === id) {
          return filePath;
        }
      }
    }

    return null;
  }

  async create(req, res) {
    const projectData = req.body;
    const now = new Date();

    // Generate a unique ID if not provided
    projectData.id = `${ now.getTime() }`;

    // Add creation timestamp
    projectData.createdAt = now.toISOString();

    const projectsDir = await this._getProjectsDir();
    const fileName = `${ projectData.id }.json`;
    const filePath = path.join(projectsDir, fileName);

    await fs.writeFile(filePath, JSON.stringify(projectData, null, 2));

    res.status(201).json(projectData);
  }

  async list(req, res) {
    const projects = await this._getAllProjects();
    res.json(projects);
  }

  async get(req, res) {
    const id = req.params.id;
    const project = await this._getProjectById(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  }

  async update(req, res) {
    const id = req.params.id;
    const projectFilePath = await this._getProjectFilePath(id);

    if (!projectFilePath) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const existingContent = await fs.readFile(projectFilePath, 'utf8');
    const existingProject = JSON.parse(existingContent);

    // Update project data
    const updatedProject = {
      ...existingProject,
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    // Ensure ID doesn't change
    updatedProject.id = id;

    await fs.writeFile(projectFilePath, JSON.stringify(updatedProject, null, 2));

    res.json(updatedProject);
  }

  async delete(req, res) {
    const id = req.params.id;
    const projectFilePath = await this._getProjectFilePath(id);

    if (!projectFilePath) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await fs.unlink(projectFilePath);

    res.status(204).send();
  }
}

module.exports = new ProjectsController();
