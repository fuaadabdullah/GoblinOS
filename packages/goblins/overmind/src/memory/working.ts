// Working memory - key-value store for task context

import type { Memory, WorkingConfig } from "./types.js";
import { MemoryImportance, MemoryType } from "./types.js";

interface Entry {
	value: unknown;
	importance: MemoryImportance;
	timestamp: number;
	accessCount: number;
}

export class WorkingMemory {
	private storage: Map<string, Entry> = new Map();
	private readonly maxEntries: number;
	private readonly ttlSeconds: number;

	constructor(config: WorkingConfig) {
		this.maxEntries = config.maxEntries;
		this.ttlSeconds = config.ttlSeconds;
	}

	set(
		key: string,
		value: unknown,
		importance: MemoryImportance = MemoryImportance.MEDIUM,
	): void {
		// Clean up expired entries first
		this.cleanupExpired();

		// Check capacity and evict if needed
		if (this.storage.size >= this.maxEntries && !this.storage.has(key)) {
			this.evictLeastImportant();
		}

		this.storage.set(key, {
			value,
			importance,
			timestamp: Date.now(),
			accessCount: 0,
		});
	}

	get(key: string): unknown {
		const entry = this.storage.get(key);
		if (!entry) return undefined;

		// Check if expired
		if (this.isExpired(entry)) {
			this.storage.delete(key);
			return undefined;
		}

		// Increment access count
		entry.accessCount++;
		return entry.value;
	}

	has(key: string): boolean {
		return this.storage.has(key) && !this.isExpired(this.storage.get(key)!);
	}

	delete(key: string): boolean {
		return this.storage.delete(key);
	}

	getEntry(key: string): (Entry & { id: string }) | undefined {
		const entry = this.storage.get(key);
		if (!entry) return undefined;
		if (this.isExpired(entry)) {
			this.storage.delete(key);
			return undefined;
		}
		return { id: key, ...entry };
	}

	getAll(): Array<Entry & { id: string }> {
		this.cleanupExpired();
		return Array.from(this.storage.entries()).map(([id, e]) => ({ id, ...e }));
	}

	search(options: {
		query?: string;
		importance?: MemoryImportance;
		timeRange?: { start?: number; end?: number };
	}): Memory[] {
		this.cleanupExpired();

		const results: Memory[] = [];
		const lowerQuery = options.query?.toLowerCase();

		for (const [key, entry] of this.storage.entries()) {
			// Filter by importance if specified
			if (options.importance && entry.importance !== options.importance)
				continue;

			// Filter by time range if specified
			if (options.timeRange?.start && entry.timestamp < options.timeRange.start)
				continue;
			if (options.timeRange?.end && entry.timestamp > options.timeRange.end)
				continue;

			// Search in key or value if query provided
			if (lowerQuery) {
				const valueStr = JSON.stringify(entry.value).toLowerCase();
				if (
					!key.toLowerCase().includes(lowerQuery) &&
					!valueStr.includes(lowerQuery)
				)
					continue;
			}

			results.push({
				id: key,
				type: MemoryType.WORKING,
				content: JSON.stringify(entry.value),
				importance: entry.importance,
				timestamp: new Date(entry.timestamp),
				metadata: { accessCount: entry.accessCount },
			});
		}

		return results;
	}

	clear(): void {
		this.storage.clear();
	}

	get size(): number {
		this.cleanupExpired();
		return this.storage.size;
	}

	getStats() {
		this.cleanupExpired();

		if (this.storage.size === 0) {
			return {
				count: 0,
				capacity: this.maxEntries,
				utilizationPercent: 0,
				highImportance: 0,
				mediumImportance: 0,
				lowImportance: 0,
				totalAccessCount: 0,
			};
		}

		let highCount = 0;
		let mediumCount = 0;
		let lowCount = 0;
		let totalAccess = 0;

		for (const entry of this.storage.values()) {
			totalAccess += entry.accessCount;

			switch (entry.importance) {
				case "high":
					highCount++;
					break;
				case "medium":
					mediumCount++;
					break;
				case "low":
					lowCount++;
					break;
			}
		}

		const count = this.storage.size;
		const utilizationPercent = (count / this.maxEntries) * 100;

		return {
			count,
			capacity: this.maxEntries,
			utilizationPercent,
			highImportance: highCount,
			mediumImportance: mediumCount,
			lowImportance: lowCount,
			totalAccessCount: totalAccess,
		};
	}

	private isExpired(entry: Entry): boolean {
		const now = Date.now();
		const cutoff = now - this.ttlSeconds * 1000;
		return entry.timestamp < cutoff;
	}

	private cleanupExpired(): void {
		for (const [key, entry] of this.storage.entries()) {
			if (this.isExpired(entry)) {
				this.storage.delete(key);
			}
		}
	}

	private evictLeastImportant(): void {
		const importanceOrder: Record<MemoryImportance, number> = {
			[MemoryImportance.LOW]: 0,
			[MemoryImportance.MEDIUM]: 1,
			[MemoryImportance.HIGH]: 2,
			[MemoryImportance.CRITICAL]: 3,
		};

		let leastImportantKey: string | undefined;
		let leastImportantEntry: Entry | undefined;

		for (const [key, entry] of this.storage.entries()) {
			if (
				!leastImportantEntry ||
				importanceOrder[entry.importance] <
					importanceOrder[leastImportantEntry.importance] ||
				(importanceOrder[entry.importance] ===
					importanceOrder[leastImportantEntry.importance] &&
					entry.accessCount < leastImportantEntry.accessCount)
			) {
				leastImportantKey = key;
				leastImportantEntry = entry;
			}
		}

		if (leastImportantKey) {
			this.storage.delete(leastImportantKey);
		}
	}
}
