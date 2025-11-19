import { createServer } from "http";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { type WebSocket, WebSocketServer } from "ws";
import { CostTracker } from "./cost-tracker.js";
import { GoblinRuntime } from "./index.js";
import {
	OrchestrationExecutor,
	OrchestrationParser,
	OrchestrationStore,
} from "./orchestrator.js";
import type { GoblinTask } from "./types.js";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";
const JWT_SECRET = process.env.JWT_SECRET || "dev-local-secret";
const AUTH_USER = process.env.DASHBOARD_USER || "admin";
const AUTH_PASS = process.env.DASHBOARD_PASS || "admin";

// Rate limiter (applies to /api)
const apiRateLimiter = rateLimit({
	windowMs: 60_000, // 1 minute
	max: Number(process.env.API_RATE_LIMIT || 100),
	standardHeaders: true,
	legacyHeaders: false,
});
app.use("/api", apiRateLimiter);

// Auth middleware - verifies JWT when enabled
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
	// Allow health & login without auth
	if (req.path.startsWith("/health") || req.path.startsWith("/auth")) {
		return next();
	}

	if (!AUTH_ENABLED) return next();

	const header = (req.headers.authorization || "").toString();
	const token = header.startsWith("Bearer ") ? header.slice(7) : header;
	if (!token) return res.status(401).json({ error: "Unauthorized" });

	try {
		const payload = jwt.verify(token, JWT_SECRET);
		(req as any).user = payload;
		return next();
	} catch (err) {
		return res.status(401).json({ error: "Invalid token" });
	}
}

// Apply auth middleware for API routes
app.use("/api", authMiddleware);

// Initialize runtime
const runtime = new GoblinRuntime();
const orchestrator = new OrchestrationExecutor();
const orchestrationStore = new OrchestrationStore();
const costTracker = new CostTracker();
let initialized = false;

async function ensureInitialized() {
	if (!initialized) {
		await runtime.initialize();
		initialized = true;
	}
}

// ============================================================================
// REST API Endpoints
// ============================================================================

/**
 * GET /api/goblins
 * Returns list of all goblins with current status and stats
 */
