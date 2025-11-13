/**
 * 🌉 Overmind Node.js Bridge Service
 *
 * HTTP wrapper around the TypeScript Overmind orchestrator.
 * Provides REST API for Python FastAPI backend to communicate with.
 */

// Overmind runtime (lazy-imported to avoid ESM/CJS interop issues during tests)
type Overmind = any;
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Application } from "express";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
// import { KPIStore } from "./kpi.js";

// Temporary mock KPIStore to avoid better-sqlite3 issues
class MockKPIStore {
	recordEvent(_ev: any) {}
	recordToolInvocation(_ev: any) {}
	summaryFiltered(sinceMs: number, _guild?: string, _goblin?: string) { return { since: Date.now() - sinceMs, kpis: [], tools: [] }; }
	series(sinceMs: number, _params: any) { return { since: Date.now() - sinceMs, intervalMs: 3600000, points: [] }; }
	meta() { return { guilds: [], goblins: [], kpis: [] }; }
	toolSeries(sinceMs: number, _params: any) { return { since: Date.now() - sinceMs, intervalMs: 3600000, points: [] }; }
	recent(_limit = 5) { return []; }
}

dotenv.config();

const logger = pino({
	level: process.env.LOG_LEVEL || "info",
	transport: {
		target: "pino-pretty",
		options: {
			colorize: true,
		},
	},
});

const app: Application = express();
const host = process.env.OVERMIND_BRIDGE_HOST || "0.0.0.0";
const port = Number.parseInt(process.env.OVERMIND_BRIDGE_PORT || "3030");

// Middleware
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

// Initialize Overmind
let overmind: Overmind | null = null;
const kpiStore = new MockKPIStore();

// Initialize Overmind runtime (lazy import to avoid pulling heavy ESM modules during tests)
(async () => {
	try {
		if (process.env.OVERMIND_MOCK === "1") {
			// Minimal mock used by tests to avoid heavy initialization
			overmind = {
				getAvailableProviders: () => ["mock"],
				chat: async (msg: string) => ({ response: `echo:${msg}`, routing: { selectedModel: "mock" }, metrics: { cost: 0, latency: 1 } }),
				getConversationHistory: () => [{ role: "user", content: "hi" }],
				resetConversation: () => {},
				getRoutingStats: () => ({ routed: 0 }),
				rememberFact: async (content: string) => `mock-${Buffer.from(String(content)).toString("hex").slice(0,8)}`,
				searchMemory: async (_q: string, _l: number) => [],
				getMemoryStats: async () => ({ count: 0 }),
				getShortTermMemories: async () => [],
				getWorkingMemories: async () => [],
				addToWorkingMemory: async () => {},
				addToLongTermMemory: async () => {},
				removeFromWorkingMemory: async () => {},
				removeFromShortTermMemory: async () => {},
				cleanupMemories: async () => 0,
				shutdown: async () => {},
			} as unknown as Overmind;
			logger.info("🧙‍♂️ Overmind test mock initialized");
		} else {
			// Lazy-import the Overmind runtime to avoid ESM/CJS interop issues during test transforms
			const mod = await import("@goblinos/overmind");
			const factory = (mod && mod.createOvermind) as any;
			if (!factory) throw new Error("createOvermind factory not found in @goblinos/overmind");
			overmind = factory();
			logger.info("🧙‍♂️ Overmind initialized successfully");
		}
	} catch (error) {
		logger.error("Failed to initialize Overmind:", error);
		process.exit(1);
	}
})();

// ============================================================================
// Routes
// ============================================================================

// Health check
app.get("/health", (_req, res) => {
	if (!overmind) {
		return res.status(503).json({
			status: "unhealthy",
			error: "Overmind not initialized",
		});
	}

	const providers = overmind.getAvailableProviders();
	const uptime = process.uptime();

	// Check if we have any providers configured
	const hasProviders = providers.length > 0;

	res.json({
		status: hasProviders ? "healthy" : "degraded",
		version: "0.1.0",
		uptime: Math.floor(uptime),
		providers,
		kpi: {
			db: "ready",
		},
		checks: {
			overmind: "initialized",
			providers: hasProviders ? "configured" : "missing",
		},
	});
});

// Chat endpoint
app.post("/chat", async (req, res) => {
	try {
		const { message } = req.body;

		if (!message) {
			return res.status(400).json({ error: "Message is required" });
		}

		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		const result = await overmind.chat(message);
		try {
			kpiStore.recordEvent({
				kpi: "overmind_chat_requests",
				value: 1,
				source: "bridge",
				context: { message_len: String(message).length },
			});
		} catch {}
		res.json(result);
	} catch (error) {
		logger.error("Chat error:", error);
		res.status(500).json({
			error: "Chat failed",
			message: (error as Error).message,
		});
	}
});

