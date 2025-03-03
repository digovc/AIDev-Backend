const fs = require('fs').promises;
const path = require('path');

class ListTasksTool {
  definition() {
    return {
      "name": "list_tasks",
      "description": "Lista as tarefas do projeto",
      "input_schema": {
        "type": "object",
        "properties": {
          "status": {
            "description": "Filtro por status da tarefa",
            "type": "string",
            "enum": [
              "backlog",
              "running",
              "done"
            ]
          }
        }
      }
    }
  }

  async execute(conversation, input) {
    // Assumindo que as tarefas estão armazenadas em um arquivo JSON
    try {
      const tasksData = await fs.readFile(path.join(process.cwd(), 'tasks.json'), 'utf8');
      const tasks = JSON.parse(tasksData);

      // Filtrar por status se fornecido
      if (input.status) {
        return tasks.filter(task => task.status === input.status);
      }

      return tasks;
    } catch (error) {
      // Se o arquivo não existir ou houver outro erro, retornar array vazio
      console.error('Erro ao ler tarefas:', error);
      return [];
    }
  }
}

module.exports = new ListTasksTool();