app.get("/api/goblins", async (_req, res) => {
	try {
		await ensureInitialized();
		const goblins = runtime.listGoblins();
		res.json(goblins);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

/**
 * POST /api/execute
 * Execute a task for a specific goblin
 * Body: { goblin: string, task: string, context?: object }
 */
app.post("/api/execute", async (req, res) => {
	try {
		await ensureInitialized();
		const { goblin, task, context } = req.body as GoblinTask;

		if (!goblin || !task) {
			return res
				.status(400)
				.json({ error: "Missing required fields: goblin, task" });
		}

		const response = await runtime.executeTask({ goblin, task, context });
		res.json(response);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/history/:goblin
 * Get task history for a specific goblin
 * Query params: limit (default: 10)
 */
app.get("/api/history/:goblin", async (req, res) => {
	try {
		await ensureInitialized();
		const { goblin } = req.params;
		const limit = Number.parseInt(req.query.limit as string) || 10;

		const history = runtime.getGoblinHistory(goblin, limit);
		res.json(history);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/stats/:goblin
 * Get performance stats for a specific goblin
 */
app.get("/api/stats/:goblin", async (req, res) => {
	try {
		await ensureInitialized();
		const { goblin } = req.params;

		const stats = runtime.getGoblinStats(goblin);
		res.json(stats);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get("/api/health", (_req, res) => {
	res.json({
		status: "healthy",
		initialized,
		timestamp: new Date().toISOString(),
	});
});

// ============================================================================
// Orchestration API Endpoints
// ============================================================================

/**
 * POST /api/orchestrate/parse
 * Parse orchestration syntax into execution plan
 * Body: { text: string, defaultGoblinId?: string }
 */
app.post("/api/orchestrate/parse", async (req, res) => {
	try {
		const { text, defaultGoblinId } = req.body;

		if (!text) {
			return res.status(400).json({ error: "Missing required field: text" });
		}

		const plan = OrchestrationParser.parse(text, defaultGoblinId);
		res.json(plan);
	} catch (error: any) {
		// Return 400 for validation/parsing errors, 500 for others
		const isValidationError =
			error.message?.includes("cannot be empty") ||
			error.message?.includes("Invalid orchestration syntax");
		res.status(isValidationError ? 400 : 500).json({ error: error.message });
	}
});

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { token }
 */
app.post("/api/auth/login", async (req, res) => {
	const { username, password } = req.body || {};
	// If auth is disabled, allow any login and return a token for convenience
	if (!AUTH_ENABLED) {
		const token = jwt.sign({ username: username || AUTH_USER }, JWT_SECRET, { expiresIn: "8h" });
		return res.json({ token });
	}

	if (!username || !password) {
		return res.status(400).json({ error: "Missing username or password" });
	}

	if (username === AUTH_USER && password === AUTH_PASS) {
		const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "8h" });
		return res.json({ token });
	}

	return res.status(401).json({ error: "Invalid credentials" });
});

/**
 * POST /api/orchestrate/execute
 * Execute an orchestration plan
 * Body: { text: string, defaultGoblinId?: string }
 */
app.post("/api/orchestrate/execute", async (req, res) => {
	try {
		await ensureInitialized();
		const { text, defaultGoblinId } = req.body;

		if (!text) {
			return res.status(400).json({ error: "Missing required field: text" });
		}

		// Parse orchestration plan
		const plan = OrchestrationParser.parse(text, defaultGoblinId);

		// Execute plan (non-streaming)
		const executeTask = async (goblinId: string, task: string) => {
			const startTime = Date.now();
			const response = await runtime.executeTask({ goblin: goblinId, task });
			return {
				output: response.output || "",
				duration: Date.now() - startTime,
			};
		};

		const completedPlan = await orchestrator.execute(plan, executeTask);
		orchestrationStore.save(completedPlan);

		res.json(completedPlan);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/orchestrate/plans
 * Get all orchestration plans
 * Query params: status (optional)
 */
app.get("/api/orchestrate/plans", (_req, res) => {
	try {
		const { status } = _req.query;

		const plans = status
			? orchestrationStore.getByStatus(status as any)
			: orchestrationStore.getAll();

		res.json(plans);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/orchestrate/plans/:planId
 * Get specific orchestration plan
 */
app.get("/api/orchestrate/plans/:planId", (_req, res) => {
	try {
		const { planId } = _req.params;
		const plan = orchestrationStore.get(planId);

		if (!plan) {
			return res.status(404).json({ error: "Plan not found" });
		}

		res.json(plan);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

/**
 * POST /api/orchestrate/cancel/:planId
 * Cancel running orchestration
 */
app.post("/api/orchestrate/cancel/:planId", (_req, res) => {
	try {
		const { planId } = _req.params;
		orchestrator.cancel(planId);

		res.json({ success: true, planId });
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// ============================================================================
// Cost Tracking API Endpoints
// ============================================================================

/**
 * GET /api/costs/summary
 * Get cost summary with optional filters
 * Query params: goblinId, guildId, limit
 */
app.get("/api/costs/summary", (_req, res) => {
	try {
		const { goblinId, guildId, limit } = _req.query;

		const summary = costTracker.getSummary({
			goblinId: goblinId as string | undefined,
			guildId: guildId as string | undefined,
			limit: limit ? Number.parseInt(limit as string) : 10,
		});

		res.json(summary);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/costs/goblin/:goblinId
 * Get cost breakdown for specific goblin
 */
app.get("/api/costs/goblin/:goblinId", (_req, res) => {
	try {
		const { goblinId } = _req.params;
		const breakdown = costTracker.getBreakdown({ goblinId });

		res.json(breakdown);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/costs/guild/:guildId
 * Get cost breakdown for specific guild
 */
app.get("/api/costs/guild/:guildId", (_req, res) => {
	try {
		const { guildId } = _req.params;
		const breakdown = costTracker.getBreakdown({ guildId });

		res.json(breakdown);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/costs/export
 * Export all cost entries as CSV
 */
app.get("/api/costs/export", (_req, res) => {
	try {
		const csv = costTracker.exportCSV();

		res.setHeader("Content-Type", "text/csv");
		res.setHeader(
			"Content-Disposition",
			"attachment; filename=goblin-costs.csv",
		);
		res.send(csv);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// ============================================================================
// WebSocket for Streaming Execution
// ============================================================================

wss.on("connection", (ws: WebSocket) => {
	console.log("🔌 Client connected to WebSocket");

	ws.on("message", async (message: Buffer) => {
		try {
			const data = JSON.parse(message.toString());
			const { action, goblin, task } = data;

			if (action === "execute") {
				await ensureInitialized();

				// Send start event
				ws.send(
					JSON.stringify({
						type: "start",
						goblin,
						timestamp: new Date().toISOString(),
					}),
				);

				try {
					// Execute with streaming
					const response = await runtime.executeTaskStreaming(
						{ goblin, task },
						(chunk: string) => {
							// Send each chunk as it arrives
							ws.send(
								JSON.stringify({
									type: "chunk",
									goblin,
									data: chunk,
									timestamp: new Date().toISOString(),
								}),
							);
						},
					);

					// Send completion event with full response
					ws.send(
						JSON.stringify({
							type: "complete",
							goblin,
							data: response,
							timestamp: new Date().toISOString(),
						}),
					);
				} catch (error: any) {
					ws.send(
						JSON.stringify({
							type: "error",
							goblin,
							data: { message: error.message },
							timestamp: new Date().toISOString(),
						}),
					);
				}
			}
		} catch (error: any) {
			console.error("WebSocket message error:", error);
			ws.send(
				JSON.stringify({
					type: "error",
					data: { message: "Invalid message format" },
					timestamp: new Date().toISOString(),
				}),
			);
		}
	});

	ws.on("close", () => {
		console.log("🔌 Client disconnected from WebSocket");
	});

	ws.on("error", (error) => {
		console.error("WebSocket error:", error);
	});
});

// Error handler middleware (must be after routes)
app.use(
	(
		err: any,
		_req: express.Request,
		res: express.Response,
		_next: express.NextFunction,
	) => {
		console.error("Server error:", err);
		res.status(500).json({ error: err.message || "Internal server error" });
	},
);

// ============================================================================
// Start Server
// ============================================================================

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("🚀 GoblinOS Runtime Server");
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log(`📡 HTTP API: http://localhost:${PORT}`);
	console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("");
	console.log("Available endpoints:");
	console.log(`  GET  /api/goblins`);
	console.log(`  POST /api/execute`);
	console.log(`  GET  /api/history/:goblin`);
	console.log(`  GET  /api/stats/:goblin`);
	console.log(`  GET  /api/health`);
	console.log(`  POST /api/auth/login`);
	console.log("");
	console.log("Orchestration endpoints:");
	console.log(`  POST /api/orchestrate/parse`);
	console.log(`  POST /api/orchestrate/execute`);
	console.log(`  GET  /api/orchestrate/plans`);
	console.log(`  GET  /api/orchestrate/plans/:planId`);
	console.log(`  POST /api/orchestrate/cancel/:planId`);
	console.log("");
	console.log("Cost tracking endpoints:");
	console.log(`  GET  /api/costs/summary`);
	console.log(`  GET  /api/costs/goblin/:goblinId`);
	console.log(`  GET  /api/costs/guild/:guildId`);
	console.log(`  GET  /api/costs/export`);
	console.log("");
});

export { server, wss, runtime };
