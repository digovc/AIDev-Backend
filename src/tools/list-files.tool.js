const fs = require('fs').promises;
const path = require('path');
const projecsService = require('../stores/projects.service');

class ListFilesTool {
  getDefinition() {
    return {
      "name": "list_files",
      "description": "Lista os diretórios e arquivos do projeto",
      "input_schema": {
        "type": "object",
        "properties": {
          "folder": {
            "description": "Diretório que deseja listar",
            "type": "string"
          }
        }
      }
    }
  }

  async executeTool(conversation, input) {
    const project = await projecsService.getById(conversation.projectId);
    const projectFolder = project.path;
    const folder = path.join(projectFolder, input.folder);
    const files = await fs.readdir(folder);

    const promises = files.map(async file => {
      const stats = await fs.stat(path.join(folder, file));
      return {
        name: file,
        isDirectory: stats.isDirectory(),
        size: stats.size
      };
    });

    return await Promise.all(promises);
  }
}

module.exports = new ListFilesTool();
