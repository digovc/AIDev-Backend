const tasksStore = require('../stores/tasks.store');

class WriteTaskTool {
  getDefinition() {
    return {
      "name": "write_task",
      "description": "Adiciona ou atualiza uma tarefa do projeto",
      "input_schema": {
        "type": "object",
        "properties": {
          "id": {
            "description": "ID da tarefa (obrigatório para atualização)",
            "type": "string"
          },
          "title": {
            "description": "Título da tarefa (obrigatório para criação)",
            "type": "string"
          },
          "description": {
            "description": "Descrição detalhada da tarefa",
            "type": "string"
          },
          "status": {
            "description": "Status da tarefa",
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

  async executeTool(conversation, input) {
    if (input.id) {
      // Caso de atualização
      const task = await tasksStore.getById(input.id);

      if (input.title) task.title = input.title;
      if (input.description !== undefined) task.description = input.description;
      if (input.status) task.status = input.status;

      return await tasksStore.update(input.id, task);
    } else {
      // Caso de criação
      if (!input.title) {
        throw new Error("Para criar uma tarefa, o campo 'title' é obrigatório");
      }

      const task = {
        projectId: conversation.projectId,
      }

      task.title = input.title
      task.description = input.description || ""
      task.status = input.status || "backlog"
      task.projectId = conversation.projectId

      return await tasksStore.create(task);
    }
  }
}

module.exports = new WriteTaskTool();
