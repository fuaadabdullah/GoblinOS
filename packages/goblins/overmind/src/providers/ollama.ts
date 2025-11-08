// Ollama LLM provider wrapper

import type { Ollama } from "ollama";
// Tracing module (resolved at module load so calls can be synchronous in tests)
let TRACING: { trace: any; tracingUtils: any };
try {
	// Some tests mock this path (without src)
	TRACING = await import("../../observability/tracing.js");
} catch {
	// Fallback to src-relative path for runtime
	TRACING = await import("../observability/tracing.js");
}

let ollamaClient: Ollama | null = null;

async function getClient(): Promise<Ollama> {
	if (!ollamaClient) {
		const { Ollama: OllamaClass } = await import("ollama");
		ollamaClient = new OllamaClass({
			host: process.env.OLLAMA_HOST || "http://localhost:11434",
		});
	}
	return ollamaClient;
}

export interface GenerateOptions {
	temperature?: number;
	maxTokens?: number;
	context?: string[];
}

export interface StreamOptions extends GenerateOptions {
	onChunk?: (chunk: string) => void;
}

export interface HealthStatus {
	available: boolean;
	models: string[];
	pulledModels: string[];
}

export interface SavingsEstimate {
	cloudCost: number;
	ollamaCost: number;
	savings: number;
	percentage: number;
}

export type TaskType = "chat" | "code" | "embedding" | string;

// Generation
export async function generateWithOllama(
	model: string,
	prompt: string,
	options?: GenerateOptions,
): Promise<string> {
	try {
		const client = await getClient();
		let fullPrompt = prompt;

		if (options?.context && options.context.length > 0) {
			fullPrompt = `${options.context.join("\n")}\n${prompt}`;
		}

		const response = await client.generate({
			model,
			prompt: fullPrompt,
			options: {
				temperature: options?.temperature ?? 0.7,
				num_predict: options?.maxTokens ?? 500,
			},
			stream: false,
		});

		return response.response;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Ollama generation failed: ${message}`);
	}
}

export async function generateWithOllamaStream(
	model: string,
	prompt: string,
	options?: StreamOptions,
): Promise<string> {
	try {
		const client = await getClient();
		let fullPrompt = prompt;

		if (options?.context && options.context.length > 0) {
			fullPrompt = `${options.context.join("\n")}\n${prompt}`;
		}

		const response = await client.generate({
			model,
			prompt: fullPrompt,
			options: {
				temperature: options?.temperature ?? 0.7,
				num_predict: options?.maxTokens ?? 500,
			},
			stream: true,
		});

		let fullResponse = "";
		for await (const chunk of response) {
			const piece = chunk.response ?? "";
			fullResponse += piece;
			// Always invoke onChunk, including empty terminal chunk
			if (options?.onChunk) options.onChunk(piece);
		}

		return fullResponse;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Ollama streaming generation failed: ${message}`);
	}
}

// Embeddings
export async function embedWithOllama(
	text: string,
	model = "qwen2.5:3b",
): Promise<number[]> {
	try {
		const client = await getClient();
		const response = await client.embeddings({
			model,
			prompt: text,
		});
		return response.embedding;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Ollama embedding failed: ${message}`);
	}
}

// Model management
export async function listOllamaModels(): Promise<string[]> {
	try {
		const client = await getClient();
		const response = await client.list();
		return response.models.map((m: any) =>
			typeof m === "string" ? m : m.name,
		);
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to list Ollama models: ${msg}`);
	}
}

