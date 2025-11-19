import { expect, test } from "@playwright/test";

// This E2E test injects a lightweight mock of the Tauri runtime into the page
// so it can run against the Vite dev server (no native Tauri binary required).

test.beforeEach(async ({ page }) => {
	// Inject a mock __TAURI__ with invoke and event.listen before the app loads
	await page.addInitScript(() => {
		(window as any).__TAURI__ = (window as any).__TAURI__ || {};
		const listeners: Record<string, Function[]> = {};
		(window as any).__TAURI__.event = {
			listen: (name: string, cb: Function) => {
				listeners[name] = listeners[name] || [];
				listeners[name].push(cb);
				return Promise.resolve(() => {
					listeners[name] = listeners[name].filter((x) => x !== cb);
				});
			},
			// expose for test harness
			__emit: (name: string, payload: any) => {
				(listeners[name] || []).forEach((cb) => cb({ payload }));
			},
		};

		// simple in-memory state to emulate provider models and costs
		const cost = { total_cost: 0, cost_by_provider: {}, cost_by_model: {} };

		(window as any).__TAURI__.invoke = async (cmd: string, args?: any) => {
			switch (cmd) {
				case "get_providers":
					return ["ollama", "openai"];
				case "get_goblins":
					return [
						{
							id: "codesmith",
							name: "CodeSmith",
							title: "Code Generation",
							status: "ok",
						},
					];
				case "get_provider_models":
					// return duplicate models to test dedupe handling
					return ["qwen2.5:3b", "qwen2.5:3b"];
				case "execute_task":
					// non-streaming execution
					cost.total_cost += 0.0;
					return {
						goblin: args.request.goblin,
						task: args.request.task,
						reasoning: "done",
						cost: null,
					};
				case "get_cost_summary":
					return cost;
				case "parse_orchestration":
					return { steps: [], total_batches: 0, max_parallel: 0 };
				case "set_provider_api_key":
					// pretend to store key
					return;
				case "get_api_key":
					return null;
				case "clear_api_key":
					return;
				default:
					return null;
			}
		};

		// Helper to emulate streaming execution by emitting tokens over time
		(window as any).__TAURI__.invokeStreaming = async (
			goblin: string,
			task: string,
		) => {
			const tokens = ["Hello ", "from ", "stream", "!"];
			for (let i = 0; i < tokens.length; i++) {
				// emit token
				(window as any).__TAURI__.event.__emit("stream-token", {
					content: tokens[i],
					done: i === tokens.length - 1,
				});
				await new Promise((r) => setTimeout(r, 50));
			}
			// after streaming finishes, update cost
			cost.total_cost += 0.0;
			return { goblin, task, reasoning: tokens.join(""), cost: 0 };
		};
	});
});

test("dashboard loads and displays charts", async ({
	page,
}) => {
	// navigate to dashboard page
	await page.goto("/dashboard");

	// wait for dashboard to load
	await page.waitForSelector("h1:has-text('Dashboard')");

	// verify dashboard title is present
	const title = await page.locator("h1").textContent();
	expect(title).toBe("Dashboard");

	// wait for charts to load (or loading state)
	await page.waitForSelector(".bg-slate-900", { timeout: 5000 });

	// verify we have chart containers
	const chartContainers = await page.locator(".bg-slate-900").count();
	expect(chartContainers).toBeGreaterThan(0);
});
