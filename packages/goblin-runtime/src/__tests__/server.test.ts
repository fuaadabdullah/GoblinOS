/**
 * Integration tests for GoblinOS Runtime Server
 *
 * Tests all REST endpoints and orchestration features
 */

import { describe, expect, it } from "vitest";

const API_BASE_URL = "http://localhost:3001";

// Mock server response types
interface Goblin {
	id: string;
	name: string;
	title: string;
	guild: string;
	toolbelt: string[];
}



describe("GoblinOS Runtime Server - Integration Tests", () => {
	// Helper function to make API requests
	async function apiRequest(endpoint: string, method = "GET", body?: any): Promise<{ status: number; data: any }>{
		const options: RequestInit = {
			method,
			headers: {
				"Content-Type": "application/json",
			},
		};

		if (body) {
			options.body = JSON.stringify(body);
		}

		const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
		return {
			status: response.status,
			data: response.ok ? await response.json().catch(() => null) : null,
		};
	}

	describe("Health & Status Endpoints", () => {
		it("GET /api/health - should return healthy status", async () => {
			const { status, data } = await apiRequest("/api/health");

			expect(status).toBe(200);
			expect(data).toHaveProperty("status", "healthy");
			expect(data).toHaveProperty("initialized");
			expect(typeof data.initialized).toBe("boolean");
		});
	});

	describe("Goblins Endpoints", () => {
		it("GET /api/goblins - should return list of goblins", async () => {
			const { status, data } = await apiRequest("/api/goblins");

			expect(status).toBe(200);
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThan(0);

			// Validate goblin structure
			const goblin = data[0] as Goblin;
			expect(goblin).toHaveProperty("id");
			expect(goblin).toHaveProperty("name");
			expect(goblin).toHaveProperty("title");
			expect(goblin).toHaveProperty("guild");
			expect(goblin).toHaveProperty("toolbelt");
			expect(Array.isArray(goblin.toolbelt)).toBe(true);
		});
	});

	describe("Orchestration Endpoints", () => {
		it("POST /api/orchestrate/parse - should parse sequential syntax", async () => {
			const { status, data } = await apiRequest(
				"/api/orchestrate/parse",
				"POST",
				{
					text: "build project THEN run tests",
					defaultGoblinId: "websmith",
				},
			);

			expect(status).toBe(200);
			expect(data).toHaveProperty("steps");
			expect(Array.isArray(data.steps)).toBe(true);
			expect(data.steps.length).toBe(2);
			expect(data).toHaveProperty("metadata");
			expect(data.metadata).toHaveProperty("parallelBatches");
		});

		it("POST /api/orchestrate/parse - should parse parallel syntax", async () => {
			const { status, data } = await apiRequest(
				"/api/orchestrate/parse",
				"POST",
				{
					text: "lint code AND run tests AND check types",
					defaultGoblinId: "websmith",
				},
			);

			expect(status).toBe(200);
			expect(data.steps.length).toBe(3);
			expect(data.metadata.parallelBatches).toBe(1);
		});

		it("POST /api/orchestrate/parse - should parse conditional syntax", async () => {
			const { status, data } = await apiRequest(
				"/api/orchestrate/parse",
				"POST",
				{
					text: "run tests THEN deploy IF_SUCCESS",
					defaultGoblinId: "websmith",
				},
			);

			expect(status).toBe(200);
			expect(data.steps.length).toBe(2);
			const conditionalStep = data.steps[1];
			expect(conditionalStep).toHaveProperty("condition");
			expect(conditionalStep.condition).toHaveProperty(
				"operator",
				"IF_SUCCESS",
			);
		});

		it("POST /api/orchestrate/parse - should parse complex mixed syntax", async () => {
			const { status, data } = await apiRequest(
				"/api/orchestrate/parse",
				"POST",
				{
					text: "build project THEN test AND lint THEN deploy IF_SUCCESS",
					defaultGoblinId: "websmith",
				},
			);

			expect(status).toBe(200);
			expect(data.steps.length).toBe(4);
			expect(data.metadata.parallelBatches).toBeGreaterThan(1);
		});

		it("POST /api/orchestrate/parse - should handle multi-goblin syntax", async () => {
			const { status, data } = await apiRequest(
				"/api/orchestrate/parse",
				"POST",
				{
					text: "websmith: build THEN crafter: review",
					defaultGoblinId: "websmith",
				},
			);

			expect(status).toBe(200);
			expect(data.steps[0].goblinId).toBe("websmith");
			expect(data.steps[1].goblinId).toBe("crafter");
		});

		it("POST /api/orchestrate/parse - should reject invalid syntax", async () => {
			const { status } = await apiRequest("/api/orchestrate/parse", "POST", {
				text: "",
				defaultGoblinId: "websmith",
			});

			expect(status).toBe(400);
		});

		it("GET /api/orchestrate/plans - should return empty array initially", async () => {
			const { status, data } = await apiRequest("/api/orchestrate/plans");

			expect(status).toBe(200);
			expect(Array.isArray(data)).toBe(true);
		});
	});

	describe("Cost Tracking Endpoints", () => {
		it("GET /api/costs/summary - should return cost summary", async () => {
			const { status, data } = await apiRequest("/api/costs/summary");

			expect(status).toBe(200);
			expect(data).toHaveProperty("totalCost");
			expect(data).toHaveProperty("totalTasks");
			expect(data).toHaveProperty("avgCostPerTask");
			expect(data).toHaveProperty("byProvider");
			expect(data).toHaveProperty("byGoblin");
			expect(data).toHaveProperty("byGuild");
			expect(typeof data.totalCost).toBe("number");
			expect(typeof data.totalTasks).toBe("number");
		});

		it("GET /api/costs/goblin/:id - should return goblin cost breakdown", async () => {
			const { status, data } = await apiRequest("/api/costs/goblin/websmith");

			expect(status).toBe(200);
			expect(data).toHaveProperty("goblinId", "websmith");
			expect(data).toHaveProperty("totalCost");
			expect(data).toHaveProperty("totalTasks");
			expect(data).toHaveProperty("byProvider");
			expect(typeof data.totalCost).toBe("number");
		});

		it("GET /api/costs/guild/:id - should return guild cost breakdown", async () => {
			const { status, data } = await apiRequest("/api/costs/guild/forge-guild");

			expect(status).toBe(200);
			expect(data).toHaveProperty("guild", "forge-guild");
			expect(data).toHaveProperty("totalCost");
			expect(data).toHaveProperty("totalTasks");
			expect(data).toHaveProperty("byGoblin");
		});

		it("GET /api/costs/export - should return CSV data", async () => {
			const response = await fetch(`${API_BASE_URL}/api/costs/export`);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toContain("text/csv");

			const csv = await response.text();
			expect(csv).toContain("id,goblinId,guild,provider,model");
		});
	});

	describe("Error Handling", () => {
		it("should return 404 for non-existent endpoints", async () => {
			const { status } = await apiRequest("/api/nonexistent");
			expect(status).toBe(404);
		});

		it("should return 400 for invalid orchestration syntax", async () => {
			const { status } = await apiRequest("/api/orchestrate/parse", "POST", {
				text: "THEN THEN AND",
				defaultGoblinId: "websmith",
			});

			expect(status).toBe(400);
		});

		it("should return 404 for non-existent plan", async () => {
			const { status } = await apiRequest("/api/orchestrate/plans/nonexistent");
			expect(status).toBe(404);
		});
	});

	describe("Data Consistency", () => {
		it("should return consistent goblin IDs across endpoints", async () => {
			// Get goblins list
			const { data: goblins } = await apiRequest("/api/goblins");
			const goblinIds = goblins.map((g: Goblin) => g.id);

			// Parse orchestration with each goblin
			for (const goblinId of goblinIds) {
				const { status, data } = await apiRequest(
					"/api/orchestrate/parse",
					"POST",
					{
						text: "test task",
						defaultGoblinId: goblinId,
					},
				);

				expect(status).toBe(200);
				expect(data.steps[0].goblinId).toBe(goblinId);
			}
		});

		it("should maintain cost tracking across requests", async () => {
			// Get initial summary
			const { data: initial } = await apiRequest("/api/costs/summary");
			const initialCost = initial.totalCost;

			// Get summary again
			const { data: second } = await apiRequest("/api/costs/summary");

			// Should be consistent (no tasks executed between calls)
			expect(second.totalCost).toBe(initialCost);
		});
	});
});
