import { Ollama } from "ollama";
import type { GenerateOptions, ModelProvider } from "../types.js";

export class OllamaProvider implements ModelProvider {
	private client: Ollama;
	private defaultModel: string;

	constructor(options: { host?: string; model?: string } = {}) {
		this.client = new Ollama({
			host: options.host || process.env.OLLAMA_HOST || "http://localhost:11434",
		});
		this.defaultModel = options.model || "qwen2.5:3b";
	}

	async generate(
		prompt: string,
		options: GenerateOptions = {},
	): Promise<string> {
		try {
			const response = await this.client.generate({
				model: options.model || this.defaultModel,
				prompt,
				system: options.systemPrompt,
				stream: false,
				options: {
					temperature: options.temperature ?? 0.7,
					num_predict: options.maxTokens ?? 2048,
				},
			});

			return response.response;
		} catch (error: any) {
			console.error("Ollama generate error:", error.message);
			throw new Error(`Ollama generation failed: ${error.message}`);
		}
	}

	async *generateStream(
		prompt: string,
		options: GenerateOptions = {},
	): AsyncIterable<string> {
		const stream = await this.client.generate({
			model: options.model || this.defaultModel,
			prompt,
			system: options.systemPrompt,
			stream: true,
			options: {
				temperature: options.temperature ?? 0.7,
				num_predict: options.maxTokens ?? 2048,
			},
		});

		for await (const chunk of stream) {
			if (chunk.response) {
				yield chunk.response;
			}
		}
	}

	async checkHealth(): Promise<boolean> {
		try {
			await this.client.list();
			return true;
		} catch {
			return false;
		}
	}

	async embed(text: string, model?: string): Promise<number[]> {
		try {
			// Use qwen2.5:3b for embeddings if nomic-embed-text is not available
			// This is not ideal but works as a fallback
			const embedModel = model || "nomic-embed-text";

			try {
				const response = await this.client.embeddings({
					model: embedModel,
					prompt: text,
				});
				return response.embedding;
			} catch (err: any) {
				if (err.message?.includes("not found")) {
					console.warn(
						`⚠️  ${embedModel} not available, using ${this.defaultModel} for embeddings`,
					);
					// Fallback: use the chat model to generate a "pseudo-embedding"
					// This is a workaround when proper embedding models aren't available
					const response = await this.client.embeddings({
						model: this.defaultModel,
						prompt: text,
					});
					return response.embedding;
				}
				throw err;
			}
		} catch (error: any) {
			console.error("Ollama embed error:", error.message);
			throw new Error(`Ollama embedding failed: ${error.message}`);
		}
	}

	async ensureModel(model: string): Promise<boolean> {
		try {
			const models = await this.client.list();
			const hasModel = models.models.some(
				(m: any) => m.name === model || m.name.startsWith(model),
			);

			if (!hasModel) {
				console.log(`📥 Pulling model ${model}...`);
				await this.client.pull({ model, stream: false });
				console.log(`✅ Model ${model} ready`);
			}

			return true;
		} catch (error) {
			console.error(`❌ Failed to ensure model ${model}:`, error);
			return false;
		}
	}
}
