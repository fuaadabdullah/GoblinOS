import type { OllamaProvider } from "./providers/ollama-provider.js";
import type { RAGDocument, RAGIndex, RAGSearchResult } from "./rag/index.js";
import { createRAGIndex } from "./rag/index.js";

export class RAGService {
	private index: RAGIndex;
	private provider: OllamaProvider;

	constructor(provider: OllamaProvider) {
		this.provider = provider;
		this.index = createRAGIndex(async (text: string) => {
			if (!this.provider.embed) {
				throw new Error("Provider does not support embeddings");
			}
			return await this.provider.embed(text);
		});
	}

	async addDocument(
		content: string,
		metadata?: Record<string, unknown>,
	): Promise<RAGDocument> {
		return await this.index.addDocument(content, metadata);
	}

	async search(query: string, limit = 5): Promise<RAGSearchResult[]> {
		return await this.index.search(query, limit);
	}

	async deleteDocument(id: string): Promise<void> {
		return await this.index.deleteDocument(id);
	}

	async clear(): Promise<void> {
		return await this.index.clear();
	}
}

export type { RAGDocument, RAGSearchResult };
