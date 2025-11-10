import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Activate the lightweight mock runtime and test env
process.env.OVERMIND_MOCK = "1";
process.env.NODE_ENV = "test";

import { app } from "../src/index.ts";

let server: any;
let baseUrl = "";

beforeAll(() => {
	server = app.listen(0);
	// @ts-ignore
	const port = server.address().port;
	baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(() => {
	server?.close();
});

describe("Bridge API (mocked Overmind)", () => {
	it("GET /health returns healthy status and providers", async () => {
		const res = await fetch(`${baseUrl}/health`);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toHaveProperty("status");
		expect(body).toHaveProperty("providers");
	});

	it("POST /chat returns response shape", async () => {
		const res = await fetch(`${baseUrl}/chat`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ message: "hello" }),
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toHaveProperty("response");
		expect(body).toHaveProperty("routing");
	});

	it("POST /api/memory/embeddings stores single content and returns id", async () => {
		const res = await fetch(`${baseUrl}/api/memory/embeddings`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ content: "important fact" }),
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toHaveProperty("id");
		expect(body).toHaveProperty("status");
	});

	it("GET /memory/search returns results array", async () => {
		const res = await fetch(`${baseUrl}/memory/search?query=test`);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toHaveProperty("results");
		expect(Array.isArray(body.results)).toBe(true);
	});

	it("KPI endpoints accept events and return summary/meta", async () => {
		const ev = { guild: "forge", goblin: "orchestrator", kpi: "test_kpi", value: 1 };
		const r1 = await fetch(`${baseUrl}/kpi/event`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(ev),
		});
		expect(r1.status).toBe(200);
		const r2 = await fetch(`${baseUrl}/kpi/summary`);
		expect(r2.status).toBe(200);
		const r3 = await fetch(`${baseUrl}/kpi/meta`);
		expect(r3.status).toBe(200);
	});
});
