import { beforeEach, describe, expect, it } from "vitest";
import { LongTermMemory } from "../src/memory/long-term";
import { MemoryImportance, MemoryType } from "../src/memory/types";

describe("LongTermMemory", () => {
	let memory: LongTermMemory;

	beforeEach(() => {
		memory = new LongTermMemory({
			enabled: true,
			dbPath: ":memory:",
			vectorDbPath: ":memory:",
			vectorDimensions: 1536,
		});
	});

	describe("Memory operations", () => {
		it("should add and retrieve a memory", () => {
			const id = memory.addMemory({
				content: "Kubernetes is a container orchestration platform",
				type: MemoryType.LONG_TERM,
				importance: MemoryImportance.HIGH,
				accessCount: 0,
			});

			const retrieved = memory.getMemory(id);
			expect(retrieved?.content).toBe(
				"Kubernetes is a container orchestration platform",
			);
			expect(retrieved?.importance).toBe(MemoryImportance.HIGH);
		});

		it("should search memories by content", () => {
			memory.addMemory({
				content: "Docker is a containerization platform",
				type: MemoryType.LONG_TERM,
				importance: MemoryImportance.MEDIUM,
				accessCount: 0,
			});

			memory.addMemory({
				content: "Kubernetes orchestrates Docker containers",
				type: MemoryType.LONG_TERM,
				importance: MemoryImportance.HIGH,
				accessCount: 0,
			});

			const results = memory.searchMemories({ query: "Docker" });
			expect(results).toHaveLength(2);
		});

		it("should filter by importance", () => {
			memory.addMemory({
				content: "Critical info",
				type: MemoryType.LONG_TERM,
				importance: MemoryImportance.CRITICAL,
				accessCount: 0,
			});

			memory.addMemory({
				content: "Low priority info",
				type: MemoryType.LONG_TERM,
				importance: MemoryImportance.LOW,
				accessCount: 0,
			});

			const results = memory.searchMemories({
				importance: MemoryImportance.CRITICAL,
			});
			expect(results).toHaveLength(1);
			expect(results[0].content).toBe("Critical info");
		});

		it("should filter by tags", () => {
			memory.addMemory({
				content: "K8s info about kubernetes",
				type: MemoryType.LONG_TERM,
				importance: MemoryImportance.MEDIUM,
				accessCount: 0,
			});

			memory.addMemory({
				content: "Docker info about containers",
				type: MemoryType.LONG_TERM,
				importance: MemoryImportance.MEDIUM,
				accessCount: 0,
			});

			const results = memory.searchMemories({ query: "kubernetes" });
			expect(results).toHaveLength(1);
			expect(results[0].content).toBe("K8s info about kubernetes");
		});

		it("should delete a memory", () => {
			const id = memory.addMemory({
				content: "Temp memory",
				type: MemoryType.LONG_TERM,
				importance: MemoryImportance.LOW,
				accessCount: 0,
			});

			expect(memory.getMemory(id)).toBeDefined();

			const deleted = memory.deleteMemory(id);
			expect(deleted).toBe(true);
			expect(memory.getMemory(id)).toBeUndefined();
		});
	});

	describe("Entity operations", () => {
		it("should add and retrieve an entity", () => {
			const id = memory.addEntity({
				name: "Kubernetes",
				type: "tool",
				attributes: {},
				firstMentioned: Date.now(),
				lastMentioned: Date.now(),
				mentionCount: 1,
				confidence: 0.9,
			});

			const entity = memory.getEntity(id);
			expect(entity?.name).toBe("Kubernetes");
			expect(entity?.type).toBe("tool");
		});

		it("should find entity by name", () => {
			memory.addEntity({
				name: "Docker Inc",
				type: "organization",
				attributes: {},
				firstMentioned: Date.now(),
				lastMentioned: Date.now(),
				mentionCount: 1,
				confidence: 0.8,
			});

			const entity = memory.findEntityByName("Docker Inc");
			expect(entity?.type).toBe("organization");
		});

		it("should update entity", () => {
			const id = memory.addEntity({
				name: "Alice Smith",
				type: "person",
				attributes: {},
				firstMentioned: Date.now(),
				lastMentioned: Date.now(),
				mentionCount: 1,
				confidence: 0.8,
			});

			memory.updateEntity(id, {
				type: "person",
				attributes: { role: "Engineer" },
				lastMentioned: Date.now() + 1000,
				mentionCount: 2,
				confidence: 0.9,
			});

			const entity = memory.getEntity(id);
			expect(entity?.type).toBe("person");
			expect(entity?.attributes?.role).toBe("Engineer");
			expect(entity?.mentionCount).toBe(2);
			expect(entity?.confidence).toBe(0.9);
		});

		it("should search entities by name", () => {
			memory.addEntity({
				name: "Alice Smith",
				type: "person",
				attributes: {},
				firstMentioned: Date.now(),
				lastMentioned: Date.now(),
				mentionCount: 1,
				confidence: 0.8,
			});
			memory.addEntity({
				name: "Bob Smith",
				type: "person",
				attributes: {},
				firstMentioned: Date.now(),
				lastMentioned: Date.now(),
				mentionCount: 1,
				confidence: 0.8,
			});
			memory.addEntity({
				name: "Charlie Jones",
				type: "person",
				attributes: {},
				firstMentioned: Date.now(),
				lastMentioned: Date.now(),
				mentionCount: 1,
				confidence: 0.8,
			});

			const results = memory.searchEntities("Smith");
			expect(results).toHaveLength(2);
		});

		it("should get entities by type", () => {
			memory.addEntity({
				name: "Google",
				type: "organization",
				attributes: {},
				firstMentioned: Date.now(),
				lastMentioned: Date.now(),
				mentionCount: 1,
				confidence: 0.8,
			});
			memory.addEntity({
				name: "Microsoft",
				type: "organization",
				attributes: {},
				firstMentioned: Date.now(),
				lastMentioned: Date.now(),
				mentionCount: 1,
				confidence: 0.8,
			});
			memory.addEntity({
				name: "Kubernetes",
				type: "tool",
				attributes: {},
				firstMentioned: Date.now(),
				lastMentioned: Date.now(),
				mentionCount: 1,
				confidence: 0.8,
			});

			const orgs = memory.getEntitiesByType("organization");
			expect(orgs).toHaveLength(2);
		});
	});

	describe("Episode operations", () => {
		it("should add and retrieve an episode", () => {
			const id = memory.addEpisode({
				title: "Kubernetes Discussion",
				summary: "Discussed container orchestration",
				participants: ["user", "assistant"],
				startTime: Date.now() - 3600000,
				endTime: Date.now(),
				tags: ["kubernetes", "devops"],
				entities: [],
				importance: MemoryImportance.MEDIUM,
				messages: [],
			});

			const episode = memory.getEpisode(id);
			expect(episode?.title).toBe("Kubernetes Discussion");
			expect(episode?.participants).toContain("user");
		});

		it("should search episodes by content", () => {
			memory.addEpisode({
				title: "Docker Tutorial",
				summary: "Learned about Docker containers",
				participants: ["user"],
				startTime: Date.now(),
				endTime: Date.now(),
				entities: [],
				importance: MemoryImportance.MEDIUM,
				messages: [],
			});

			memory.addEpisode({
				title: "Kubernetes Tutorial",
				summary: "Learned about K8s",
				participants: ["user"],
				startTime: Date.now(),
				endTime: Date.now(),
				entities: [],
				importance: MemoryImportance.MEDIUM,
				messages: [],
			});

			const results = memory.searchEpisodes("Docker");
			expect(results).toHaveLength(1);
			expect(results[0].title).toBe("Docker Tutorial");
		});

		it("should get recent episodes", () => {
			const now = Date.now();

			memory.addEpisode({
				title: "Old Episode",
				summary: "Old conversation",
				participants: ["user"],
				startTime: now - 7 * 24 * 60 * 60 * 1000, // 7 days ago
				endTime: now - 7 * 24 * 60 * 60 * 1000,
				entities: [],
				importance: MemoryImportance.LOW,
				messages: [],
			});

			memory.addEpisode({
				title: "Recent Episode",
				summary: "Recent conversation",
				participants: ["user"],
				startTime: now - 1000,
				endTime: now,
				entities: [],
				importance: MemoryImportance.MEDIUM,
				messages: [],
			});

			const recent = memory.getRecentEpisodes(1);
			expect(recent).toHaveLength(1);
			expect(recent[0].title).toBe("Recent Episode");
		});
	});

	describe("Maintenance operations", () => {
		it("should return correct stats", () => {
			memory.addMemory({
				content: "Test",
				type: MemoryType.LONG_TERM,
				importance: MemoryImportance.MEDIUM,
				accessCount: 0,
			});

			memory.addEntity({
				name: "Test Entity",
				type: "person",
				attributes: {},
				firstMentioned: Date.now(),
				lastMentioned: Date.now(),
				mentionCount: 1,
				confidence: 0.8,
			});

			memory.addEpisode({
				title: "Test Episode",
				summary: "Test",
				participants: ["user"],
				startTime: Date.now(),
				endTime: Date.now(),
				entities: [],
				importance: MemoryImportance.MEDIUM,
				messages: [],
			});

			const stats = memory.getStats();
			expect(stats.memories).toBe(1);
			expect(stats.entities).toBe(1);
			expect(stats.episodes).toBe(1);
		});

		it("should clear all data", () => {
			memory.addMemory({
				content: "Test",
				type: MemoryType.LONG_TERM,
				importance: MemoryImportance.MEDIUM,
				accessCount: 0,
			});

			memory.addEntity({
				name: "Test",
				type: "person",
				attributes: {},
				firstMentioned: Date.now(),
				lastMentioned: Date.now(),
				mentionCount: 1,
				confidence: 0.8,
			});

			memory.clearAll();

			const stats = memory.getStats();
			expect(stats.memories).toBe(0);
			expect(stats.entities).toBe(0);
			expect(stats.episodes).toBe(0);
		});
	});
});
