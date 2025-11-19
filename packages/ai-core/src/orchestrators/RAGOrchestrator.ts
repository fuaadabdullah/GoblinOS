import * as fs from 'fs';
import * as yaml from 'yaml';
import { IOrchestrator, IModel, ModelConfig, PipelineConfig } from '../interfaces';
import { OllamaModel } from '../models/ollama';
import { GeminiModel } from '../models/gemini';

export class RAGOrchestrator implements IOrchestrator {
  private models: Map<string, IModel> = new Map();
  private pipelines: Map<string, PipelineConfig> = new Map();

  constructor(configPath: string) {
    this.loadConfig(configPath);
  }

  private loadConfig(configPath: string) {
    const file = fs.readFileSync(configPath, 'utf8');
    const config = yaml.parse(file);

    for (const modelConfig of config.models) {
      const model = this.createModel(modelConfig);
      this.models.set(modelConfig.name, model);
    }

    for (const pipelineConfig of config.pipelines) {
      this.pipelines.set(pipelineConfig.name, pipelineConfig);
    }
  }

  private createModel(modelConfig: ModelConfig): IModel {
    switch (modelConfig.provider) {
      case 'ollama':
        return new OllamaModel(modelConfig);
      case 'gemini':
        return new GeminiModel(modelConfig);
      default:
        throw new Error(`Unknown model provider: ${modelConfig.provider}`);
    }
  }

  async execute(prompt: string, pipelineName: string): Promise<string> {
    const pipeline = this.pipelines.get(pipelineName);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineName}`);
    }

    let currentPrompt = prompt;
    for (const step of pipeline.steps) {
      const model = this.models.get(step.model);
      if (!model) {
        throw new Error(`Model not found: ${step.model}`);
      }
      // In a real implementation, the 'action' would be more meaningful
      console.log(`Executing action: ${step.action} with model: ${step.model}`);
      currentPrompt = await model.run(currentPrompt);
    }

    return currentPrompt;
  }
}
