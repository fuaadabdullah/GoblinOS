// Memory management system for Overmind

import { LongTermMemory } from "./long-term";
import { type Message, ShortTermMemory } from "./short-term";
import type { Memory, MemoryConfig, MemoryImportance } from "./types";
import { MemoryImportance as ImportanceEnum, MemoryType } from "./types";
import { WorkingMemory } from "./working";

export * from "./types";
export { ShortTermMemory, WorkingMemory, LongTermMemory };

export interface MemoryManager {
	// Message methods (short-term memory)
	addMessage(message: Message): void;
	getRecentMessages(
		count?: number,
		role?: "user" | "assistant" | "system",
	): Message[];
	getConversationHistory(): Message[];
	clearConversation(): void;

	// Context methods (working memory)
	setContext(key: string, value: unknown, importance?: MemoryImportance): void;
	getContext(key: string): unknown;
	hasContext(key: string): boolean;
	deleteContext(key: string): boolean;
	clearWorkingMemory(): void;

	// Long-term memory methods (facts)
	storeFact(
		content: string,
		options?: { tags?: string[]; importance?: MemoryImportance },
	): Promise<string>;
	search(options: {
		query?: string;
		importance?: MemoryImportance;
		tags?: string[];
	}): Promise<
		Array<{
			entry: { id: string; content: string; importance: MemoryImportance };
		}>
	>;

	// Entities
	trackEntity(
		name: string,
		type: string,
		attributes?: Record<string, unknown>,
	): Promise<string>;
	getEntity(id: string): Promise<
		| {
				id: string;
				name: string;
				type: string;
				attributes: Record<string, unknown>;
				firstMentioned: number;
				lastMentioned: number;
				mentionCount: number;
				confidence: number;
		  }
		| undefined
	>;
	searchEntities(
		query: string,
	): Promise<Array<{ id: string; name: string; type: string }>>;

	// Episodes
	createEpisode(
		title: string,
		summary: string,
		tags: string[],
	): Promise<string>;
	getEpisode(id: string): Promise<
		| {
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
		  }
		| undefined
	>;
	searchEpisodes(query: string): Promise<Array<{ id: string; title: string }>>;
	getRecentEpisodes(
		limit: number,
	): Promise<Array<{ id: string; title: string }>>;

	// Stats and management
	getStats(): {
		shortTerm: ReturnType<ShortTermMemory["getStats"]>;
		working: ReturnType<WorkingMemory["getStats"]>;
		longTerm: { memories: number; entities: number; episodes: number };
	};
	shutdown(): Promise<void>;
	consolidate(): Promise<void>;

	// Legacy interface (kept for compatibility)
	addMemory(memory: Memory): Promise<void>;
	getMemories(options?: { type?: string; limit?: number }): Promise<Memory[]>;
	close(): Promise<void>;
}

const DEFAULT_CONFIG: MemoryConfig = {
	shortTerm: { maxMessages: 100, ttlSeconds: 3600 },
	working: { maxEntries: 100, ttlSeconds: 7200 },
	longTerm: {
		enabled: true,
		dbPath: ":memory:",
		vectorDbPath: ":memory:",
		vectorDimensions: 1536,
	},
	entities: { enabled: true, minConfidence: 0.7, maxEntities: 1000 },
	episodes: {
		enabled: true,
		autoSummarize: true,
		minMessagesPerEpisode: 5,
		maxEpisodes: 100,
	},
	vectorSearch: {
		enabled: false,
		embeddingProvider: "openai",
		embeddingModel: "text-embedding-3-small",
		topK: 5,
		minSimilarity: 0.7,
	},
};

