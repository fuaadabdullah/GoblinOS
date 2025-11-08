/**
 * Unit tests for CostTracker
 *
 * Tests cost tracking, aggregation, and export functionality
 */

import { beforeEach, describe, expect, it } from "vitest";
import { CostTracker } from "../cost-tracker";

describe("CostTracker", () => {
	let tracker: CostTracker;

	beforeEach(() => {
		tracker = new CostTracker();
	});

	describe("Cost Recording", () => {
		it("should record a task cost", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "openai",
				model: "gpt-4",
				task: "build project",
				tokens: {
					inputTokens: 100,
					outputTokens: 200,
					totalTokens: 300,
				},
				duration: 5000,
				success: true,
			});

			const summary = tracker.getSummary();
			expect(summary.totalTasks).toBe(1);
			expect(summary.totalCost).toBeGreaterThan(0);
		});

		it("should calculate cost for OpenAI GPT-4", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "openai",
				model: "gpt-4",
				task: "test",
				tokens: {
					inputTokens: 1000, // 1K tokens
					outputTokens: 1000, // 1K tokens
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			const summary = tracker.getSummary();
			// GPT-4: $0.03/1K input, $0.06/1K output = $0.09 total
			expect(summary.totalCost).toBeCloseTo(0.09, 4);
		});

		it("should calculate cost for OpenAI GPT-3.5", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "openai",
				model: "gpt-3.5-turbo",
				task: "test",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			const summary = tracker.getSummary();
			// GPT-3.5: $0.0015/1K input, $0.002/1K output = $0.0035 total
			expect(summary.totalCost).toBeCloseTo(0.0035, 4);
		});

		it("should calculate cost for Gemini", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "gemini",
				model: "gemini-1.5-pro",
				task: "test",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			const summary = tracker.getSummary();
			// Gemini: $0.0005/1K for both input and output = $0.001 total
			expect(summary.totalCost).toBeCloseTo(0.001, 4);
		});

		it("should calculate cost for Anthropic Claude Sonnet", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "anthropic",
				model: "claude-3-5-sonnet",
				task: "test",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			const summary = tracker.getSummary();
			// Sonnet: $0.003/1K input, $0.015/1K output = $0.018 total
			expect(summary.totalCost).toBeCloseTo(0.018, 4);
		});

		it("should calculate cost for Anthropic Claude Opus", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "anthropic",
				model: "claude-3-opus",
				task: "test",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			const summary = tracker.getSummary();
			// Opus: $0.015/1K input, $0.075/1K output = $0.09 total
			expect(summary.totalCost).toBeCloseTo(0.09, 4);
		});

		it("should calculate cost for Anthropic Claude Haiku", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "anthropic",
				model: "claude-3-haiku",
				task: "test",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			const summary = tracker.getSummary();
			// Haiku: $0.00025/1K input, $0.00125/1K output = $0.0015 total
			expect(summary.totalCost).toBeCloseTo(0.0015, 4);
		});

		it("should return zero cost for Ollama (local)", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "ollama",
				model: "llama3",
				task: "test",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			const summary = tracker.getSummary();
			expect(summary.totalCost).toBe(0);
		});

		it("should handle unknown providers with zero cost", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "unknown-provider",
				model: "unknown-model",
				task: "test",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			const summary = tracker.getSummary();
			expect(summary.totalCost).toBe(0);
		});
	});

	describe("Aggregation by Provider", () => {
		it("should aggregate costs by provider", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "openai",
				model: "gpt-4",
				task: "task1",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "openai",
				model: "gpt-4",
				task: "task2",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			const summary = tracker.getSummary();
			expect(summary.byProvider.openai.tasks).toBe(2);
			expect(summary.byProvider.openai.cost).toBeCloseTo(0.18, 4); // 2 * 0.09
		});

		it("should aggregate multiple providers", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "openai",
				model: "gpt-4",
				task: "task1",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "gemini",
				model: "gemini-1.5-pro",
				task: "task2",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			const summary = tracker.getSummary();
			expect(Object.keys(summary.byProvider)).toContain("openai");
			expect(Object.keys(summary.byProvider)).toContain("gemini");
			expect(summary.byProvider.openai.tasks).toBe(1);
			expect(summary.byProvider.gemini.tasks).toBe(1);
		});
	});

	describe("Aggregation by Goblin", () => {
		it("should aggregate costs by goblin", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "openai",
				model: "gpt-4",
				task: "task1",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "gemini",
				model: "gemini-1.5-pro",
				task: "task2",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			const summary = tracker.getSummary();
			expect(summary.byGoblin.websmith.tasks).toBe(2);
			expect(summary.byGoblin.websmith.cost).toBeCloseTo(0.091, 3); // 0.09 + 0.001
		});

		it("should aggregate multiple goblins", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "openai",
				model: "gpt-4",
				task: "task1",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			tracker.record({
				goblinId: "crafter",
				guild: "forge-guild",
				provider: "openai",
				model: "gpt-4",
				task: "task2",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			const summary = tracker.getSummary();
			expect(Object.keys(summary.byGoblin)).toContain("websmith");
			expect(Object.keys(summary.byGoblin)).toContain("crafter");
			expect(summary.byGoblin.websmith.tasks).toBe(1);
			expect(summary.byGoblin.crafter.tasks).toBe(1);
		});
	});

	describe("Aggregation by Guild", () => {
		it("should aggregate costs by guild", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "openai",
				model: "gpt-4",
				task: "task1",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			tracker.record({
				goblinId: "crafter",
				guild: "forge-guild",
				provider: "openai",
				model: "gpt-4",
				task: "task2",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			const summary = tracker.getSummary();
			expect(summary.byGuild["forge-guild"].tasks).toBe(2);
			expect(summary.byGuild["forge-guild"].cost).toBeCloseTo(0.18, 4);
		});

		it("should aggregate multiple guilds", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "openai",
				model: "gpt-4",
				task: "task1",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			tracker.record({
				goblinId: "tester",
				guild: "qa-guild",
				provider: "openai",
				model: "gpt-4",
				task: "task2",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			});

			const summary = tracker.getSummary();
			expect(Object.keys(summary.byGuild)).toContain("forge-guild");
			expect(Object.keys(summary.byGuild)).toContain("qa-guild");
		});
	});

	describe("Average Cost Calculation", () => {
		it("should calculate average cost per task", () => {
			// Add 3 tasks with different costs
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "openai",
				model: "gpt-4",
				task: "task1",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			}); // $0.09

			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "gemini",
				model: "gemini-1.5-pro",
				task: "task2",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			}); // $0.001

			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "anthropic",
				model: "claude-3-5-sonnet",
				task: "task3",
				tokens: {
					inputTokens: 1000,
					outputTokens: 1000,
					totalTokens: 2000,
				},
				duration: 1000,
				success: true,
			}); // $0.018

			const summary = tracker.getSummary();
			expect(summary.totalTasks).toBe(3);
			expect(summary.avgCostPerTask).toBeCloseTo(0.0363, 3); // (0.09 + 0.001 + 0.018) / 3
		});

		it("should return zero average for no tasks", () => {
			const summary = tracker.getSummary();
			expect(summary.avgCostPerTask).toBe(0);
		});
	});

	describe("CSV Export", () => {
		it("should export data as CSV", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "openai",
				model: "gpt-4",
				task: "build project",
				tokens: {
					inputTokens: 100,
					outputTokens: 200,
					totalTokens: 300,
				},
				duration: 5000,
				success: true,
			});

			const csv = tracker.exportCSV();
			expect(csv).toContain("id,goblinId,guild,provider,model");
			expect(csv).toContain("websmith");
			expect(csv).toContain("forge-guild");
			expect(csv).toContain("openai");
			expect(csv).toContain("gpt-4");
		});

		it("should export multiple entries", () => {
			tracker.record({
				goblinId: "websmith",
				guild: "forge-guild",
				provider: "openai",
				model: "gpt-4",
				task: "task1",
				tokens: {
					inputTokens: 100,
					outputTokens: 200,
					totalTokens: 300,
				},
				duration: 1000,
				success: true,
			});

			tracker.record({
				goblinId: "crafter",
				guild: "forge-guild",
				provider: "gemini",
				model: "gemini-1.5-pro",
				task: "task2",
				tokens: {
					inputTokens: 150,
					outputTokens: 250,
					totalTokens: 400,
				},
				duration: 2000,
				success: false,
			});

			const csv = tracker.exportCSV();
			const lines = csv.split("\n");
			expect(lines.length).toBeGreaterThan(2); // Header + 2 data rows
		});
	});

	describe("Storage Limits", () => {
		it("should enforce maximum entry limit", () => {
			// Record more than max entries
			for (let i = 0; i < 10005; i++) {
				tracker.record({
					goblinId: "websmith",
					guild: "forge-guild",
					provider: "openai",
					model: "gpt-4",
					task: `task-${i}`,
					tokens: {
						inputTokens: 100,
						outputTokens: 200,
						totalTokens: 300,
					},
					duration: 1000,
					success: true,
				});
			}

			// Should keep only 10000 most recent
			const csv = tracker.exportCSV();
			const lines = csv.split("\n").filter((l) => l.trim());
			expect(lines.length).toBeLessThanOrEqual(10001); // Header + 10000 rows
		});
	});
});
