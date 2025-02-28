const fs = require('fs').promises;
const path = require('path');

class CrudControllerBase {
  constructor(modelName, modelPrefix) {
    this.modelName = modelName;
    this.modelPrefix = modelPrefix;
  }

  registerEndpoints(router) {
    router.post(`/${ this.modelName }`, (req, res) => {
      this.create(req, res).catch((e) => this.errorHandler(e, res));
    });

    router.put(`/${ this.modelName }/:id`, (req, res) => {
      this.update(req, res).catch((e) => this.errorHandler(e, res));
    });

    router.delete(`/${ this.modelName }/:id`, (req, res) => {
      this.delete(req, res).catch((e) => this.errorHandler(e, res));
    });

    router.get(`/${ this.modelName }`, (req, res) => {
      this.list(req, res).catch((e) => this.errorHandler(e, res));
    });

    router.get(`/${ this.modelName }/:id`, (req, res) => {
      this.get(req, res).catch((e) => this.errorHandler(e, res));
    });
  }

  errorHandler(err, res) {
    console.log(err);
    res.status(500).send({ error: err.message });
  }

  async create(req, res) {
    const itemData = req.body;
    const now = new Date();

    // Generate a unique ID if not provided
    itemData.id = `${ now.getTime() }`;

    // Add creation timestamp
    itemData.createdAt = now.toISOString();

    const dataDir = await this.getDataDir();
    const fileName = `${ this.modelPrefix }_${ itemData.id }.json`;
    const filePath = path.join(dataDir, fileName);

    await fs.writeFile(filePath, JSON.stringify(itemData, null, 2));

    res.status(201).json(itemData);
  }

  async update(req, res) {
    const id = req.params.id;
    const itemFilePath = await this.getItemFilePath(id);

    try {
      await fs.access(itemFilePath);
    } catch (error) {
      return res.status(404).json({ error: `${ this.modelPrefix } not found` });
    }

    const existingContent = await fs.readFile(itemFilePath, 'utf8');
    const existingItem = JSON.parse(existingContent);

    // Update item data
    const updatedItem = {
      ...existingItem,
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    // Ensure ID doesn't change
    updatedItem.id = id;

    await fs.writeFile(itemFilePath, JSON.stringify(updatedItem, null, 2));

    res.json(updatedItem);
  }

  async list(req, res) {
    const items = await this.getAllItems();
    res.json(items);
  }

  async get(req, res) {
    const id = req.params.id;
    const item = await this.getItemById(id);

    if (!item) {
      return res.status(404).json({ error: `${ this.modelPrefix } not found` });
    }

    res.json(item);
  }

  async delete(req, res) {
    const id = req.params.id;
    const itemFilePath = await this.getItemFilePath(id);
    try {
      await fs.access(itemFilePath);
    } catch (error) {
      return res.status(404).json({ error: `${ this.modelPrefix } not found` });
    }

    await fs.unlink(itemFilePath);

    res.status(204).send();
  }

  async getDataDir() {
    const dataDir = path.join(process.cwd(), '.aidev', this.modelName);

    // Ensure the directory exists
    try {
      await fs.access(dataDir);
    } catch (error) {
      await fs.mkdir(dataDir, { recursive: true });
    }

    return dataDir;
  }

  async getAllItems() {
    const dataDir = await this.getDataDir();
    const files = await fs.readdir(dataDir);

    const items = [];
    for (const file of files) {
      if (file.startsWith(`${ this.modelPrefix }_`) && file.endsWith('.json')) {
        const filePath = path.join(dataDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const item = JSON.parse(content);
        items.push(item);
      }
    }

    return items;
  }

  async getItemById(id) {
    const filePath = await this.getItemFilePath(id);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  async getItemFilePath(id) {
    const dataDir = await this.getDataDir();
    return path.join(dataDir, `${ this.modelPrefix }_${ id }.json`);
  }
}

module.exports = CrudControllerBase;