// Get chat history
app.get("/chat/history", (_req, res) => {
	try {
		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		const messages = overmind.getConversationHistory();
		res.json({ messages });
	} catch (error) {
		logger.error("Get history error:", error);
		res.status(500).json({ error: "Failed to get history" });
	}
});

// Clear history
app.delete("/chat/history", (_req, res) => {
	try {
		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		overmind.resetConversation();
		res.json({ status: "ok", message: "History cleared" });
	} catch (error) {
		logger.error("Clear history error:", error);
		res.status(500).json({ error: "Failed to clear history" });
	}
});

// Get providers
app.get("/providers", (_req, res) => {
	try {
		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		const providers = overmind.getAvailableProviders();
		res.json({ providers });
	} catch (error) {
		logger.error("Get providers error:", error);
		res.status(500).json({ error: "Failed to get providers" });
	}
});

// Get routing stats
app.get("/stats", (_req, res) => {
	try {
		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		const stats = overmind.getRoutingStats();
		res.json(stats);
	} catch (error) {
		logger.error("Get stats error:", error);
		res.status(500).json({ error: "Failed to get stats" });
	}
});

// Memory endpoints
app.post("/memory/facts", async (req, res) => {
	try {
		const { fact, metadata } = req.body;

		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		const id = await overmind.rememberFact(fact, metadata);
		res.json({ id, status: "stored" });
	} catch (error) {
		logger.error("Store fact error:", error);
		res.status(500).json({ error: "Failed to store fact" });
	}
});

// Compatibility endpoint for Temporal / embedding generation pipeline
// Accepts { memoryId?, content, provider? } or { memories: [{ content, tags?, importance? }] }
app.post("/api/memory/embeddings", async (req, res) => {
	try {
		const body = req.body || {};

		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		// Batch input: { memories: [ { content, tags, importance } ] }
		if (Array.isArray(body.memories)) {
			const results: Array<{ id: string; status: string }> = [];
			for (const m of body.memories) {
				if (!m || !m.content) continue;
				try {
					const id = await overmind.rememberFact(m.content, { tags: m.tags });
					results.push({ id, status: "stored" });
				} catch (err) {
					results.push({ id: "", status: "failed" });
				}
			}
			return res.json({ processed: results.length, results });
		}

			// Single item: { content, memoryId?, provider? }
			const { content } = body;
			if (!content) {
				return res.status(400).json({ error: "content is required" });
			}

			// Idempotency: check for existing facts with same content to avoid duplicates
			try {
				const existing = await overmind.searchMemory(String(content), 5);
				if (Array.isArray(existing) && existing.length > 0) {
					// look for exact match
					const match = existing.find((r: any) => String(r.content || r.entry?.content || "").trim() === String(content).trim());
					if (match) {
						const existingId = match.id || match.entry?.id || match.entry?.id;
						return res.json({ id: existingId, status: "existing" });
					}
				}
			} catch (err) {
				// If search fails, continue and attempt to store to avoid blocking embeddings
				logger.warn("Embedding idempotency check failed, proceeding to store", err);
			}

			// Store the content as a new fact (this will trigger embedding in LongTermMemory if configured)
			const id = await overmind.rememberFact(String(content), { tags: body.tags });

			return res.json({ id, status: "stored" });
	} catch (error) {
		logger.error("Embedding generation error:", error);
		return res.status(500).json({ error: "Failed to process embeddings", message: (error as Error).message });
	}
});

app.get("/memory/search", async (req, res) => {
	try {
		const { query, limit } = req.query;

		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		const results = await overmind.searchMemory(
			String(query || ""),
			Number(limit) || 10,
		);

		res.json({ results });
	} catch (error) {
		logger.error("Search memory error:", error);
		res.status(500).json({ error: "Failed to search memory" });
	}
});

app.get("/memory/stats", async (_req, res) => {
	try {
		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		const stats = await overmind.getMemoryStats();
		res.json(stats);
	} catch (error) {
		logger.error("Get memory stats error:", error);
		res.status(500).json({ error: "Failed to get memory stats" });
	}
});

// Temporal consolidation workflow endpoints
app.get("/api/memory/short-term", async (_req, res) => {
	try {
		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		const memories = await overmind.getShortTermMemories();
		res.json(memories);
	} catch (error) {
		logger.error("Get short-term memories error:", error);
		res.status(500).json({ error: "Failed to get short-term memories" });
	}
});

app.get("/api/memory/working", async (_req, res) => {
	try {
		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		const memories = await overmind.getWorkingMemories();
		res.json(memories);
	} catch (error) {
		logger.error("Get working memories error:", error);
		res.status(500).json({ error: "Failed to get working memories" });
	}
});

