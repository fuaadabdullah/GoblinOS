// Short-term memory for recent messages

import type { Memory, ShortTermConfig } from "./types";
import { MemoryImportance, MemoryType } from "./types";

export interface Message {
	role: "user" | "assistant" | "system";
	content: string;
	timestamp?: number;
}

export class ShortTermMemory {
	private messages: (Message & { timestamp: number })[] = [];
	private readonly maxMessages: number;
	private readonly ttlSeconds: number;

	constructor(config: ShortTermConfig) {
		this.maxMessages = config.maxMessages;
		this.ttlSeconds = config.ttlSeconds;
	}

	add(message: Message): void {
		const timestampedMessage = {
			...message,
			timestamp: message.timestamp || Date.now(),
		};

		this.messages.push(timestampedMessage);

		// Enforce capacity
		while (this.messages.length > this.maxMessages) {
			this.messages.shift();
		}

		// Clean up expired messages
		this.cleanupExpired();
	}

	getRecent(count?: number, role?: "user" | "assistant" | "system"): Message[] {
		this.cleanupExpired();

		let filtered = this.messages;
		if (role) {
			filtered = this.messages.filter((m) => m.role === role);
		}

		if (count) {
			return filtered.slice(-count);
		}

		return filtered;
	}

	getAll(): Message[] {
		this.cleanupExpired();
		return this.messages;
	}

	search(query: string): Message[] {
		this.cleanupExpired();
		const lowerQuery = query.toLowerCase();
		return this.messages.filter((m) =>
			m.content.toLowerCase().includes(lowerQuery),
		);
	}

	clear(): void {
		this.messages = [];
	}

	getStats() {
		this.cleanupExpired();

		if (this.messages.length === 0) {
			return {
				count: 0,
				oldestTimestamp: null,
				newestTimestamp: null,
				userMessages: 0,
				assistantMessages: 0,
				systemMessages: 0,
			};
		}

		return {
			count: this.messages.length,
			oldestTimestamp: this.messages[0]?.timestamp || null,
			newestTimestamp:
				this.messages[this.messages.length - 1]?.timestamp || null,
			userMessages: this.messages.filter((m) => m.role === "user").length,
			assistantMessages: this.messages.filter((m) => m.role === "assistant")
				.length,
			systemMessages: this.messages.filter((m) => m.role === "system").length,
		};
	}

	toMemoryEntries(): Memory[] {
		return this.messages.map((msg) => ({
			id: `msg_${msg.timestamp}`,
			type: MemoryType.SHORT_TERM,
			content: msg.content,
			importance: this.calculateImportance(msg.content),
			timestamp: new Date(msg.timestamp),
			metadata: { role: msg.role },
		}));
	}

	private cleanupExpired(): void {
		const now = Date.now();
		const cutoff = now - this.ttlSeconds * 1000;

		this.messages = this.messages.filter((m) => m.timestamp >= cutoff);
	}

	private calculateImportance(content: string): MemoryImportance {
		const lowerContent = content.toLowerCase();

		if (
			lowerContent.includes("error") ||
			lowerContent.includes("critical") ||
			lowerContent.includes("urgent")
		) {
			return MemoryImportance.HIGH;
		}

		if (lowerContent.includes("important") || lowerContent.includes("note")) {
			return MemoryImportance.MEDIUM;
		}

		return MemoryImportance.LOW;
	}
}
