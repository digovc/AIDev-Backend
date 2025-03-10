const anthropicService = require('./anthropic.service');
const openAIService = require('./open-ai.service');
const listFilesTool = require("../tools/list-files.tool");
const listTasksTool = require("../tools/list-tasks.tool");
const messagesStore = require('../stores/messages.store');
const readFileTool = require("../tools/read-file.tool");
const socketIOService = require("./socket-io.service");
const toolFormatterService = require("./tool-formatter.service");
const writeFileTool = require("../tools/write-file.tool");
const writeTaskTool = require("../tools/write-task.tool");

class AgentService {
  constructor() {
    // Define o serviço de IA a ser usado (Anthropic ou OpenAI)
    // Por padrão, usamos Anthropic, mas pode ser configurado através de variável de ambiente
    const useOpenAI = process.env.AI_SERVICE === 'openai';
    this.aiService = useOpenAI ? openAIService : anthropicService;
    this.provider = useOpenAI ? 'openai' : 'anthropic';
  }

  async sendMessage(conversation, cancelationToken) {
    const messages = await messagesStore.getByConversationId(conversation.id);

    const assistantMessage = {
      id: `${ new Date().getTime() }`,
      conversationId: conversation.id,
      sender: 'assistant',
      blocks: [],
    };

    await messagesStore.create(assistantMessage);

    const tools = [
      listFilesTool,
      listTasksTool,
      readFileTool,
      writeFileTool,
      writeTaskTool
    ];

    // Formatar as definições de ferramentas de acordo com o provedor em uso
    const toolDefinitions = tools.map(tool => {
      const baseDefinition = tool.getDefinition();
      return toolFormatterService.formatToolForProvider(baseDefinition, this.provider);
    });

    await this.aiService.chatCompletion(messages, cancelationToken, toolDefinitions, (event) => this.receiveStream(conversation, cancelationToken, assistantMessage, tools, event));
  }

  async continueConversation(conversation) {
    try {
      await this.sendMessage(conversation, { isCanceled: () => false });
    } catch (e) {
      await this.logError(conversation, e);
    }
  }

  async logError(conversation, error) {
    const errorMessage = {
      id: new Date().getTime(),
      conversationId: conversation.id,
      sender: 'log',
      timestamp: new Date().toISOString(),
      blocks: [{ type: 'text', content: `Erro ao continuar a conversa: ${ error.message }` }]
    }
    await messagesStore.create(errorMessage);
  }

  async receiveStream(conversation, cancelationToken, assistantMessage, tools, event) {
    try {
      const type = event.type;

      switch (type) {
        case 'message_start':
          assistantMessage.inputTokens = event.inputTokens;
          break;
        case 'message_stop':
          await this.finishMessage(conversation, cancelationToken, assistantMessage, event);
          break;
        case 'block_start':
          return this.createBlock(assistantMessage, event);
        case 'block_delta':
          return this.appendBlockContent(assistantMessage, event.delta);
        case 'block_stop':
          return this.closeBlock(conversation, cancelationToken, assistantMessage, tools);
      }
    } catch (e) {
      const message = `Erro ao processar stream: ${ e.message }`;
      await this.logError(conversation, { message });
    }
  }

  async finishMessage(conversation, cancelationToken, assistantMessage, event) {
    await messagesStore.update(assistantMessage.id, assistantMessage);

    if (event.flow?.blocks?.every(block => block.type !== 'tool_use')) {
      cancelationToken?.cancel();
    }
  }

  async createBlock(assistantMessage, event) {
    const block = {
      id: `${ new Date().getTime() }`,
      messageId: assistantMessage.id,
      type: event.blockType,
      tool: event.tool,
      toolUseId: event.toolUseId,
      content: ''
    };

    assistantMessage.blocks.push(block);
    socketIOService.io.emit('block-created', block);
  }

  async appendBlockContent(assistantMessage, content) {
    const lastBlock = assistantMessage.blocks[assistantMessage.blocks.length - 1];
    lastBlock.content += content;

    socketIOService.io.emit('block-delta', {
      id: lastBlock.id,
      messageId: lastBlock.messageId,
      delta: content
    });
  }

  async closeBlock(conversation, cancelationToken, assistantMessage, tools) {
    const lastBlock = assistantMessage.blocks[assistantMessage.blocks.length - 1];
    await messagesStore.update(assistantMessage.id, assistantMessage);

    if (lastBlock.type !== 'tool_use') {
      return;
    }

    if (!lastBlock.content || lastBlock.content === '') {
      lastBlock.content = '{}';
    }

    lastBlock.content = JSON.parse(lastBlock.content);
    await messagesStore.update(assistantMessage.id, assistantMessage);
    await this.useTool(conversation, cancelationToken, assistantMessage, tools, lastBlock);
  }

  async useTool(conversation, cancelationToken, assistantMessage, tools, block) {
    const tool = tools.find(tool => tool.getDefinition().name === block.tool);
    let result;

    try {
      result = await tool.executeTool(conversation, block.content);
    } catch (e) {
      result = { error: e.message }
    }

    const toolMessage = {
      id: `${ new Date().getTime() }`,
      conversationId: conversation.id,
      sender: 'tool',
      blocks: [
        { type: 'tool_result', toolUseId: block.toolUseId, content: result, isError: !!result.error }
      ]
    };

    await messagesStore.create(toolMessage);
    socketIOService.io.emit('task-executing', cancelationToken.taskId);

    try {
      await this.sendMessage(conversation, cancelationToken);
    } catch (error) {
      cancelationToken.cancel();
      await this.logError(conversation, error);
    }
  }
}

module.exports = new AgentService();
