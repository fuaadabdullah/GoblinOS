// Memory types

export enum MemoryType {
	SHORT_TERM = "short-term",
	WORKING = "working",
	LONG_TERM = "long-term",
	EPISODIC = "episodic",
	ENTITY = "entity",
}

export enum MemoryImportance {
	LOW = "low",
	MEDIUM = "medium",
	HIGH = "high",
	CRITICAL = "critical",
}

export interface Memory {
	id: string;
	type: MemoryType;
	content: string;
	importance: MemoryImportance;
	timestamp: Date;
	metadata?: Record<string, unknown>;
}

export interface ShortTermConfig {
	maxMessages: number;
	ttlSeconds: number;
}

export interface WorkingConfig {
	maxEntries: number;
	ttlSeconds: number;
}

export interface LongTermConfig {
	enabled: boolean;
	dbPath: string;
	vectorDbPath: string;
	vectorDimensions: number;
	pineconeApiKey?: string;
	pineconeIndexName?: string;
	embeddingProvider?: "ollama" | "openai";
	embeddingModel?: string;
}

export interface EntityConfig {
	enabled: boolean;
	minConfidence: number;
	maxEntities: number;
}

export interface EpisodeConfig {
	enabled: boolean;
	autoSummarize: boolean;
	minMessagesPerEpisode: number;
	maxEpisodes: number;
}

export interface VectorSearchConfig {
	enabled: boolean;
	embeddingProvider: string;
	embeddingModel: string;
	topK: number;
	minSimilarity: number;
	pineconeApiKey?: string;
	pineconeIndexName?: string;
}

export interface MemoryManagerConfig {
	shortTerm: ShortTermConfig;
	working: WorkingConfig;
	longTerm: LongTermConfig;
	entities: EntityConfig;
	episodes: EpisodeConfig;
	vectorSearch: VectorSearchConfig;
}
