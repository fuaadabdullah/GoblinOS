/**
 * 🌉 Overmind Node.js Bridge Service
 *
 * HTTP wrapper around the TypeScript Overmind orchestrator.
 * Provides REST API for Python FastAPI backend to communicate with.
 */

import { type Overmind, createOvermind } from "@goblinos/overmind";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { KPIStore } from "./kpi.js";

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

const app = express();
const host = process.env.OVERMIND_BRIDGE_HOST || "0.0.0.0";
const port = Number.parseInt(process.env.OVERMIND_BRIDGE_PORT || "3030");

// Middleware
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

// Initialize Overmind
let overmind: Overmind | null = null;
const kpiStore = new KPIStore();

try {
	overmind = createOvermind();
	logger.info("🧙‍♂️ Overmind initialized successfully");
} catch (error) {
	logger.error("Failed to initialize Overmind:", error);
	process.exit(1);
}

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

		const start = Date.now();
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

// 404 handler
app.use((_req, res) => {
	res.status(404).json({ error: "Not found" });
});

// Start server
app.listen(port, host, () => {
	logger.info(`🌉 Overmind Bridge listening on ${host}:${port}`);
	logger.info(`Health check: http://localhost:${port}/health`);
});

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
