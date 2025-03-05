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
    const taskData = {
      projectId: conversation.projectId
    };

    if (input.id) {
      // Caso de atualização
      if (input.title) taskData.title = input.title;
      if (input.description !== undefined) taskData.description = input.description;
      if (input.status) taskData.status = input.status;

      return await tasksStore.update(input.id, taskData);
    } else {
      // Caso de criação
      if (!input.title) {
        throw new Error("Para criar uma tarefa, o campo 'title' é obrigatório");
      }

      taskData.title = input.title
      taskData.description = input.description || ""
      taskData.status = input.status || "backlog"
      taskData.projectId = conversation.projectId

      return await tasksStore.create(taskData);
    }
  }
}

module.exports = new WriteTaskTool();
