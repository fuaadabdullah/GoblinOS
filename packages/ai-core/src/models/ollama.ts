import { IModel, ModelConfig } from '../interfaces';

export class OllamaModel implements IModel {
  constructor(private config: ModelConfig) {}

  async run(prompt: string): Promise<string> {
    console.log(`[Ollama (${this.config.config.model})] Running prompt: ${prompt}`);
    // In a real implementation, you would connect to the Ollama API here.
    return `Ollama response for: ${prompt}`;
  }
}
