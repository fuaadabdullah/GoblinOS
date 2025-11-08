export interface GoblinTask {
	goblin: string;
	task: string;
	context?: Record<string, any>;
	stream?: boolean;
	dryRun?: boolean;
}

export interface GoblinResponse {
	goblin: string;
	task: string;
	tool?: string;
	command?: string;
	output?: string;
	reasoning?: string;
	kpis?: Record<string, number>;
	timestamp: Date;
	duration_ms: number;
	success: boolean;
}

export interface ModelProvider {
	generate(prompt: string, options?: GenerateOptions): Promise<string>;
	generateStream(
		prompt: string,
		options?: GenerateOptions,
	): AsyncIterable<string>;
	checkHealth(): Promise<boolean>;
	embed?(text: string, model?: string): Promise<number[]>;
}

export interface GenerateOptions {
	temperature?: number;
	maxTokens?: number;
	model?: string;
	systemPrompt?: string;
}

export interface MemoryEntry {
	id: string;
	goblin: string;
	task: string;
	response: string;
	timestamp: Date;
	kpis?: Record<string, number>;
	success: boolean;
}

export interface ToolExecutionResult {
	tool: string;
	command: string;
	output: string;
	exitCode?: number;
	success: boolean;
}
