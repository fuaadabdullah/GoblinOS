// RAG (Retrieval Augmented Generation) implementation

export interface RAGDocument {
	id: string;
	content: string;
	metadata?: Record<string, unknown>;
	embedding?: number[];
	timestamp: number;
}

export interface RAGSearchResult {
	document: RAGDocument;
	score: number;
}

export interface RAGIndex {
	addDocument(
		content: string,
		metadata?: Record<string, unknown>,
	): Promise<RAGDocument>;
	search(query: string, limit?: number): Promise<RAGSearchResult[]>;
	deleteDocument(id: string): Promise<void>;
	clear(): Promise<void>;
}

export function createRAGIndex(
	embeddingProvider: (text: string) => Promise<number[]>,
): RAGIndex {
	const documents: RAGDocument[] = [];

	function cosineSimilarity(a: number[], b: number[]): number {
		if (a.length !== b.length) return 0;

		let dotProduct = 0;
		let normA = 0;
		let normB = 0;

		for (let i = 0; i < a.length; i++) {
			dotProduct += a[i] * b[i];
			normA += a[i] * a[i];
			normB += b[i] * b[i];
		}

		return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
	}

	return {
		async addDocument(
			content: string,
			metadata?: Record<string, unknown>,
		): Promise<RAGDocument> {
			const embedding = await embeddingProvider(content);
			const doc: RAGDocument = {
				id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
				content,
				metadata,
				embedding,
				timestamp: Date.now(),
			};
			documents.push(doc);
			return doc;
		},

		async search(query: string, limit = 5): Promise<RAGSearchResult[]> {
			const queryEmbedding = await embeddingProvider(query);

			const results = documents
				.map((doc) => ({
					document: doc,
					score: doc.embedding
						? cosineSimilarity(queryEmbedding, doc.embedding)
						: 0,
				}))
				.sort((a, b) => b.score - a.score)
				.slice(0, limit);

			return results;
		},

		async deleteDocument(id: string): Promise<void> {
			const index = documents.findIndex((d) => d.id === id);
			if (index !== -1) {
				documents.splice(index, 1);
			}
		},

		async clear(): Promise<void> {
			documents.length = 0;
		},
	};
}
