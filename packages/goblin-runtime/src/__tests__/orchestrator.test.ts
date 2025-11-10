/**
 * Unit tests for OrchestrationParser
 *
 * Tests parsing logic for THEN/AND/IF syntax
 */

import { describe, expect, it } from "vitest";
import { OrchestrationParser } from "../orchestrator.js";

describe("OrchestrationParser", () => {
	describe("Sequential Operations (THEN)", () => {
		it("should parse simple sequential tasks", () => {
			const result = OrchestrationParser.parse("build THEN test", "websmith");

			expect(result.steps).toHaveLength(2);
			expect(result.steps[0].task).toBe("build");
			expect(result.steps[1].task).toBe("test");
			expect(result.steps[1].dependencies).toContain(result.steps[0].id);
		});

		it("should parse multi-step sequential tasks", () => {
			const result = OrchestrationParser.parse(
				"build THEN test THEN deploy",
				"websmith",
			);

			expect(result.steps).toHaveLength(3);
			expect(result.steps[0].task).toBe("build");
			expect(result.steps[1].task).toBe("test");
			expect(result.steps[2].task).toBe("deploy");

			// Check dependencies
			expect(result.steps[1].dependencies).toContain(result.steps[0].id);
			expect(result.steps[2].dependencies).toContain(result.steps[1].id);
		});

		it("should calculate parallel batches for sequential tasks", () => {
			const result = OrchestrationParser.parse(
				"build THEN test THEN deploy",
				"websmith",
			);

			expect(result.metadata.parallelBatches).toBe(3);
		});
	});

	describe("Parallel Operations (AND)", () => {
		it("should parse simple parallel tasks", () => {
			const result = OrchestrationParser.parse(
				"lint AND test AND build",
				"websmith",
			);

			expect(result.steps).toHaveLength(3);
			expect(result.steps[0].task).toBe("lint");
			expect(result.steps[1].task).toBe("test");
			expect(result.steps[2].task).toBe("build");

			// Parallel steps should have no dependencies on each other
			expect(result.steps[0].dependencies).toHaveLength(0);
			expect(result.steps[1].dependencies).toHaveLength(0);
			expect(result.steps[2].dependencies).toHaveLength(0);
		});

		it("should calculate parallel batches for parallel tasks", () => {
			const result = OrchestrationParser.parse(
				"lint AND test AND build",
				"websmith",
			);

			expect(result.metadata.parallelBatches).toBe(1);
		});
	});

	describe("Mixed Operations", () => {
		it("should parse mixed THEN and AND operations", () => {
			const result = OrchestrationParser.parse(
				"build THEN lint AND test",
				"websmith",
			);

			expect(result.steps).toHaveLength(3);

			// First step (build) should have no dependencies
			expect(result.steps[0].dependencies).toHaveLength(0);

			// Parallel steps (lint, test) should depend on build
			expect(result.steps[1].dependencies).toContain(result.steps[0].id);
			expect(result.steps[2].dependencies).toContain(result.steps[0].id);

			// Parallel steps should not depend on each other
			expect(result.steps[1].dependencies).not.toContain(result.steps[2].id);
			expect(result.steps[2].dependencies).not.toContain(result.steps[1].id);
		});

		it("should calculate correct batch count for mixed operations", () => {
			const result = OrchestrationParser.parse(
				"build THEN lint AND test THEN deploy",
				"websmith",
			);

			expect(result.steps).toHaveLength(4);
			expect(result.metadata.parallelBatches).toBe(3); // build, [lint+test], deploy
		});
	});

	describe("Conditional Operations (IF)", () => {
		it("should parse IF_SUCCESS condition", () => {
			const result = OrchestrationParser.parse(
				"test THEN deploy IF_SUCCESS",
				"websmith",
			);

			expect(result.steps).toHaveLength(2);
			expect(result.steps[1].condition).toBeDefined();
			expect(result.steps[1].condition?.operator).toBe("IF_SUCCESS");
		});

		it("should parse IF_FAILURE condition", () => {
			const result = OrchestrationParser.parse(
				"test THEN rollback IF_FAILURE",
				"websmith",
			);

			expect(result.steps).toHaveLength(2);
			expect(result.steps[1].condition).toBeDefined();
			expect(result.steps[1].condition?.operator).toBe("IF_FAILURE");
		});

		it("should parse IF_CONTAINS condition", () => {
			const result = OrchestrationParser.parse(
				'check THEN alert IF_CONTAINS("error")',
				"websmith",
			);

			expect(result.steps).toHaveLength(2);
			expect(result.steps[1].condition).toBeDefined();
			expect(result.steps[1].condition?.operator).toBe("IF_CONTAINS");
			expect(result.steps[1].condition?.value).toBe("error");
		});

		it("should handle conditions with complex text", () => {
			const result = OrchestrationParser.parse(
				'run tests THEN deploy IF_CONTAINS("All tests passed")',
				"websmith",
			);

			expect(result.steps).toHaveLength(2);
			expect(result.steps[1].condition?.value).toBe("All tests passed");
		});
	});

	describe("Multi-Goblin Syntax", () => {
		it("should parse goblin-specific tasks", () => {
			const result = OrchestrationParser.parse(
				"websmith: build THEN crafter: review",
				"websmith",
			);

			expect(result.steps).toHaveLength(2);
			expect(result.steps[0].goblinId).toBe("websmith");
			expect(result.steps[0].task).toBe("build");
			expect(result.steps[1].goblinId).toBe("crafter");
			expect(result.steps[1].task).toBe("review");
		});

		it("should use default goblin when not specified", () => {
			const result = OrchestrationParser.parse(
				"build THEN websmith: deploy",
				"crafter",
			);

			expect(result.steps).toHaveLength(2);
			expect(result.steps[0].goblinId).toBe("crafter");
			expect(result.steps[1].goblinId).toBe("websmith");
		});

		it("should handle multiple goblins with parallel tasks", () => {
			const result = OrchestrationParser.parse(
				"websmith: build AND crafter: review AND tester: test",
				"websmith",
			);

			expect(result.steps).toHaveLength(3);
			expect(result.steps[0].goblinId).toBe("websmith");
			expect(result.steps[1].goblinId).toBe("crafter");
			expect(result.steps[2].goblinId).toBe("tester");
		});
	});

	describe("Edge Cases", () => {
		it("should handle single task", () => {
			const result = OrchestrationParser.parse("deploy", "websmith");

			expect(result.steps).toHaveLength(1);
			expect(result.steps[0].task).toBe("deploy");
			expect(result.steps[0].goblinId).toBe("websmith");
		});

		it("should trim whitespace from tasks", () => {
			const result = OrchestrationParser.parse(
				"  build  THEN   test  ",
				"websmith",
			);

			expect(result.steps).toHaveLength(2);
			expect(result.steps[0].task).toBe("build");
			expect(result.steps[1].task).toBe("test");
		});

		it("should handle empty task text", () => {
			expect(() => OrchestrationParser.parse("", "websmith")).toThrow();
		});

		it("should handle invalid syntax", () => {
			expect(() =>
				OrchestrationParser.parse("THEN THEN AND", "websmith"),
			).toThrow();
		});

		it("should generate unique step IDs", () => {
			const result = OrchestrationParser.parse(
				"build THEN test THEN deploy",
				"websmith",
			);

			const ids = result.steps.map((s: any) => s.id);
			const uniqueIds = new Set(ids);

			expect(uniqueIds.size).toBe(ids.length);
		});
	});

	describe("Metadata", () => {
		it("should calculate estimated duration", () => {
			const result = OrchestrationParser.parse("build THEN test", "websmith");

			expect(result.metadata.estimatedDuration).toBeDefined();
			expect(typeof result.metadata.estimatedDuration).toBe("string");
		});

		it("should include original text", () => {
			const text = "build THEN test THEN deploy";
			const result = OrchestrationParser.parse(text, "websmith");

			expect(result.text).toBe(text);
		});
	});

	describe("Complex Workflows", () => {
		it("should parse real-world workflow example", () => {
			const result = OrchestrationParser.parse(
				"websmith: build frontend THEN tester: run unit tests AND integration tests THEN websmith: deploy IF_SUCCESS",
				"websmith",
			);

			expect(result.steps).toHaveLength(4);
			expect(result.metadata.parallelBatches).toBe(3);

			// Check structure
			expect(result.steps[0].goblinId).toBe("websmith");
			expect(result.steps[0].task).toBe("build frontend");

			expect(result.steps[1].goblinId).toBe("tester");
			expect(result.steps[1].task).toBe("run unit tests");

			expect(result.steps[2].goblinId).toBe("tester");
			expect(result.steps[2].task).toBe("integration tests");

			expect(result.steps[3].goblinId).toBe("websmith");
			expect(result.steps[3].task).toBe("deploy");
			expect(result.steps[3].condition?.operator).toBe("IF_SUCCESS");
		});
	});
});