app.post("/api/memory/working", async (req, res) => {
	try {
		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		const { content, importance = 0.5, tags = [], metadata = {} } = req.body;
		if (!content) {
			return res.status(400).json({ error: "Content is required" });
		}

		await overmind.addToWorkingMemory(content, importance, tags, metadata);
		res.json({ success: true });
	} catch (error) {
		logger.error("Add to working memory error:", error);
		res.status(500).json({ error: "Failed to add to working memory" });
	}
});

app.post("/api/memory/long-term", async (req, res) => {
	try {
		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		const { content, importance = 0.8, tags = [], metadata = {} } = req.body;
		if (!content) {
			return res.status(400).json({ error: "Content is required" });
		}

		await overmind.addToLongTermMemory(content, importance, tags, metadata);
		res.json({ success: true });
	} catch (error) {
		logger.error("Add to long-term memory error:", error);
		res.status(500).json({ error: "Failed to add to long-term memory" });
	}
});

app.delete("/api/memory/working/:id", async (req, res) => {
	try {
		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		const { id } = req.params;
		await overmind.removeFromWorkingMemory(id);
		res.json({ success: true });
	} catch (error) {
		logger.error("Remove from working memory error:", error);
		res.status(500).json({ error: "Failed to remove from working memory" });
	}
});

app.delete("/api/memory/short-term/:id", async (req, res) => {
	try {
		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		const { id } = req.params;
		await overmind.removeFromShortTermMemory(id);
		res.json({ success: true });
	} catch (error) {
		logger.error("Remove from short-term memory error:", error);
		res.status(500).json({ error: "Failed to remove from short-term memory" });
	}
});

app.post("/api/memory/cleanup", async (req, res) => {
	try {
		if (!overmind) {
			return res.status(500).json({ error: "Overmind not initialized" });
		}

		const { maxAge } = req.body;
		const cleaned = await overmind.cleanupMemories(maxAge);
		res.json({ count: cleaned });
	} catch (error) {
		logger.error("Cleanup memories error:", error);
		res.status(500).json({ error: "Failed to cleanup memories" });
	}
});

// ============================================================================
// Forge Guild (led by Forge Master Dregg Ember) Routes
// ============================================================================

const getForgeGuildUrl = () =>
	process.env.FORGE_GUILD_SERVICE_URL ||
	process.env.FORGE_MASTER_SERVICE_URL ||
	process.env.SMITHY_SERVICE_URL ||
	"http://forge-guild:8002";

// Forge Guild doctor - environment diagnostics
app.post("/forge-guild/doctor", async (_req, res) => {
	try {
		const forgeGuildUrl = getForgeGuildUrl();
		const response = await axios.post(`${forgeGuildUrl}/forge-guild/doctor`);
		res.json(response.data);
	} catch (error) {
		logger.error("Forge Guild doctor error:", error);
		res.status(500).json({
			error: "Forge Guild doctor failed",
			message: (error as Error).message,
		});
	}
});

// Forge Guild bootstrap - environment setup
app.post("/forge-guild/bootstrap", async (_req, res) => {
	try {
		const forgeGuildUrl = getForgeGuildUrl();
		const response = await axios.post(`${forgeGuildUrl}/forge-guild/bootstrap`);
		res.json(response.data);
	} catch (error) {
		logger.error("Forge Guild bootstrap error:", error);
		res.status(500).json({
			error: "Forge Guild bootstrap failed",
			message: (error as Error).message,
		});
	}
});

// Forge Guild sync config - .env sync
app.post("/forge-guild/sync-config", async (_req, res) => {
	try {
		const forgeGuildUrl = getForgeGuildUrl();
		const response = await axios.post(
			`${forgeGuildUrl}/forge-guild/sync-config`,
		);
		res.json(response.data);
	} catch (error) {
		logger.error("Forge Guild sync-config error:", error);
		res.status(500).json({
			error: "Forge Guild sync-config failed",
			message: (error as Error).message,
		});
	}
});

// Forge Guild check - lint + test
app.post("/forge-guild/check", async (_req, res) => {
	try {
		const forgeGuildUrl = getForgeGuildUrl();
		const response = await axios.post(`${forgeGuildUrl}/forge-guild/check`);
		res.json(response.data);
	} catch (error) {
		logger.error("Forge Guild check error:", error);
		res.status(500).json({
			error: "Forge Guild check failed",
			message: (error as Error).message,
		});
	}
});

