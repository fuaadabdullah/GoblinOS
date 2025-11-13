// Embedding provider for generating vector embeddings

export interface EmbeddingProvider {
	generate(text: string): Promise<number[]>;
	generateBatch(texts: string[]): Promise<number[][]>;
	dimension: number;
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
	dimension = 1024; // qwen2.5:3b dimension

	constructor(private model: string = "qwen2.5:3b") {}

	async generate(text: string): Promise<number[]> {
		const { embedWithOllama } = await import("../providers/ollama.js");
		return embedWithOllama(text, this.model);
	}

	async generateBatch(texts: string[]): Promise<number[][]> {
		const embeddings: number[][] = [];
		for (const text of texts) {
			const embedding = await this.generate(text);
			embeddings.push(embedding);
		}
		return embeddings;
	}
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
	dimension = 1536; // text-embedding-3-small dimension

	constructor(
		private apiKey: string,
		private model: string = "text-embedding-3-small"
	) {}

	async generate(text: string): Promise<number[]> {
		const response = await fetch('https://api.openai.com/v1/embeddings', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				input: text,
				model: this.model,
			}),
		});

		if (!response.ok) {
			throw new Error(`OpenAI API error: ${response.statusText}`);
		}

		const data: any = await response.json();
		return data.data[0].embedding;
	}

	async generateBatch(texts: string[]): Promise<number[][]> {
		const response = await fetch('https://api.openai.com/v1/embeddings', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				input: texts,
				model: this.model,
			}),
		});

		if (!response.ok) {
			throw new Error(`OpenAI API error: ${response.statusText}`);
		}

		const data: any = await response.json();
		return data.data.map((item: any) => item.embedding);
	}
}

export function createEmbeddingProvider(type: 'ollama' | 'openai', config: any): EmbeddingProvider {
	switch (type) {
		case 'ollama':
			return new OllamaEmbeddingProvider(config.model);
		case 'openai':
			return new OpenAIEmbeddingProvider(config.apiKey, config.model);
		default:
			throw new Error(`Unknown embedding provider type: ${type}`);
	}
}