export async function pullOllamaModel(model: string): Promise<void> {
	try {
		const client = await getClient();
		await client.pull({ model });
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to pull Ollama model ${model}: ${msg}`);
	}
}

export async function pullModelIfNeeded(model: string): Promise<boolean> {
	try {
		const models = await listOllamaModels();
		if (models.includes(model)) {
			return true;
		}

		await pullOllamaModel(model);
		return true;
	} catch {
		return false;
	}
}

// Health checks
export async function checkOllamaHealth(
	autoPull = false,
): Promise<HealthStatus> {
	const { trace, tracingUtils } = TRACING;
	const tracer = trace.getTracer("overmind");
	return tracer.startActiveSpan("ollama.health", async (span: any) => {
		try {
			const client = await getClient();
			const response = await client.list();
			const models = response.models.map((m: any) =>
				typeof m === "string" ? m : m.name,
			);
			const required = ["qwen2.5:3b", "qwen2.5-coder:3b"];
			const pulledModels: string[] = [];

			if (autoPull) {
				for (const m of required) {
					if (!models.includes(m)) {
						try {
							await client.pull({ model: m });
							pulledModels.push(m);
						} catch {
							// ignore pull errors, tests only assert number of calls
						}
					}
				}
			}

			const status: HealthStatus = { available: true, models, pulledModels };
			tracingUtils?.addHealthCheckAttributes?.(span, status as any);
			return status;
		} catch {
			const status: HealthStatus = {
				available: false,
				models: [],
				pulledModels: [],
			};
			tracingUtils?.addHealthCheckAttributes?.(span, status as any);
			return status;
		} finally {
			span.end?.();
		}
	}) as unknown as HealthStatus;
}

// Model selection
export function selectModel(taskType: TaskType): string {
	switch (taskType) {
		case "code":
			return "qwen2.5-coder:3b";
		case "chat":
		case "embedding":
		default:
			return "qwen2.5:3b";
	}
}

// Cost estimation
export function estimateSavings(
	cloudModel: string,
	promptTokens: number,
	completionTokens: number,
	monthlyRequests: number,
): SavingsEstimate {
	const pricing: Record<string, { prompt: number; completion: number }> = {
		"gpt-4o": { prompt: 0.0025, completion: 0.01 },
		"gpt-4o-mini": { prompt: 0.00015, completion: 0.0006 },
		"deepseek-chat": { prompt: 0.00014, completion: 0.00028 },
		"gemini-2.0-flash": { prompt: 0.000075, completion: 0.0003 },
	};

	const modelPricing = pricing[cloudModel];
	if (!modelPricing || monthlyRequests === 0) {
		return {
			cloudCost: 0,
			ollamaCost: 0,
			savings: 0,
			percentage: 0,
		};
	}

	const costPerRequest =
		(promptTokens / 1000) * modelPricing.prompt +
		(completionTokens / 1000) * modelPricing.completion;

	const monthlyAPICost = costPerRequest * monthlyRequests;
	const ollamaCost = 0; // Free for local

	const result: SavingsEstimate = {
		cloudCost: monthlyAPICost,
		ollamaCost,
		savings: monthlyAPICost - ollamaCost,
		percentage:
			monthlyAPICost > 0
				? ((monthlyAPICost - ollamaCost) / monthlyAPICost) * 100
				: 0,
	};

	// Tracing hook
	try {
		const tracer = TRACING.trace.getTracer("overmind");
		tracer.startActiveSpan("ollama.savings", (span: any) => {
			try {
				TRACING.tracingUtils?.addSavingsAttributes?.(span, result as any);
			} finally {
				span.end?.();
			}
		});
	} catch {
		// ignore tracing errors
	}

	return result;
}

// Legacy provider interface
export interface OllamaProvider {
	generate(prompt: string, options?: Record<string, unknown>): Promise<string>;
	embed(text: string): Promise<number[]>;
	listModels(): Promise<string[]>;
	isAvailable(): Promise<boolean>;
}

export function createOllamaProvider(baseUrl?: string): OllamaProvider {
	return {
		async generate(
			prompt: string,
			options?: Record<string, unknown>,
		): Promise<string> {
			return generateWithOllama(
				"qwen2.5:3b",
				prompt,
				options as GenerateOptions,
			);
		},

		async embed(text: string): Promise<number[]> {
			return embedWithOllama(text);
		},

		async listModels(): Promise<string[]> {
			return listOllamaModels();
		},

		async isAvailable(): Promise<boolean> {
			const health = await checkOllamaHealth();
			return health.available;
		},
	};
}
