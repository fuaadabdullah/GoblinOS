import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShortTermMemory } from "../src/memory/short-term";
import { MemoryImportance } from "../src/memory/types";

describe("ShortTermMemory", () => {
	let memory: ShortTermMemory;

	beforeEach(() => {
		memory = new ShortTermMemory({
			maxMessages: 5,
			ttlSeconds: 3600,
		});
	});

	describe("add", () => {
		it("should add a message", () => {
			memory.add({
				role: "user",
				content: "Hello",
			});

			const messages = memory.getAll();
			expect(messages).toHaveLength(1);
			expect(messages[0].content).toBe("Hello");
			expect(messages[0].role).toBe("user");
		});

		it("should convert to memory entries with correct importance", () => {
			memory.add({
				role: "user",
				content: "This is an error message",
			});

			const entries = memory.toMemoryEntries();
			expect(entries).toHaveLength(1);
			expect(entries[0].importance).toBe(MemoryImportance.HIGH);
		});

		it("should respect maxMessages capacity", () => {
			for (let i = 0; i < 10; i++) {
				memory.add({
					role: "user",
					content: `Message ${i}`,
				});
			}

			const messages = memory.getAll();
			expect(messages).toHaveLength(5);
			expect(messages[0].content).toBe("Message 5"); // Oldest kept
			expect(messages[4].content).toBe("Message 9"); // Newest
		});

		it("should cleanup expired messages", () => {
			vi.useFakeTimers();

			memory.add({
				role: "user",
				content: "Old message",
			});

			// Advance time by 2 hours (past the 1 hour TTL)
			vi.advanceTimersByTime(2 * 60 * 60 * 1000);

			memory.add({
				role: "user",
				content: "New message",
			});

			const messages = memory.getAll();
			expect(messages).toHaveLength(1);
			expect(messages[0].content).toBe("New message");

			vi.useRealTimers();
		});
	});

	describe("getRecent", () => {
		beforeEach(() => {
			memory.add({ role: "user", content: "User 1" });
			memory.add({ role: "assistant", content: "Assistant 1" });
			memory.add({ role: "user", content: "User 2" });
			memory.add({ role: "assistant", content: "Assistant 2" });
		});

		it("should return recent messages", () => {
			const recent = memory.getRecent(2);
			expect(recent).toHaveLength(2);
			expect(recent[0].content).toBe("User 2");
			expect(recent[1].content).toBe("Assistant 2");
		});

		it("should filter by role", () => {
			const userMessages = memory.getRecent(10, "user");
			expect(userMessages).toHaveLength(2);
			expect(userMessages.every((m) => m.role === "user")).toBe(true);
		});
	});

	describe("search", () => {
		beforeEach(() => {
			memory.add({ role: "user", content: "What is Kubernetes?" });
			memory.add({
				role: "assistant",
				content: "Kubernetes is a container orchestration platform.",
			});
			memory.add({ role: "user", content: "Tell me about Docker." });
		});

		it("should search by content", () => {
			const results = memory.search("Kubernetes");
			expect(results).toHaveLength(2);
			expect(results.some((r) => r.content.includes("Kubernetes"))).toBe(true);
		});

		it("should return empty array when no matches", () => {
			const results = memory.search("Python");
			expect(results).toHaveLength(0);
		});

		it("should be case-insensitive", () => {
			const results = memory.search("kubernetes");
			expect(results.length).toBeGreaterThan(0);
		});
	});

	describe("clear", () => {
		it("should clear all messages", () => {
			memory.add({ role: "user", content: "Test" });
			expect(memory.getAll()).toHaveLength(1);

			memory.clear();
			expect(memory.getAll()).toHaveLength(0);
		});
	});

	describe("getStats", () => {
		it("should return correct stats", () => {
			memory.add({ role: "user", content: "Message 1" });
			memory.add({ role: "user", content: "Message 2" });

			const stats = memory.getStats();
			expect(stats.count).toBe(2);
			expect(stats.oldestTimestamp).not.toBeNull();
			expect(typeof stats.oldestTimestamp).toBe("number");
		});

		it("should return null timestamps for empty memory", () => {
			const stats = memory.getStats();
			expect(stats.count).toBe(0);
			expect(stats.oldestTimestamp).toBeNull();
			expect(stats.newestTimestamp).toBeNull();
		});
	});

	describe("toMemoryEntries", () => {
		it("should convert messages to memory entries", () => {
			memory.add({ role: "user", content: "Test message" });

			const entries = memory.toMemoryEntries();
			expect(entries).toHaveLength(1);
			expect(entries[0].content).toBe("Test message");
			expect(entries[0].type).toBe("short-term");
			expect(entries[0].metadata?.role).toBe("user");
		});
	});
});