// (404 handler, server start and graceful shutdown moved to the end of the file)
// KPI endpoints
app.post("/kpi/event", (req, res) => {
	try {
		const { guild, goblin, kpi, value, source, context } = req.body || {};
		if (!kpi) return res.status(400).json({ error: "kpi is required" });
		kpiStore.recordEvent({
			guild,
			goblin,
			kpi,
			value,
			source: source || "api",
			context,
		});
		res.json({ status: "ok" });
	} catch (err) {
		logger.error("KPI event error:", err);
		res.status(500).json({ error: "Failed to record KPI event" });
	}
});

app.post("/kpi/tool-invocation", (req, res) => {
	try {
		const { guild, goblin, tool, command, success, duration_ms, reason } =
			req.body || {};
		if (!goblin || !tool)
			return res.status(400).json({ error: "goblin and tool are required" });
		kpiStore.recordToolInvocation({
			guild,
			goblin,
			tool,
			command,
			success,
			duration_ms,
			reason,
		});
		res.json({ status: "ok" });
	} catch (err) {
		logger.error("KPI tool invocation error:", err);
		res.status(500).json({ error: "Failed to record tool invocation" });
	}
});

app.get("/kpi/summary", (req, res) => {
	try {
		const hours = Number.parseInt(String(req.query.hours || "24"));
		const ms = Math.max(1, hours) * 3600 * 1000;
		const guild = req.query.guild ? String(req.query.guild) : undefined;
		const goblin = req.query.goblin ? String(req.query.goblin) : undefined;
		const summary = kpiStore.summaryFiltered(ms, guild, goblin);
		res.json(summary);
	} catch (err) {
		logger.error("KPI summary error:", err);
		res.status(500).json({ error: "Failed to get KPI summary" });
	}
});

app.get("/kpi/series", (req, res) => {
	try {
		const hours = Number.parseInt(String(req.query.hours || "24"));
		const ms = Math.max(1, hours) * 3600 * 1000;
		const guild = req.query.guild ? String(req.query.guild) : undefined;
		const goblin = req.query.goblin ? String(req.query.goblin) : undefined;
		const kpi = req.query.kpi ? String(req.query.kpi) : undefined;
		const interval = req.query.intervalMs
			? Number.parseInt(String(req.query.intervalMs))
			: undefined;
		const series = kpiStore.series(ms, {
			guild,
			goblin,
			kpi,
			intervalMs: interval,
		});
		res.json(series);
	} catch (err) {
		logger.error("KPI series error:", err);
		res.status(500).json({ error: "Failed to get KPI series" });
	}
});

app.get("/kpi/meta", (_req, res) => {
	try {
		res.json(kpiStore.meta());
	} catch (err) {
		logger.error("KPI meta error:", err);
		res.status(500).json({ error: "Failed to get KPI meta" });
	}
});

app.get("/kpi/tool-series", (req, res) => {
	try {
		const hours = Number.parseInt(String(req.query.hours || "24"));
		const ms = Math.max(1, hours) * 3600 * 1000;
		const guild = req.query.guild ? String(req.query.guild) : undefined;
		const goblin = req.query.goblin ? String(req.query.goblin) : undefined;
		const tool = req.query.tool ? String(req.query.tool) : undefined;
		const interval = req.query.intervalMs
			? Number.parseInt(String(req.query.intervalMs))
			: undefined;
		const series = kpiStore.toolSeries(ms, {
			guild,
			goblin,
			tool,
			intervalMs: interval,
		});
		res.json(series);
	} catch (err) {
		logger.error("KPI tool-series error:", err);
		res.status(500).json({ error: "Failed to get tool series" });
	}
});

app.get("/kpi/recent", (req, res) => {
	try {
		const limit = Number.parseInt(String(req.query.limit || "5"));
		res.json({ events: kpiStore.recent(Math.max(1, Math.min(limit, 50))) });
	} catch (err) {
		logger.error("KPI recent error:", err);
		res.status(500).json({ error: "Failed to get recent events" });
	}
});

// 404 handler (placed after all routes so route registration order is correct)
app.use((_req, res) => {
	res.status(404).json({ error: "Not found" });
});

// Start server only when not in test mode
if (process.env.NODE_ENV !== "test") {
	app.listen(port, host, () => {
		logger.info(`🌉 Overmind Bridge listening on ${host}:${port}`);
		logger.info(`Health check: http://localhost:${port}/health`);
	});
}

// Export app for tests
export { app };

// Graceful shutdown
process.on("SIGTERM", () => {
	logger.info("SIGTERM received, shutting down gracefully...");
	overmind?.shutdown();
	process.exit(0);
});

process.on("SIGINT", () => {
	logger.info("SIGINT received, shutting down gracefully...");
	overmind?.shutdown();
	process.exit(0);
});
