"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KPIStore = void 0;
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var node_url_1 = require("node:url");
var better_sqlite3_1 = require("better-sqlite3");
var yaml_1 = require("yaml");
var KPIStore = /** @class */ (function () {
    function KPIStore(dbPath) {
        var __filename = (0, node_url_1.fileURLToPath)(import.meta.url);
        var __dirname = node_path_1.default.dirname(__filename);
        var defaultPath = node_path_1.default.resolve(__dirname, "../../../../..", "forgetm.db");
        this.db = new better_sqlite3_1.default(dbPath || process.env.KPI_DB_PATH || defaultPath);
        this.init();
        if (process.env.KPI_MIGRATE_FK === "true") {
            try {
                this.migrateForeignKeys();
            }
            catch (_a) { }
        }
    }
    KPIStore.prototype.init = function () {
        this.db.exec("\n      PRAGMA journal_mode = WAL;\n      PRAGMA foreign_keys = ON;\n\n      CREATE TABLE IF NOT EXISTS goblins (\n        goblin TEXT PRIMARY KEY,\n        guild TEXT NOT NULL\n      );\n\n      CREATE TABLE IF NOT EXISTS kpi_definitions (\n        guild TEXT NOT NULL,\n        goblin TEXT,\n        kpi TEXT NOT NULL,\n        PRIMARY KEY (guild, goblin, kpi)\n      );\n\n      CREATE TABLE IF NOT EXISTS kpi_events (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        ts INTEGER NOT NULL,\n        guild TEXT,\n        goblin TEXT,\n        kpi TEXT NOT NULL,\n        value REAL,\n        source TEXT,\n        context TEXT\n      );\n      CREATE INDEX IF NOT EXISTS idx_kpi_events_ts ON kpi_events(ts);\n\n      CREATE TABLE IF NOT EXISTS tool_invocations (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        ts INTEGER NOT NULL,\n        guild TEXT,\n        goblin TEXT NOT NULL,\n        tool TEXT NOT NULL,\n        command TEXT,\n        success INTEGER,\n        duration_ms INTEGER,\n        reason TEXT\n      );\n      CREATE INDEX IF NOT EXISTS idx_tool_invocations_ts ON tool_invocations(ts);\n    ");
        // Seed goblins and KPI definitions from goblins.yaml for stricter validation
        try {
            var repoRoot = node_path_1.default.resolve(node_path_1.default.dirname((0, node_url_1.fileURLToPath)(import.meta.url)), "../../../../..");
            var yamlPath = node_path_1.default.join(repoRoot, "GoblinOS", "goblins.yaml");
            var altYamlPath = node_path_1.default.join(repoRoot, "goblins.yaml");
            var ypath = node_fs_1.default.existsSync(yamlPath) ? yamlPath : altYamlPath;
            var raw = node_fs_1.default.readFileSync(ypath, "utf8");
            var cfg = yaml_1.default.parse(raw);
            var upsertGoblin = this.db.prepare("INSERT OR REPLACE INTO goblins (goblin, guild) VALUES (?, ?)");
            var upsertKpi = this.db.prepare("INSERT OR IGNORE INTO kpi_definitions (guild, goblin, kpi) VALUES (?, ?, ?)");
            for (var _i = 0, _a = cfg.guilds || []; _i < _a.length; _i++) {
                var guild = _a[_i];
                for (var _b = 0, _c = guild.members || []; _b < _c.length; _b++) {
                    var m = _c[_b];
                    upsertGoblin.run(m.id, guild.name);
                    if (Array.isArray(m.kpis)) {
                        for (var _d = 0, _f = m.kpis; _d < _f.length; _d++) {
                            var k = _f[_d];
                            upsertKpi.run(guild.name, m.id, String(k));
                        }
                    }
                }
            }
        }
        catch (_e) {
            // non-fatal: schema seeding skipped
        }
    };
    KPIStore.prototype.recordEvent = function (ev) {
        var _a, _b, _c, _d, _f, _g, _h;
        if (process.env.STRICT_KPI === "true") {
            try {
                var stmt_1 = this.db.prepare("SELECT 1 FROM kpi_definitions WHERE guild = COALESCE(?, guild) AND kpi = ? AND (goblin = ? OR goblin IS NULL) LIMIT 1");
                var ok = stmt_1.get((_a = ev.guild) !== null && _a !== void 0 ? _a : null, ev.kpi, (_b = ev.goblin) !== null && _b !== void 0 ? _b : null);
                if (!ok)
                    throw new Error("Unknown KPI for guild/goblin");
            }
            catch (e) {
                throw e;
            }
        }
        var stmt = this.db.prepare("INSERT INTO kpi_events (ts, guild, goblin, kpi, value, source, context)\n       VALUES (@ts, @guild, @goblin, @kpi, @value, @source, @context)");
        var row = {
            ts: (_c = ev.ts) !== null && _c !== void 0 ? _c : Date.now(),
            guild: (_d = ev.guild) !== null && _d !== void 0 ? _d : null,
            goblin: (_f = ev.goblin) !== null && _f !== void 0 ? _f : null,
            kpi: ev.kpi,
            value: (_g = ev.value) !== null && _g !== void 0 ? _g : null,
            source: (_h = ev.source) !== null && _h !== void 0 ? _h : null,
            context: ev.context ? JSON.stringify(ev.context) : null,
        };
        stmt.run(row);
    };
    KPIStore.prototype.recordToolInvocation = function (ev) {
        var _a, _b, _c, _d, _f;
        if (process.env.STRICT_GOBLINS === "true") {
            var chk = this.db
                .prepare("SELECT 1 FROM goblins WHERE goblin = ? LIMIT 1")
                .get(ev.goblin);
            if (!chk)
                throw new Error("Unknown goblin id");
        }
        var stmt = this.db.prepare("INSERT INTO tool_invocations (ts, guild, goblin, tool, command, success, duration_ms, reason)\n       VALUES (@ts, @guild, @goblin, @tool, @command, @success, @duration_ms, @reason)");
        var row = {
            ts: (_a = ev.ts) !== null && _a !== void 0 ? _a : Date.now(),
            guild: (_b = ev.guild) !== null && _b !== void 0 ? _b : null,
            goblin: ev.goblin,
            tool: ev.tool,
            command: (_c = ev.command) !== null && _c !== void 0 ? _c : null,
            success: ev.success ? 1 : 0,
            duration_ms: (_d = ev.duration_ms) !== null && _d !== void 0 ? _d : null,
            reason: (_f = ev.reason) !== null && _f !== void 0 ? _f : null,
        };
        stmt.run(row);
    };
    KPIStore.prototype.summary = function (sinceMs) {
        var since = Date.now() - sinceMs;
        var kpiRows = this.db
            .prepare("SELECT kpi, COUNT(*) as count, AVG(value) as avg_value\n         FROM kpi_events WHERE ts >= ?\n           AND (? IS NULL OR guild = ?)\n           AND (? IS NULL OR goblin = ?)\n         GROUP BY kpi ORDER BY count DESC")
            .all(since, null, null, null, null);
        var toolRows = this.db
            .prepare("SELECT tool, COUNT(*) as count, SUM(CASE success WHEN 1 THEN 1 ELSE 0 END) as success_count,\n                AVG(duration_ms) as avg_duration\n         FROM tool_invocations WHERE ts >= ?\n           AND (? IS NULL OR guild = ?)\n           AND (? IS NULL OR goblin = ?)\n         GROUP BY tool ORDER BY count DESC")
            .all(since, null, null, null, null);
        return { since: since, kpis: kpiRows, tools: toolRows };
    };
    KPIStore.prototype.summaryFiltered = function (sinceMs, guild, goblin) {
        var since = Date.now() - sinceMs;
        var kpiRows = this.db
            .prepare("SELECT kpi, COUNT(*) as count, AVG(value) as avg_value\n         FROM kpi_events WHERE ts >= ?\n           AND (? IS NULL OR guild = ?)\n           AND (? IS NULL OR goblin = ?)\n         GROUP BY kpi ORDER BY count DESC")
            .all(since, guild !== null && guild !== void 0 ? guild : null, guild !== null && guild !== void 0 ? guild : null, goblin !== null && goblin !== void 0 ? goblin : null, goblin !== null && goblin !== void 0 ? goblin : null);
        var toolRows = this.db
            .prepare("SELECT tool, COUNT(*) as count, SUM(CASE success WHEN 1 THEN 1 ELSE 0 END) as success_count,\n                AVG(duration_ms) as avg_duration\n         FROM tool_invocations WHERE ts >= ?\n           AND (? IS NULL OR guild = ?)\n           AND (? IS NULL OR goblin = ?)\n         GROUP BY tool ORDER BY count DESC")
            .all(since, guild !== null && guild !== void 0 ? guild : null, guild !== null && guild !== void 0 ? guild : null, goblin !== null && goblin !== void 0 ? goblin : null, goblin !== null && goblin !== void 0 ? goblin : null);
        return { since: since, kpis: kpiRows, tools: toolRows };
    };
    KPIStore.prototype.series = function (sinceMs, params) {
        var _a, _b, _c, _d, _f, _g;
        var since = Date.now() - sinceMs;
        var interval = params.intervalMs && params.intervalMs > 0 ? params.intervalMs : 3600000;
        var rows = this.db
            .prepare("SELECT CAST((ts / ?) AS INTEGER) * ? AS bucket, COUNT(*) as count, AVG(value) as avg_value\n         FROM kpi_events\n         WHERE ts >= ?\n           AND (? IS NULL OR kpi = ?)\n           AND (? IS NULL OR guild = ?)\n           AND (? IS NULL OR goblin = ?)\n         GROUP BY bucket\n         ORDER BY bucket")
            .all(interval, interval, since, (_a = params.kpi) !== null && _a !== void 0 ? _a : null, (_b = params.kpi) !== null && _b !== void 0 ? _b : null, (_c = params.guild) !== null && _c !== void 0 ? _c : null, (_d = params.guild) !== null && _d !== void 0 ? _d : null, (_f = params.goblin) !== null && _f !== void 0 ? _f : null, (_g = params.goblin) !== null && _g !== void 0 ? _g : null);
        return { since: since, intervalMs: interval, points: rows };
    };
    KPIStore.prototype.toolSeries = function (sinceMs, params) {
        var _a, _b, _c, _d, _f, _g;
        var since = Date.now() - sinceMs;
        var interval = params.intervalMs && params.intervalMs > 0 ? params.intervalMs : 3600000;
        var rows = this.db
            .prepare("SELECT CAST((ts / ?) AS INTEGER) * ? AS bucket,\n                COUNT(*) as count,\n                SUM(CASE success WHEN 1 THEN 1 ELSE 0 END) as success_count,\n                AVG(duration_ms) as avg_duration\n         FROM tool_invocations\n         WHERE ts >= ?\n           AND (? IS NULL OR tool = ?)\n           AND (? IS NULL OR guild = ?)\n           AND (? IS NULL OR goblin = ?)\n         GROUP BY bucket\n         ORDER BY bucket")
            .all(interval, interval, since, (_a = params.tool) !== null && _a !== void 0 ? _a : null, (_b = params.tool) !== null && _b !== void 0 ? _b : null, (_c = params.guild) !== null && _c !== void 0 ? _c : null, (_d = params.guild) !== null && _d !== void 0 ? _d : null, (_f = params.goblin) !== null && _f !== void 0 ? _f : null, (_g = params.goblin) !== null && _g !== void 0 ? _g : null);
        return { since: since, intervalMs: interval, points: rows };
    };
    KPIStore.prototype.meta = function () {
        var guilds = this.db
            .prepare("SELECT DISTINCT guild FROM goblins ORDER BY guild")
            .all();
        var goblins = this.db
            .prepare("SELECT goblin, guild FROM goblins ORDER BY guild, goblin")
            .all();
        var kpis = this.db
            .prepare("SELECT DISTINCT kpi FROM kpi_definitions ORDER BY kpi")
            .all();
        return {
            guilds: guilds.map(function (g) { return g.guild; }).filter(Boolean),
            goblins: goblins,
            kpis: kpis.map(function (k) { return k.kpi; }),
        };
    };
    KPIStore.prototype.recent = function (limit) {
        if (limit === void 0) { limit = 5; }
        var stmt = this.db.prepare("SELECT * FROM (\n         SELECT ts, 'kpi' as type, guild, goblin, kpi as item, value,\n                NULL as success, NULL as duration_ms, source as meta\n         FROM kpi_events\n         UNION ALL\n         SELECT ts, 'tool' as type, guild, goblin, tool as item, NULL as value,\n                success, duration_ms, reason as meta\n         FROM tool_invocations\n       )\n       ORDER BY ts DESC\n       LIMIT ?");
        return stmt.all(limit);
    };
    KPIStore.prototype.migrateForeignKeys = function () {
        // Recreate kpi_events and tool_invocations with explicit FKs
        this.db.exec("BEGIN");
        try {
            this.db.exec("\n        CREATE TABLE IF NOT EXISTS kpi_events_new (\n          id INTEGER PRIMARY KEY AUTOINCREMENT,\n          ts INTEGER NOT NULL,\n          guild TEXT,\n          goblin TEXT,\n          kpi TEXT NOT NULL,\n          value REAL,\n          source TEXT,\n          context TEXT,\n          FOREIGN KEY (goblin) REFERENCES goblins(goblin) ON DELETE SET NULL,\n          FOREIGN KEY (guild, goblin, kpi) REFERENCES kpi_definitions(guild, goblin, kpi) ON DELETE SET NULL\n        );\n      ");
            this.db.exec("\n        INSERT INTO kpi_events_new (ts, guild, goblin, kpi, value, source, context)\n        SELECT ts, guild, goblin, kpi, value, source, context FROM kpi_events;\n      ");
            this.db.exec("DROP TABLE kpi_events;");
            this.db.exec("ALTER TABLE kpi_events_new RENAME TO kpi_events;");
            this.db.exec("\n        CREATE TABLE IF NOT EXISTS tool_invocations_new (\n          id INTEGER PRIMARY KEY AUTOINCREMENT,\n          ts INTEGER NOT NULL,\n          guild TEXT,\n          goblin TEXT NOT NULL,\n          tool TEXT NOT NULL,\n          command TEXT,\n          success INTEGER,\n          duration_ms INTEGER,\n          reason TEXT,\n          FOREIGN KEY (goblin) REFERENCES goblins(goblin) ON DELETE CASCADE\n        );\n      ");
            this.db.exec("\n        INSERT INTO tool_invocations_new (ts, guild, goblin, tool, command, success, duration_ms, reason)\n        SELECT ts, guild, goblin, tool, command, success, duration_ms, reason FROM tool_invocations;\n      ");
            this.db.exec("DROP TABLE tool_invocations;");
            this.db.exec("ALTER TABLE tool_invocations_new RENAME TO tool_invocations;");
            this.db.exec("COMMIT");
        }
        catch (e) {
            this.db.exec("ROLLBACK");
            throw e;
        }
    };
    return KPIStore;
}());
exports.KPIStore = KPIStore;
