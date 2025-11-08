// Long-term memory - persistent storage (in-memory implementation for tests)

import type { MemoryImportance, MemoryType } from "./types";

type Fact = {
	id: string;
	content: string;
	type: MemoryType;
	importance: MemoryImportance;
	accessCount: number;
	tags?: string[];
	createdAt: number;
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

	constructor(_config?: {
		enabled?: boolean;
		dbPath?: string;
		vectorDbPath?: string;
		vectorDimensions?: number;
	}) {}

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
		return id;
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

	deleteMemory(id: string): boolean {
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
		};
	}

	clearAll(): void {
		this.facts.clear();
		this.entities.clear();
		this.episodes.clear();
	}

	async close(): Promise<void> {
		// no-op for in-memory
	}
}
