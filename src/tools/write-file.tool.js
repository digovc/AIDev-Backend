const fs = require('fs').promises;
const path = require('path');

class WriteFileTool {
  definition() {
    return {
      "name": "write_file",
      "description": "Cria ou atualiza um arquivo no projeto",
      "input_schema": {
        "type": "object",
        "required": [
          "file",
          "blocks"
        ],
        "properties": {
          "file": {
            "type": "string",
            "description": "Diretório do arquivo a ser criado ou atualizado"
          },
          "blocks": {
            "type": "array",
            "description": "Array de blocos de a serem escritos ou substituídos no arquivo",
            "items": {
              "type": "object",
              "required": [
                "replace"
              ],
              "properties": {
                "search": {
                  "type": "string",
                  "description": "Bloco de texto a ser substituído"
                },
                "replace": {
                  "type": "string",
                  "description": "Bloco de texto a ser inserido ou substituído"
                }
              }
            }
          }
        }
      }
    }
  }

  async executeTool(conversation, input) {
    const filePath = path.resolve(process.cwd(), input.file);

    try {
      // Verificar se o arquivo existe
      let content = '';
      try {
        content = await fs.readFile(filePath, 'utf8');
      } catch (error) {
        // Se o arquivo não existir, começamos com conteúdo vazio
        if (error.code !== 'ENOENT') {
          throw error; // Se for outro erro, propagar
        }
      }

      // Processar cada bloco
      for (const block of input.blocks) {
        if (block.search) {
          // Substituir conteúdo existente
          content = content.replace(block.search, block.replace);
        } else {
          // Adicionar novo conteúdo
          content += block.replace;
        }
      }

      // Garantir que o diretório exista
      const directory = path.dirname(filePath);
      await fs.mkdir(directory, { recursive: true });

      // Escrever o arquivo
      await fs.writeFile(filePath, content, 'utf8');

      return {
        success: true,
        message: `Arquivo ${ input.file } atualizado com sucesso.`
      };
    } catch (error) {
      return {
        success: false,
        message: `Erro ao atualizar arquivo: ${ error.message }`
      };
    }
  }
}

module.exports = new WriteFileTool();