export function createMemoryManager(
	config?: Partial<MemoryConfig>,
): MemoryManager {
	const merged: MemoryConfig = {
		...DEFAULT_CONFIG,
		...config,
		shortTerm: { ...DEFAULT_CONFIG.shortTerm, ...(config?.shortTerm || {}) },
		working: { ...DEFAULT_CONFIG.working, ...(config?.working || {}) },
		longTerm: { ...DEFAULT_CONFIG.longTerm, ...(config?.longTerm || {}) },
		entities: { ...DEFAULT_CONFIG.entities, ...(config?.entities || {}) },
		episodes: { ...DEFAULT_CONFIG.episodes, ...(config?.episodes || {}) },
		vectorSearch: {
			...DEFAULT_CONFIG.vectorSearch,
			...(config?.vectorSearch || {}),
		},
	};

	const shortTerm = new ShortTermMemory(merged.shortTerm);
	const working = new WorkingMemory(merged.working);
	const longTerm = new LongTermMemory(merged.longTerm);

	return {
		// Short-term memory methods
		addMessage(message: Message): void {
			shortTerm.add(message);
		},

		getRecentMessages(
			count?: number,
			role?: "user" | "assistant" | "system",
		): Message[] {
			return shortTerm.getRecent(count, role);
		},

		getConversationHistory(): Message[] {
			return shortTerm.getAll();
		},

		clearConversation(): void {
			shortTerm.clear();
		},

		// Working memory methods
		setContext(
			key: string,
			value: unknown,
			importance?: MemoryImportance,
		): void {
			working.set(key, value, importance);
		},

		getContext(key: string): unknown {
			return working.get(key);
		},

		hasContext(key: string): boolean {
			return working.has(key);
		},

		deleteContext(key: string): boolean {
			return working.delete(key);
		},

		clearWorkingMemory(): void {
			working.clear();
		},

		// Long-term memory methods (facts)
		async storeFact(
			content: string,
			options?: { tags?: string[]; importance?: MemoryImportance },
		) {
			return longTerm.addMemory({
				content,
				type: MemoryType.LONG_TERM,
				importance: options?.importance ?? ImportanceEnum.MEDIUM,
				accessCount: 0,
				tags: options?.tags,
			});
		},

		async search(options: {
			query?: string;
			importance?: MemoryImportance;
			tags?: string[];
		}) {
			const facts = longTerm.searchMemories(options);
			return facts.map((f) => ({
				entry: { id: f.id, content: f.content, importance: f.importance },
			}));
		},

		// Entities
		async trackEntity(
			name: string,
			type: string,
			attributes?: Record<string, unknown>,
		) {
			const existing = longTerm.findEntityByName(name);
			if (existing) {
				longTerm.updateEntity(existing.id, { attributes });
				return existing.id;
			}
			return longTerm.addEntity({
				name,
				type,
				attributes,
				firstMentioned: Date.now(),
				lastMentioned: Date.now(),
				mentionCount: 1,
				confidence: 0.8,
			});
		},

		async getEntity(id: string) {
			return longTerm.getEntity(id);
		},

		async searchEntities(query: string) {
			return longTerm.searchEntities(query);
		},

		// Episodes
		async createEpisode(title: string, summary: string, tags: string[]) {
			// Use current conversation as messages
			const messages = shortTerm
				.getAll()
				.map((m) => ({ role: m.role, content: m.content }));
			return longTerm.addEpisode({
				title,
				summary,
				participants: ["user", "assistant"],
				startTime: Date.now(),
				endTime: Date.now(),
				tags,
				entities: [],
				importance: ImportanceEnum.MEDIUM,
				messages,
			});
		},

		async getEpisode(id: string) {
			return longTerm.getEpisode(id);
		},

		async searchEpisodes(query: string) {
			return longTerm.searchEpisodes(query);
		},

		async getRecentEpisodes(limit: number) {
			return longTerm.getRecentEpisodes(limit);
		},

		async consolidate(): Promise<void> {
			const messages = shortTerm.getAll();
			for (const m of messages) {
				const text = m.content.toLowerCase();
				const isImportant = /(critical|very important|urgent|error)/.test(text);
				if (isImportant) {
					await this.storeFact(m.content, { importance: ImportanceEnum.HIGH });
				}
			}
		},

		getStats() {
			return {
				shortTerm: shortTerm.getStats(),
				working: working.getStats(),
				longTerm: longTerm.getStats(),
			};
		},

		async shutdown(): Promise<void> {
			await longTerm.close();
		},

		// Legacy interface for backward compatibility
		async addMemory(memory: Memory): Promise<void> {
			await this.storeFact(memory.content, {
				importance: memory.importance as MemoryImportance,
			});
		},

		async getMemories(options?: { type?: string; limit?: number }): Promise<
			Memory[]
		> {
			const results = await this.search({});
			const items = results.map((r) => ({
				id: r.entry.id,
				type: MemoryType.LONG_TERM,
				content: r.entry.content,
				importance: r.entry.importance,
				timestamp: new Date(),
			}));
			return options?.limit ? items.slice(0, options.limit) : items;
		},

		async close(): Promise<void> {
			await this.shutdown();
		},
	};
}
