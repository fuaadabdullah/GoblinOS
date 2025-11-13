// Long-term memory - persistent storage with vector search

import type { MemoryImportance, MemoryType } from "./types.js";
import { PineconeAdapter } from "../adapters/pinecone.js";
import { createEmbeddingProvider, type EmbeddingProvider } from "../providers/embeddings.js";

type Fact = {
	id: string;
	content: string;
	type: MemoryType;
	importance: MemoryImportance;
	accessCount: number;
	tags?: string[];
	createdAt: number;
	vectorId?: string; // Reference to vector in Pinecone
};

type Entity = {
	id: string;
	name: string;
	type: string;
	attributes: Record<string, unknown>;
	firstMentioned: number;
	lastMentioned: number;
	mentionCount: number;
	confidence: number;
};

type Episode = {
	id: string;
	title: string;
	summary: string;
	participants: string[];
	startTime: number;
	endTime: number;
	tags: string[];
	entities: string[];
	importance: MemoryImportance;
	messages: Array<{ role: string; content: string }>;
};

export class LongTermMemory {
	private facts = new Map<string, Fact>();
	private entities = new Map<string, Entity>();
	private episodes = new Map<string, Episode>();
	private pineconeAdapter?: PineconeAdapter;
	private embeddingProvider?: EmbeddingProvider;

	constructor(config?: {
		enabled?: boolean;
		dbPath?: string;
		vectorDbPath?: string;
		vectorDimensions?: number;
		pineconeApiKey?: string;
		pineconeIndexName?: string;
		embeddingProvider?: 'ollama' | 'openai';
		embeddingModel?: string;
	}) {
		if (config?.enabled && config.pineconeApiKey && config.pineconeIndexName) {
			this.initializeVectorSearch({
				pineconeApiKey: config.pineconeApiKey,
				pineconeIndexName: config.pineconeIndexName,
				vectorDimensions: config.vectorDimensions,
				embeddingProvider: config.embeddingProvider,
				embeddingModel: config.embeddingModel,
			});
		}
	}

	private async initializeVectorSearch(config: {
		pineconeApiKey: string;
		pineconeIndexName: string;
		vectorDimensions?: number;
		embeddingProvider?: 'ollama' | 'openai';
		embeddingModel?: string;
	}) {
		try {
			// Initialize embedding provider
			const providerType = config.embeddingProvider || 'ollama';
			const providerConfig = providerType === 'ollama'
				? { model: config.embeddingModel || 'qwen2.5:3b' }
				: { apiKey: process.env.OPENAI_API_KEY!, model: config.embeddingModel || 'text-embedding-3-small' };

			this.embeddingProvider = createEmbeddingProvider(providerType, providerConfig);

			// Initialize Pinecone adapter
			this.pineconeAdapter = new PineconeAdapter({
				apiKey: config.pineconeApiKey,
				indexName: config.pineconeIndexName,
				dimension: config.vectorDimensions || this.embeddingProvider.dimension,
			});

			await this.pineconeAdapter.initialize();
			console.log('Vector search initialized for long-term memory');
		} catch (error) {
			console.error('Failed to initialize vector search:', error);
			// Continue without vector search
		}
	}

	// Facts (memories)
	addMemory(input: {
		content: string;
		type: MemoryType;
		importance: MemoryImportance;
		accessCount: number;
		tags?: string[];
	}): string {
		const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		const fact: Fact = {
			id,
			content: input.content,
			type: input.type,
			importance: input.importance,
			accessCount: input.accessCount,
			tags: input.tags,
			createdAt: Date.now(),
		};
		this.facts.set(id, fact);

		// Generate and store vector embedding asynchronously
		if (this.pineconeAdapter && this.embeddingProvider) {
			this.storeEmbedding(fact).catch(error => {
				console.error('Failed to store embedding for memory:', id, error);
			});
		}

		return id;
	}

	private async storeEmbedding(fact: Fact): Promise<void> {
		if (!this.pineconeAdapter || !this.embeddingProvider) return;

		try {
			const embedding = await this.embeddingProvider.generate(fact.content);
			const vectorId = `vec_${fact.id}`;

			await this.pineconeAdapter.store([{
				id: vectorId,
				values: embedding,
				metadata: {
					memoryId: fact.id,
					content: fact.content,
					type: fact.type,
					importance: fact.importance,
					tags: fact.tags || [],
					createdAt: fact.createdAt,
				}
			}]);

			// Update fact with vector reference
			fact.vectorId = vectorId;
		} catch (error) {
			console.error('Failed to generate/store embedding:', error);
		}
	}

	getMemory(id: string): Fact | undefined {
		return this.facts.get(id);
	}

	searchMemories(options: {
		query?: string;
		importance?: MemoryImportance;
		tags?: string[];
	}): Fact[] {
		const q = options.query?.toLowerCase();
		const results = Array.from(this.facts.values()).filter((f) => {
			if (options.importance && f.importance !== options.importance)
				return false;
			if (options.tags && options.tags.length) {
				const tags = f.tags || [];
				if (!options.tags.some((t) => tags.includes(t))) return false;
			}
			if (q) return f.content.toLowerCase().includes(q);
			return true;
		});
		return results;
	}

