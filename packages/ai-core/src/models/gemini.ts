import { IModel, ModelConfig } from '../interfaces';

export class GeminiModel implements IModel {
  constructor(private config: ModelConfig) {}

  async run(prompt: string): Promise<string> {
    console.log(`[Gemini (${this.config.name})] Running prompt: ${prompt}`);
    // In a real implementation, you would connect to the Gemini API here.
    return `Gemini response for: ${prompt}`;
  }
}
