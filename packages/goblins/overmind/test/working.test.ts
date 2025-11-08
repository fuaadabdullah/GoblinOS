import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryImportance } from "../src/memory/types";
import { WorkingMemory } from "../src/memory/working";

describe("WorkingMemory", () => {
	let memory: WorkingMemory;

	beforeEach(() => {
		memory = new WorkingMemory({
			maxEntries: 3,
			ttlSeconds: 7200,
		});
	});

	describe("set and get", () => {
		it("should set and get a value", () => {
			memory.set("task-123", { goal: "Test task" });

			const value = memory.get("task-123");
			expect(value).toEqual({ goal: "Test task" });
		});

		it("should return undefined for missing key", () => {
			const value = memory.get("nonexistent");
			expect(value).toBeUndefined();
		});

		it("should support importance levels", () => {
			memory.set("important", { data: "critical" }, MemoryImportance.CRITICAL);

			const entry = memory.getEntry("important");
			expect(entry?.importance).toBe(MemoryImportance.CRITICAL);
		});
	});

	describe("capacity management", () => {
		it("should evict least important when at capacity", () => {
			memory.set("task1", { data: "low" }, MemoryImportance.LOW);
			memory.set("task2", { data: "medium" }, MemoryImportance.MEDIUM);
			memory.set("task3", { data: "high" }, MemoryImportance.HIGH);

			// Adding 4th should evict task1 (lowest importance)
			memory.set("task4", { data: "critical" }, MemoryImportance.CRITICAL);

			expect(memory.has("task1")).toBe(false);
			expect(memory.has("task2")).toBe(true);
			expect(memory.has("task3")).toBe(true);
			expect(memory.has("task4")).toBe(true);
		});

		it("should consider access count in eviction", () => {
			memory.set("task1", { data: "a" }, MemoryImportance.LOW);
			memory.set("task2", { data: "b" }, MemoryImportance.LOW);
			memory.set("task3", { data: "c" }, MemoryImportance.LOW);

			// Access task1 multiple times
			for (let i = 0; i < 10; i++) {
				memory.get("task1");
			}

			// Adding 4th should evict task2 (low importance, low access count)
			memory.set("task4", { data: "d" }, MemoryImportance.LOW);

			expect(memory.has("task1")).toBe(true); // Kept due to access count
			expect(memory.has("task2")).toBe(false); // Evicted
		});
	});

	describe("delete", () => {
		it("should delete an entry", () => {
			memory.set("task1", { data: "test" });
			expect(memory.has("task1")).toBe(true);

			const deleted = memory.delete("task1");
			expect(deleted).toBe(true);
			expect(memory.has("task1")).toBe(false);
		});

		it("should return false for non-existent key", () => {
			const deleted = memory.delete("nonexistent");
			expect(deleted).toBe(false);
		});
	});

	describe("search", () => {
		beforeEach(() => {
			memory.set("task1", { goal: "Deploy frontend", status: "pending" });
			memory.set("task2", { goal: "Test backend", status: "done" });
			memory.set("task3", { goal: "Deploy backend", status: "pending" });
		});

		it("should search by query string", () => {
			const results = memory.search({ query: "backend" });
			expect(results).toHaveLength(2);
			expect(results.some((r) => r.id === "task2")).toBe(true);
			expect(results.some((r) => r.id === "task3")).toBe(true);
		});

		it("should filter by importance", () => {
			memory.set("critical", { data: "important" }, MemoryImportance.CRITICAL);
			memory.set("low", { data: "not important" }, MemoryImportance.LOW);

			const results = memory.search({ importance: MemoryImportance.CRITICAL });
			expect(results).toHaveLength(1);
			expect(results[0].id).toBe("critical");
		});

		it("should filter by time range", () => {
			vi.useFakeTimers();
			const now = Date.now();

			memory.set("old", { data: "old" });

			vi.advanceTimersByTime(2 * 60 * 60 * 1000); // 2 hours

			memory.set("new", { data: "new" });

			const results = memory.search({
				timeRange: {
					start: now + 60 * 60 * 1000,
					end: now + 3 * 60 * 60 * 1000,
				},
			});
			expect(results).toHaveLength(1);
			expect(results[0].id).toBe("new");

			vi.useRealTimers();
		});
	});

	describe("clear", () => {
		it("should clear all entries", () => {
			memory.set("task1", { data: "a" });
			memory.set("task2", { data: "b" });

			memory.clear();

			expect(memory.getAll()).toHaveLength(0);
		});
	});

	describe("getStats", () => {
		it("should return correct stats", () => {
			memory.set("task1", { data: "a" });
			memory.set("task2", { data: "b" });

			const stats = memory.getStats();
			expect(stats.count).toBe(2);
			expect(stats.capacity).toBe(3);
			expect(stats.utilizationPercent).toBeCloseTo(66.67, 1);
		});
	});

	describe("TTL expiration", () => {
		it("should expire entries after TTL", () => {
			vi.useFakeTimers();

			memory.set("task1", { data: "test" });
			expect(memory.has("task1")).toBe(true);

			// Advance time past TTL (7200 seconds = 2 hours)
			vi.advanceTimersByTime(3 * 60 * 60 * 1000);

			// Access should trigger cleanup
			expect(memory.get("task1")).toBeUndefined();

			vi.useRealTimers();
		});
	});
});
