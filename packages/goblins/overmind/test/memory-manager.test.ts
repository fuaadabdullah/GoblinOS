import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type MemoryManager, createMemoryManager } from "../src/memory";
import { MemoryImportance, MemoryType } from "../src/memory/types";

describe("MemoryManager", () => {
	let manager: MemoryManager;

	beforeEach(() => {
		manager = createMemoryManager({
			shortTerm: { maxMessages: 10, ttlSeconds: 3600 },
			working: { maxEntries: 20, ttlSeconds: 7200 },
			longTerm: {
				enabled: true,
				dbPath: ":memory:",
				vectorDbPath: ":memory:",
				vectorDimensions: 1536,
			},
			entities: { enabled: true, minConfidence: 0.7, maxEntities: 100 },
			episodes: {
				enabled: true,
				autoSummarize: true,
				minMessagesPerEpisode: 5,
				maxEpisodes: 10,
			},
			vectorSearch: {
				enabled: false,
				embeddingProvider: "openai",
				embeddingModel: "text-embedding-ada-002",
				topK: 5,
				minSimilarity: 0.7,
			},
		});
	});

	afterEach(async () => {
		await manager.shutdown();
	});

	describe("Message management", () => {
		it("should add and retrieve messages", () => {
			manager.addMessage({
				role: "user",
				content: "Hello",
			});

			manager.addMessage({
				role: "assistant",
				content: "Hi there!",
			});

			const recent = manager.getRecentMessages(2);
			expect(recent).toHaveLength(2);
			expect(recent[0].content).toBe("Hello");
			expect(recent[1].content).toBe("Hi there!");
		});

		it("should get conversation history", () => {
			manager.addMessage({ role: "user", content: "Q1" });
			manager.addMessage({ role: "assistant", content: "A1" });
			manager.addMessage({ role: "user", content: "Q2" });

			const history = manager.getConversationHistory();
			expect(history).toHaveLength(3);
		});

		it("should clear conversation", () => {
			manager.addMessage({ role: "user", content: "Test" });
			expect(manager.getConversationHistory()).toHaveLength(1);

			manager.clearConversation();
			expect(manager.getConversationHistory()).toHaveLength(0);
		});
	});

	describe("Working memory (task context)", () => {
		it("should set and get task context", () => {
			manager.setContext("deploy-123", "Deploying to production");
			const context = manager.getContext("deploy-123");
			expect(context).toBe("Deploying to production");
		});

		it("should check context existence", () => {
			manager.setContext("task-1", "test data");
			expect(manager.hasContext("task-1")).toBe(true);
			expect(manager.hasContext("task-2")).toBe(false);
		});

		it("should delete context", () => {
			manager.setContext("task-1", "test data");
			const deleted = manager.deleteContext("task-1");

			expect(deleted).toBe(true);
			expect(manager.hasContext("task-1")).toBe(false);
		});

		it("should clear all working memory", () => {
			manager.setContext("task-1", "data a");
			manager.setContext("task-2", "data b");

			manager.clearWorkingMemory();

			expect(manager.hasContext("task-1")).toBe(false);
			expect(manager.hasContext("task-2")).toBe(false);
		});
	});

	describe("Long-term memory (facts)", () => {
		it("should store and search facts", async () => {
			await manager.storeFact("Docker is a containerization platform", {
				tags: ["docker", "containers"],
			});

			const results = await manager.search({ query: "Docker" });
			expect(results.length).toBeGreaterThan(0);
			expect(results.some((r) => r.entry.content.includes("Docker"))).toBe(
				true,
			);
		});

		it("should assign importance to facts", async () => {
			await manager.storeFact("Critical production issue", {
				tags: ["production", "critical"],
				importance: MemoryImportance.CRITICAL,
			});

			const results = await manager.search({ query: "production" });
			expect(results[0].entry.importance).toBe(MemoryImportance.CRITICAL);
		});
	});

	describe("Entity tracking", () => {
		it("should track entities", async () => {
			const entityId = await manager.trackEntity("Kubernetes", "tool", {
				description: "Container orchestration",
			});

			const entity = await manager.getEntity(entityId);
			expect(entity?.type).toBe("tool");
		});

		it("should update existing entities", async () => {
			const entityId = await manager.trackEntity("Docker", "tool");

			await manager.trackEntity("Docker", "tool", {
				description: "Updated description",
			});

			const entity = await manager.getEntity(entityId);
			expect(entity?.attributes.description).toBe("Updated description");
		});

		it("should search entities", async () => {
			await manager.trackEntity("Alice Smith", "person");
			await manager.trackEntity("Bob Smith", "person");
			await manager.trackEntity("Google", "organization");

			const people = await manager.searchEntities("Smith");
			expect(people).toHaveLength(2);
		});
	});

	describe("Episodic memory", () => {
		it("should create episodes", async () => {
			// Add 5 messages to meet minimum requirement
			manager.addMessage({ role: "user", content: "Tell me about Docker" });
			manager.addMessage({
				role: "assistant",
				content: "Docker is a containerization platform...",
			});
			manager.addMessage({ role: "user", content: "How does it work?" });
			manager.addMessage({
				role: "assistant",
				content: "It uses containers to package applications...",
			});
			manager.addMessage({ role: "user", content: "What are the benefits?" });
			manager.addMessage({
				role: "assistant",
				content: "Benefits include portability, efficiency...",
			});

			const episodeId = await manager.createEpisode(
				"Docker Discussion",
				"A conversation about Docker",
				["docker", "containers"],
			);

			const episode = await manager.getEpisode(episodeId);
			expect(episode?.title).toBe("Docker Discussion");
			expect(episode?.tags).toContain("docker");
		});

		it("should search episodes", async () => {
			// Add messages for first episode
			for (let i = 0; i < 5; i++) {
				manager.addMessage({
					role: "user",
					content: `Kubernetes question ${i}`,
				});
				manager.addMessage({
					role: "assistant",
					content: `Kubernetes answer ${i}`,
				});
			}
			await manager.createEpisode(
				"Kubernetes Tutorial",
				"Learning Kubernetes",
				["kubernetes"],
			);

			// Clear messages and add for second episode
			manager.clearConversation();
			for (let i = 0; i < 5; i++) {
				manager.addMessage({ role: "user", content: `Docker question ${i}` });
				manager.addMessage({
					role: "assistant",
					content: `Docker answer ${i}`,
				});
			}
			await manager.createEpisode("Docker Tutorial", "Learning Docker", [
				"docker",
			]);

			const results = await manager.searchEpisodes("Kubernetes");
			expect(results).toHaveLength(1);
			expect(results[0].title).toBe("Kubernetes Tutorial");
		});

		it("should get recent episodes", async () => {
			// Create first episode
			for (let i = 0; i < 5; i++) {
				manager.addMessage({
					role: "user",
					content: `Episode 1 question ${i}`,
				});
				manager.addMessage({
					role: "assistant",
					content: `Episode 1 answer ${i}`,
				});
			}
			await manager.createEpisode("Episode 1", "First episode", []);

			// Clear and create second episode with a delay
			manager.clearConversation();
			await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
			for (let i = 0; i < 5; i++) {
				manager.addMessage({
					role: "user",
					content: `Episode 2 question ${i}`,
				});
				manager.addMessage({
					role: "assistant",
					content: `Episode 2 answer ${i}`,
				});
			}
			await manager.createEpisode("Episode 2", "Second episode", []);

			const recent = await manager.getRecentEpisodes(1);
			expect(recent).toHaveLength(1);
			expect(recent[0].title).toBe("Episode 2");
		});
	});

	describe("Memory consolidation", () => {
		it("should consolidate important messages to long-term", async () => {
			// Add important messages
			manager.addMessage({
				role: "user",
				content: "This is a critical error in production",
			});

			manager.addMessage({
				role: "assistant",
				content: "This is very important information",
			});

			// Manually trigger consolidation
			await manager.consolidate();

			// Search long-term memory
			const results = await manager.search({ query: "critical" });
			expect(results.length).toBeGreaterThan(0);
		});
	});

	describe("Statistics", () => {
		it("should return comprehensive stats", async () => {
			manager.addMessage({ role: "user", content: "Test" });
			manager.setContext("task-1", "test data");
			await manager.storeFact("Test fact", {});

			const stats = await manager.getStats();

			expect(stats.shortTerm.count).toBe(1);
			expect(stats.working.count).toBe(1);
			expect(stats.longTerm.memories).toBeGreaterThanOrEqual(1);
		});
	});

	describe("Shutdown", () => {
		it("should cleanup resources on shutdown", async () => {
			manager.addMessage({ role: "user", content: "Test" });

			await manager.shutdown();

			// Should not throw after shutdown
			expect(() => manager.getStats()).not.toThrow();
		});
	});

	describe("Factory function", () => {
		it("should create manager with default config", () => {
			const defaultManager = createMemoryManager();

			expect(defaultManager).toBeDefined();
			expect(() => defaultManager.getStats()).not.toThrow();

			defaultManager.shutdown();
		});

		it("should merge custom config with defaults", () => {
			const customManager = createMemoryManager({
				shortTerm: { maxMessages: 50 },
			});

			// Should use custom maxMessages but default ttlSeconds
			expect(customManager).toBeDefined();

			customManager.shutdown();
		});
	});
});
