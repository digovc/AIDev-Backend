const fs = require('fs').promises;
const path = require('path');
const projectsStore = require('../stores/projects.store');

class ReadFileTool {
  getDefinition() {
    return {
      "name": "read_file",
      "description": "Lê o conteúdo de um arquivo no projeto. Não leia arquivos que já estão disponíveis como referência.",
      "input_schema": {
        "type": "object",
        "required": [
          "file"
        ],
        "properties": {
          "file": {
            "type": "string",
            "description": "Diretório do arquivo a ser lido"
          }
        }
      }
    }
  }

  async executeTool(conversation, input) {
    const project = await projectsStore.getById(conversation.projectId);
    const projectPath = project.path;
    const filePath = path.resolve(projectPath, input.file);

    try {
      // Ler o conteúdo do arquivo
      const content = await fs.readFile(filePath, 'utf8');

      return {
        success: true,
        content: content,
        message: `Arquivo ${ input.file } lido com sucesso.`
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          success: false,
          message: `Arquivo ${ input.file } não encontrado.`
        };
      }

      // Se for outro erro, propagar com mensagem mais informativa
      return {
        success: false,
        message: `Erro ao ler o arquivo ${ input.file }: ${ error.message }`
      };
    }
  }
}

module.exports = new ReadFileTool();
