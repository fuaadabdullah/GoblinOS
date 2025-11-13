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

// Document chunking
/**
 * Options for text chunking.
 *
 * Constraints:
 * - chunkSize: integer >= 1 (values <= 0 are treated as 1)
 * - overlap: integer such that 0 <= overlap < chunkSize
 *
 * Notes:
 * - At runtime, values are sanitized and clamped to the valid range to prevent
 *   infinite loops and excessive memory usage.
 */
export interface ChunkOptions {
	/** Desired chunk size in characters. Must be >= 1. */
	chunkSize?: number;
	/**
	 * Number of overlapping characters between consecutive chunks.
	 * Must satisfy 0 <= overlap < chunkSize. Values outside this range will be
	 * clamped internally to ensure forward progress and avoid OOM conditions.
	 */
	overlap?: number;
}

export interface Chunk {
	content: string;
	index: number;
}

/**
 * Splits a string into overlapping chunks.
 *
 * Overlap safety contract: 0 <= overlap < chunkSize. Any provided values outside
 * this range are clamped at runtime to safe defaults. This makes the function
 * resilient to misuse while still documenting the intended constraints.
 */
export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
	// Sanitize options to avoid infinite loops and ensure progress
	const rawChunkSize = options.chunkSize ?? 500;
	const effectiveChunkSize = Math.max(1, Math.floor(rawChunkSize));
	const rawOverlap = options.overlap ?? 50;
	// Overlap must be >= 0 and strictly less than chunk size to ensure forward progress
	const safeOverlap = Math.max(
		0,
		Math.min(Math.floor(rawOverlap), effectiveChunkSize - 1),
	);

	const chunks: Chunk[] = [];

	if (text.length <= effectiveChunkSize) {
		return [{ content: text, index: 0 }];
	}

	let position = 0;
	let index = 0;
	const advance = Math.max(1, effectiveChunkSize - safeOverlap);

	while (position < text.length) {
		const end = Math.min(position + effectiveChunkSize, text.length);
		const content = text.slice(position, end);

		chunks.push({ content, index });

		position += advance;
		index++;
	}

	return chunks;
}

// Vector store
export interface VectorStoreDocument {
	id: string;
	content: string;
	embedding: number[];
	timestamp: number;
}

export interface VectorStoreSearchOptions {
	k?: number;
}

export interface VectorStoreSearchResult {
	document: VectorStoreDocument;
	score: number;
}

export interface VectorStoreStats {
	totalDocuments: number;
	averageEmbeddingSize: number;
}

export interface VectorStore {
	add(doc: VectorStoreDocument): void;
	search(
		embedding: number[],
		options?: VectorStoreSearchOptions,
	): VectorStoreSearchResult[];
	size(): number;
	stats(): VectorStoreStats;
}

export function createVectorStore(): VectorStore {
	const documents: VectorStoreDocument[] = [];

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
		add(doc: VectorStoreDocument): void {
			documents.push(doc);
		},

		search(
			embedding: number[],
			options?: VectorStoreSearchOptions,
		): VectorStoreSearchResult[] {
			const { k = 5 } = options || {};

			const results = documents
				.map((doc) => ({
					document: doc,
					score: cosineSimilarity(embedding, doc.embedding),
				}))
				.sort((a, b) => b.score - a.score)
				.slice(0, k);

			return results;
		},

		size(): number {
			return documents.length;
		},

		stats(): VectorStoreStats {
			const avgSize =
				documents.length > 0
					? documents.reduce((sum, doc) => sum + doc.embedding.length, 0) /
						documents.length
					: 0;

			return {
				totalDocuments: documents.length,
				averageEmbeddingSize: avgSize,
			};
		},
	};
}

// RAG chat (stub)
export async function ragChat(
	_query: string,
	_store: VectorStore,
	_options?: { k?: number },
): Promise<string> {
	// This would integrate with LLM provider
	// For now, just a stub
	return "RAG chat response";
}
