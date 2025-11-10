"use strict";
/**
 * 🌉 Overmind Node.js Bridge Service
 *
 * HTTP wrapper around the TypeScript Overmind orchestrator.
 * Provides REST API for Python FastAPI backend to communicate with.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// Import the built Overmind runtime directly to avoid workspace package resolution issues during local runs.
// This points to the compiled JS in the sibling package `dist` directory.
var index_js_1 = require("../dist/index.js");
var axios_1 = require("axios");
var cors_1 = require("cors");
var dotenv_1 = require("dotenv");
var express_1 = require("express");
var pino_1 = require("pino");
var pino_http_1 = require("pino-http");
var kpi_js_1 = require("./kpi.js");
dotenv_1.default.config();
var logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || "info",
    transport: {
        target: "pino-pretty",
        options: {
            colorize: true,
        },
    },
});
var app = (0, express_1.default)();
var host = process.env.OVERMIND_BRIDGE_HOST || "0.0.0.0";
var port = Number.parseInt(process.env.OVERMIND_BRIDGE_PORT || "3030");
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((0, pino_http_1.default)({ logger: logger }));
// Initialize Overmind
var overmind = null;
var kpiStore = new kpi_js_1.KPIStore();
try {
    overmind = (0, index_js_1.createOvermind)();
    logger.info("🧙‍♂️ Overmind initialized successfully");
}
catch (error) {
    logger.error("Failed to initialize Overmind:", error);
    process.exit(1);
}
// ============================================================================
// Routes
// ============================================================================
// Health check
app.get("/health", function (_req, res) {
    if (!overmind) {
        return res.status(503).json({
            status: "unhealthy",
            error: "Overmind not initialized",
        });
    }
    var providers = overmind.getAvailableProviders();
    var uptime = process.uptime();
    // Check if we have any providers configured
    var hasProviders = providers.length > 0;
    res.json({
        status: hasProviders ? "healthy" : "degraded",
        version: "0.1.0",
        uptime: Math.floor(uptime),
        providers: providers,
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
app.post("/chat", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var message, start, result, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                message = req.body.message;
                if (!message) {
                    return [2 /*return*/, res.status(400).json({ error: "Message is required" })];
                }
                if (!overmind) {
                    return [2 /*return*/, res.status(500).json({ error: "Overmind not initialized" })];
                }
                start = Date.now();
                return [4 /*yield*/, overmind.chat(message)];
            case 1:
                result = _a.sent();
                try {
                    kpiStore.recordEvent({
                        kpi: "overmind_chat_requests",
                        value: 1,
                        source: "bridge",
                        context: { message_len: String(message).length },
                    });
                }
                catch (_b) { }
                res.json(result);
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                logger.error("Chat error:", error_1);
                res.status(500).json({
                    error: "Chat failed",
                    message: error_1.message,
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Get chat history
app.get("/chat/history", function (_req, res) {
    try {
        if (!overmind) {
            return res.status(500).json({ error: "Overmind not initialized" });
        }
        var messages = overmind.getConversationHistory();
        res.json({ messages: messages });
    }
    catch (error) {
        logger.error("Get history error:", error);
        res.status(500).json({ error: "Failed to get history" });
    }
});
// Clear history
app.delete("/chat/history", function (_req, res) {
    try {
        if (!overmind) {
            return res.status(500).json({ error: "Overmind not initialized" });
        }
        overmind.resetConversation();
        res.json({ status: "ok", message: "History cleared" });
    }
    catch (error) {
        logger.error("Clear history error:", error);
        res.status(500).json({ error: "Failed to clear history" });
    }
});
// Get providers
app.get("/providers", function (_req, res) {
    try {
        if (!overmind) {
            return res.status(500).json({ error: "Overmind not initialized" });
        }
        var providers = overmind.getAvailableProviders();
        res.json({ providers: providers });
    }
    catch (error) {
        logger.error("Get providers error:", error);
        res.status(500).json({ error: "Failed to get providers" });
    }
});
// Get routing stats
app.get("/stats", function (_req, res) {
    try {
        if (!overmind) {
            return res.status(500).json({ error: "Overmind not initialized" });
        }
        var stats = overmind.getRoutingStats();
        res.json(stats);
    }
    catch (error) {
        logger.error("Get stats error:", error);
        res.status(500).json({ error: "Failed to get stats" });
    }
});
// Memory endpoints
app.post("/memory/facts", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, fact, metadata, id, error_2;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.body, fact = _a.fact, metadata = _a.metadata;
                if (!overmind) {
                    return [2 /*return*/, res.status(500).json({ error: "Overmind not initialized" })];
                }
                return [4 /*yield*/, overmind.rememberFact(fact, metadata)];
            case 1:
                id = _b.sent();
                res.json({ id: id, status: "stored" });
                return [3 /*break*/, 3];
            case 2:
                error_2 = _b.sent();
                logger.error("Store fact error:", error_2);
                res.status(500).json({ error: "Failed to store fact" });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Compatibility endpoint for Temporal / embedding generation pipeline
// Accepts { memoryId?, content, provider? } or { memories: [{ content, tags?, importance? }] }
app.post("/api/memory/embeddings", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var body, results, _i, _a, m, id_1, err_1, content_1, existing, match, existingId, err_2, id, error_3;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 13, , 14]);
                body = req.body || {};
                if (!overmind) {
                    return [2 /*return*/, res.status(500).json({ error: "Overmind not initialized" })];
                }
                if (!Array.isArray(body.memories)) return [3 /*break*/, 7];
                results = [];
                _i = 0, _a = body.memories;
                _d.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 6];
                m = _a[_i];
                if (!m || !m.content)
                    return [3 /*break*/, 5];
                _d.label = 2;
            case 2:
                _d.trys.push([2, 4, , 5]);
                return [4 /*yield*/, overmind.rememberFact(m.content, { tags: m.tags })];
            case 3:
                id_1 = _d.sent();
                results.push({ id: id_1, status: "stored" });
                return [3 /*break*/, 5];
            case 4:
                err_1 = _d.sent();
                results.push({ id: "", status: "failed" });
                return [3 /*break*/, 5];
            case 5:
                _i++;
                return [3 /*break*/, 1];
            case 6: return [2 /*return*/, res.json({ processed: results.length, results: results })];
            case 7:
                content_1 = body.content;
                if (!content_1) {
                    return [2 /*return*/, res.status(400).json({ error: "content is required" })];
                }
                _d.label = 8;
            case 8:
                _d.trys.push([8, 10, , 11]);
                return [4 /*yield*/, overmind.searchMemory(String(content_1), 5)];
            case 9:
                existing = _d.sent();
                if (Array.isArray(existing) && existing.length > 0) {
                    match = existing.find(function (r) { var _a; return String(r.content || ((_a = r.entry) === null || _a === void 0 ? void 0 : _a.content) || "").trim() === String(content_1).trim(); });
                    if (match) {
                        existingId = match.id || ((_b = match.entry) === null || _b === void 0 ? void 0 : _b.id) || ((_c = match.entry) === null || _c === void 0 ? void 0 : _c.id);
                        return [2 /*return*/, res.json({ id: existingId, status: "existing" })];
                    }
                }
                return [3 /*break*/, 11];
            case 10:
                err_2 = _d.sent();
                // If search fails, continue and attempt to store to avoid blocking embeddings
                logger.warn("Embedding idempotency check failed, proceeding to store", err_2);
                return [3 /*break*/, 11];
            case 11: return [4 /*yield*/, overmind.rememberFact(String(content_1), { tags: body.tags })];
            case 12:
                id = _d.sent();
                return [2 /*return*/, res.json({ id: id, status: "stored" })];
            case 13:
                error_3 = _d.sent();
                logger.error("Embedding generation error:", error_3);
                return [2 /*return*/, res.status(500).json({ error: "Failed to process embeddings", message: error_3.message })];
            case 14: return [2 /*return*/];
        }
    });
}); });
app.get("/memory/search", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, query, limit, results, error_4;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.query, query = _a.query, limit = _a.limit;
                if (!overmind) {
                    return [2 /*return*/, res.status(500).json({ error: "Overmind not initialized" })];
                }
                return [4 /*yield*/, overmind.searchMemory(String(query || ""), Number(limit) || 10)];
            case 1:
                results = _b.sent();
                res.json({ results: results });
                return [3 /*break*/, 3];
            case 2:
                error_4 = _b.sent();
                logger.error("Search memory error:", error_4);
                res.status(500).json({ error: "Failed to search memory" });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
app.get("/memory/stats", function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var stats, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (!overmind) {
                    return [2 /*return*/, res.status(500).json({ error: "Overmind not initialized" })];
                }
                return [4 /*yield*/, overmind.getMemoryStats()];
            case 1:
                stats = _a.sent();
                res.json(stats);
                return [3 /*break*/, 3];
            case 2:
                error_5 = _a.sent();
                logger.error("Get memory stats error:", error_5);
                res.status(500).json({ error: "Failed to get memory stats" });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ============================================================================
// Forge Guild (led by Forge Master Dregg Ember) Routes
// ============================================================================
var getForgeGuildUrl = function () {
    return process.env.FORGE_GUILD_SERVICE_URL ||
        process.env.FORGE_MASTER_SERVICE_URL ||
        process.env.SMITHY_SERVICE_URL ||
        "http://forge-guild:8002";
};
// Forge Guild doctor - environment diagnostics
app.post("/forge-guild/doctor", function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var forgeGuildUrl, response, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                forgeGuildUrl = getForgeGuildUrl();
                return [4 /*yield*/, axios_1.default.post("".concat(forgeGuildUrl, "/forge-guild/doctor"))];
            case 1:
                response = _a.sent();
                res.json(response.data);
                return [3 /*break*/, 3];
            case 2:
                error_6 = _a.sent();
                logger.error("Forge Guild doctor error:", error_6);
                res.status(500).json({
                    error: "Forge Guild doctor failed",
                    message: error_6.message,
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Forge Guild bootstrap - environment setup
app.post("/forge-guild/bootstrap", function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var forgeGuildUrl, response, error_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                forgeGuildUrl = getForgeGuildUrl();
                return [4 /*yield*/, axios_1.default.post("".concat(forgeGuildUrl, "/forge-guild/bootstrap"))];
            case 1:
                response = _a.sent();
                res.json(response.data);
                return [3 /*break*/, 3];
            case 2:
                error_7 = _a.sent();
                logger.error("Forge Guild bootstrap error:", error_7);
                res.status(500).json({
                    error: "Forge Guild bootstrap failed",
                    message: error_7.message,
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Forge Guild sync config - .env sync
app.post("/forge-guild/sync-config", function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var forgeGuildUrl, response, error_8;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                forgeGuildUrl = getForgeGuildUrl();
                return [4 /*yield*/, axios_1.default.post("".concat(forgeGuildUrl, "/forge-guild/sync-config"))];
            case 1:
                response = _a.sent();
                res.json(response.data);
                return [3 /*break*/, 3];
            case 2:
                error_8 = _a.sent();
                logger.error("Forge Guild sync-config error:", error_8);
                res.status(500).json({
                    error: "Forge Guild sync-config failed",
                    message: error_8.message,
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Forge Guild check - lint + test
app.post("/forge-guild/check", function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var forgeGuildUrl, response, error_9;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                forgeGuildUrl = getForgeGuildUrl();
                return [4 /*yield*/, axios_1.default.post("".concat(forgeGuildUrl, "/forge-guild/check"))];
            case 1:
                response = _a.sent();
                res.json(response.data);
                return [3 /*break*/, 3];
            case 2:
                error_9 = _a.sent();
                logger.error("Forge Guild check error:", error_9);
                res.status(500).json({
                    error: "Forge Guild check failed",
                    message: error_9.message,
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// 404 handler
app.use(function (_req, res) {
    res.status(404).json({ error: "Not found" });
});
// Start server
app.listen(port, host, function () {
    logger.info("\uD83C\uDF09 Overmind Bridge listening on ".concat(host, ":").concat(port));
    logger.info("Health check: http://localhost:".concat(port, "/health"));
});
// Graceful shutdown
process.on("SIGTERM", function () {
    logger.info("SIGTERM received, shutting down gracefully...");
    overmind === null || overmind === void 0 ? void 0 : overmind.shutdown();
    process.exit(0);
});
process.on("SIGINT", function () {
    logger.info("SIGINT received, shutting down gracefully...");
    overmind === null || overmind === void 0 ? void 0 : overmind.shutdown();
    process.exit(0);
});
// KPI endpoints
app.post("/kpi/event", function (req, res) {
    try {
        var _a = req.body || {}, guild = _a.guild, goblin = _a.goblin, kpi = _a.kpi, value = _a.value, source = _a.source, context = _a.context;
        if (!kpi)
            return res.status(400).json({ error: "kpi is required" });
        kpiStore.recordEvent({
            guild: guild,
            goblin: goblin,
            kpi: kpi,
            value: value,
            source: source || "api",
            context: context,
        });
        res.json({ status: "ok" });
    }
    catch (err) {
        logger.error("KPI event error:", err);
        res.status(500).json({ error: "Failed to record KPI event" });
    }
});
app.post("/kpi/tool-invocation", function (req, res) {
    try {
        var _a = req.body || {}, guild = _a.guild, goblin = _a.goblin, tool = _a.tool, command = _a.command, success = _a.success, duration_ms = _a.duration_ms, reason = _a.reason;
        if (!goblin || !tool)
            return res.status(400).json({ error: "goblin and tool are required" });
        kpiStore.recordToolInvocation({
            guild: guild,
            goblin: goblin,
            tool: tool,
            command: command,
            success: success,
            duration_ms: duration_ms,
            reason: reason,
        });
        res.json({ status: "ok" });
    }
    catch (err) {
        logger.error("KPI tool invocation error:", err);
        res.status(500).json({ error: "Failed to record tool invocation" });
    }
});
app.get("/kpi/summary", function (req, res) {
    try {
        var hours = Number.parseInt(String(req.query.hours || "24"));
        var ms = Math.max(1, hours) * 3600 * 1000;
        var guild = req.query.guild ? String(req.query.guild) : undefined;
        var goblin = req.query.goblin ? String(req.query.goblin) : undefined;
        var summary = kpiStore.summaryFiltered(ms, guild, goblin);
        res.json(summary);
    }
    catch (err) {
        logger.error("KPI summary error:", err);
        res.status(500).json({ error: "Failed to get KPI summary" });
    }
});
app.get("/kpi/series", function (req, res) {
    try {
        var hours = Number.parseInt(String(req.query.hours || "24"));
        var ms = Math.max(1, hours) * 3600 * 1000;
        var guild = req.query.guild ? String(req.query.guild) : undefined;
        var goblin = req.query.goblin ? String(req.query.goblin) : undefined;
        var kpi = req.query.kpi ? String(req.query.kpi) : undefined;
        var interval = req.query.intervalMs
            ? Number.parseInt(String(req.query.intervalMs))
            : undefined;
        var series = kpiStore.series(ms, {
            guild: guild,
            goblin: goblin,
            kpi: kpi,
            intervalMs: interval,
        });
        res.json(series);
    }
    catch (err) {
        logger.error("KPI series error:", err);
        res.status(500).json({ error: "Failed to get KPI series" });
    }
});
app.get("/kpi/meta", function (_req, res) {
    try {
        res.json(kpiStore.meta());
    }
    catch (err) {
        logger.error("KPI meta error:", err);
        res.status(500).json({ error: "Failed to get KPI meta" });
    }
});
app.get("/kpi/tool-series", function (req, res) {
    try {
        var hours = Number.parseInt(String(req.query.hours || "24"));
        var ms = Math.max(1, hours) * 3600 * 1000;
        var guild = req.query.guild ? String(req.query.guild) : undefined;
        var goblin = req.query.goblin ? String(req.query.goblin) : undefined;
        var tool = req.query.tool ? String(req.query.tool) : undefined;
        var interval = req.query.intervalMs
            ? Number.parseInt(String(req.query.intervalMs))
            : undefined;
        var series = kpiStore.toolSeries(ms, {
            guild: guild,
            goblin: goblin,
            tool: tool,
            intervalMs: interval,
        });
        res.json(series);
    }
    catch (err) {
        logger.error("KPI tool-series error:", err);
        res.status(500).json({ error: "Failed to get tool series" });
    }
});
app.get("/kpi/recent", function (req, res) {
    try {
        var limit = Number.parseInt(String(req.query.limit || "5"));
        res.json({ events: kpiStore.recent(Math.max(1, Math.min(limit, 50))) });
    }
    catch (err) {
        logger.error("KPI recent error:", err);
        res.status(500).json({ error: "Failed to get recent events" });
    }
});
