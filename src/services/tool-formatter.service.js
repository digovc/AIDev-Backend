/**
 * Serviço para formatar definições de ferramentas de acordo com o provedor
 */
class ToolFormatterService {
  /**
   * Converte uma definição de ferramenta para o formato específico de um provedor
   * @param {Object} toolDefinition - Definição de ferramenta no formato interno
   * @param {string} provider - Provedor ('openai' ou 'anthropic')
   * @returns {Object} Definição formatada para o provedor especificado
   */
  formatToolForProvider(toolDefinition, provider) {
    if (provider === 'openai') {
      return this.formatToolForOpenAI(toolDefinition);
    } else {
      // Formato padrão é Anthropic
      return this.formatToolForAnthropic(toolDefinition);
    }
  }

  /**
   * Converte uma definição de ferramenta para o formato OpenAI
   * @param {Object} toolDefinition - Definição de ferramenta no formato interno
   * @returns {Object} Definição formatada para OpenAI
   */
  formatToolForOpenAI(toolDefinition) {
    return {
      type: 'function',
      function: {
        name: toolDefinition.name,
        description: toolDefinition.description,
        parameters: {
          ...toolDefinition.input_schema,
          // Garantir que propriedades específicas do OpenAI existam
          additionalProperties: toolDefinition.input_schema.additionalProperties || false,
        }
      }
    };
  }

  /**
   * Converte uma definição de ferramenta para o formato Anthropic
   * @param {Object} toolDefinition - Definição de ferramenta no formato interno
   * @returns {Object} Definição formatada para Anthropic
   */
  formatToolForAnthropic(toolDefinition) {
    // O formato interno já é baseado no Anthropic, então apenas retornamos a definição
    return toolDefinition;
  }
}

module.exports = new ToolFormatterService();
