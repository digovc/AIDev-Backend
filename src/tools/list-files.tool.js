const fs = require('fs').promises;
const path = require('path');

class ListFilesTool {
  definition() {
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

  async execute(conversation, input) {
    const folder = input.folder || './';
    const files = await fs.readdir(folder);

    return files.map(async file => {
      const stats = await fs.stat(path.join(folder, file));
      return {
        name: file,
        isDirectory: stats.isDirectory(),
        size: stats.size
      };
    });
  }
}

module.exports = new ListFilesTool();
