export interface ModelConfig {
  name: string;
  provider: string;
  role: 'reasoning' | 'creative' | 'retrieval' | 'generation';
  config: Record<string, any>;
}

export interface PipelineStep {
  model: string;
  action: string;
}

export interface PipelineConfig {
  name: string;
  steps: PipelineStep[];
}

export interface IModel {
  run(prompt: string): Promise<string>;
}

export interface IOrchestrator {
  execute(prompt: string, pipelineName: string): Promise<string>;
}