	/**
	 * Search memories using vector similarity
	 */
	async searchMemoriesByVector(query: string, options?: {
		topK?: number;
		minScore?: number;
		filter?: Record<string, any>;
	}): Promise<Array<{ fact: Fact; score: number }>> {
		if (!this.pineconeAdapter || !this.embeddingProvider) {
			// Fallback to text search if vector search not available
			const facts = this.searchMemories({ query });
			return facts.map(fact => ({ fact, score: 0.5 }));
		}

		try {
			const queryEmbedding = await this.embeddingProvider.generate(query);
			const searchResults = await this.pineconeAdapter.search(
				queryEmbedding,
				options?.topK || 10,
				options?.filter
			);

			const results: Array<{ fact: Fact; score: number }> = [];

			for (const result of searchResults) {
				if (options?.minScore && result.score < options.minScore) continue;

				const memoryId = result.metadata.memoryId as string;
				const fact = this.facts.get(memoryId);
				if (fact) {
					results.push({ fact, score: result.score });
				}
			}

			return results;
		} catch (error) {
			console.error('Vector search failed, falling back to text search:', error);
			const facts = this.searchMemories({ query });
			return facts.map(fact => ({ fact, score: 0.5 }));
		}
	}

	deleteMemory(id: string): boolean {
		const fact = this.facts.get(id);
		if (!fact) return false;

		// Delete from vector store if it exists
		if (fact.vectorId && this.pineconeAdapter) {
			this.pineconeAdapter.delete([fact.vectorId]).catch(error => {
				console.error('Failed to delete vector for memory:', id, error);
			});
		}

		return this.facts.delete(id);
	}

	// Entities
	addEntity(input: {
		name: string;
		type: string;
		attributes?: Record<string, unknown>;
		firstMentioned: number;
		lastMentioned: number;
		mentionCount: number;
		confidence: number;
	}): string {
		const id = `ent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		const entity: Entity = {
			id,
			name: input.name,
			type: input.type,
			attributes: input.attributes || {},
			firstMentioned: input.firstMentioned,
			lastMentioned: input.lastMentioned,
			mentionCount: input.mentionCount,
			confidence: input.confidence,
		};
		this.entities.set(id, entity);
		return id;
	}

	getEntity(id: string): Entity | undefined {
		return this.entities.get(id);
	}

	findEntityByName(name: string): Entity | undefined {
		const lower = name.toLowerCase();
		return Array.from(this.entities.values()).find(
			(e) => e.name.toLowerCase() === lower,
		);
	}

	updateEntity(
		id: string,
		updates: Partial<
			Pick<
				Entity,
				"type" | "attributes" | "lastMentioned" | "mentionCount" | "confidence"
			>
		>,
	): void {
		const e = this.entities.get(id);
		if (!e) return;
		this.entities.set(id, {
			...e,
			...updates,
			attributes: { ...(e.attributes || {}), ...(updates.attributes || {}) },
		});
	}

	searchEntities(query: string): Entity[] {
		const q = query.toLowerCase();
		return Array.from(this.entities.values()).filter((e) =>
			e.name.toLowerCase().includes(q),
		);
	}

	getEntitiesByType(type: string): Entity[] {
		return Array.from(this.entities.values()).filter((e) => e.type === type);
	}

	// Episodes
	addEpisode(input: {
		title: string;
		summary: string;
		participants: string[];
		startTime: number;
		endTime: number;
		tags: string[];
		entities: string[];
		importance: MemoryImportance;
		messages: Array<{ role: string; content: string }>;
	}): string {
		const id = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		const episode: Episode = { id, ...input };
		this.episodes.set(id, episode);
		return id;
	}

	getEpisode(id: string): Episode | undefined {
		return this.episodes.get(id);
	}

	searchEpisodes(query: string): Episode[] {
		const q = query.toLowerCase();
		return Array.from(this.episodes.values()).filter(
			(e) =>
				e.title.toLowerCase().includes(q) ||
				e.summary.toLowerCase().includes(q),
		);
	}

	getRecentEpisodes(limit = 10): Episode[] {
		return Array.from(this.episodes.values())
			.sort((a, b) => b.endTime - a.endTime)
			.slice(0, limit);
	}

	// Stats & maintenance
	getStats() {
		return {
			memories: this.facts.size,
			entities: this.entities.size,
			episodes: this.episodes.size,
			vectorSearchEnabled: !!this.pineconeAdapter,
		};
	}

	clearAll(): void {
		this.facts.clear();
		this.entities.clear();
		this.episodes.clear();
	}

	async close(): Promise<void> {
		if (this.pineconeAdapter) {
			await this.pineconeAdapter.close();
		}
		// no-op for in-memory storage
	}
}
