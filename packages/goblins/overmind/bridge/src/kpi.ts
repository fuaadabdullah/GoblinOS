import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import yaml from "yaml";

export interface KPIEvent {
	ts?: number;
	guild?: string;
	goblin?: string;
	kpi: string;
	value?: number;
	source?: string;
	context?: unknown;
}

export interface ToolInvocationEvent {
	ts?: number;
	guild?: string;
	goblin: string;
	tool: string;
	command?: string;
	success?: boolean;
	duration_ms?: number;
	reason?: string;
}

export class KPIStore {
	private db: Database.Database;
	constructor(dbPath?: string) {
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = path.dirname(__filename);
		const defaultPath = path.resolve(__dirname, "../../../../..", "forgetm.db");
		this.db = new Database(dbPath || process.env.KPI_DB_PATH || defaultPath);
		this.init();
		if (process.env.KPI_MIGRATE_FK === "true") {
			try {
				this.migrateForeignKeys();
			} catch {}
		}
	}

	private init() {
		this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS goblins (
        goblin TEXT PRIMARY KEY,
        guild TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS kpi_definitions (
        guild TEXT NOT NULL,
        goblin TEXT,
        kpi TEXT NOT NULL,
        PRIMARY KEY (guild, goblin, kpi)
      );

      CREATE TABLE IF NOT EXISTS kpi_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        guild TEXT,
        goblin TEXT,
        kpi TEXT NOT NULL,
        value REAL,
        source TEXT,
        context TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_kpi_events_ts ON kpi_events(ts);

      CREATE TABLE IF NOT EXISTS tool_invocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        guild TEXT,
        goblin TEXT NOT NULL,
        tool TEXT NOT NULL,
        command TEXT,
        success INTEGER,
        duration_ms INTEGER,
        reason TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tool_invocations_ts ON tool_invocations(ts);
    `);

		// Seed goblins and KPI definitions from goblins.yaml for stricter validation
		try {
			const repoRoot = path.resolve(
				path.dirname(fileURLToPath(import.meta.url)),
				"../../../../..",
			);
			const yamlPath = path.join(repoRoot, "GoblinOS", "goblins.yaml");
			const altYamlPath = path.join(repoRoot, "goblins.yaml");
			const ypath = fs.existsSync(yamlPath) ? yamlPath : altYamlPath;
			const raw = fs.readFileSync(ypath, "utf8");
			const cfg = yaml.parse(raw);
			const upsertGoblin = this.db.prepare(
				`INSERT OR REPLACE INTO goblins (goblin, guild) VALUES (?, ?)`,
			);
			const upsertKpi = this.db.prepare(
				`INSERT OR IGNORE INTO kpi_definitions (guild, goblin, kpi) VALUES (?, ?, ?)`,
			);
			for (const guild of cfg.guilds || []) {
				for (const m of guild.members || []) {
					upsertGoblin.run(m.id, guild.name);
					if (Array.isArray(m.kpis)) {
						for (const k of m.kpis) upsertKpi.run(guild.name, m.id, String(k));
					}
				}
			}
		} catch (_e) {
			// non-fatal: schema seeding skipped
		}
	}

	recordEvent(ev: KPIEvent) {
		if (process.env.STRICT_KPI === "true") {
			try {
				const stmt = this.db.prepare(
					`SELECT 1 FROM kpi_definitions WHERE guild = COALESCE(?, guild) AND kpi = ? AND (goblin = ? OR goblin IS NULL) LIMIT 1`,
				);
				const ok = stmt.get(ev.guild ?? null, ev.kpi, ev.goblin ?? null);
				if (!ok) throw new Error("Unknown KPI for guild/goblin");
			} catch (e) {
				throw e;
			}
		}
		const stmt = this.db.prepare(
			`INSERT INTO kpi_events (ts, guild, goblin, kpi, value, source, context)
       VALUES (@ts, @guild, @goblin, @kpi, @value, @source, @context)`,
		);
		const row = {
			ts: ev.ts ?? Date.now(),
			guild: ev.guild ?? null,
			goblin: ev.goblin ?? null,
			kpi: ev.kpi,
			value: ev.value ?? null,
			source: ev.source ?? null,
			context: ev.context ? JSON.stringify(ev.context) : null,
		};
		stmt.run(row);
	}

	recordToolInvocation(ev: ToolInvocationEvent) {
		if (process.env.STRICT_GOBLINS === "true") {
			const chk = this.db
				.prepare(`SELECT 1 FROM goblins WHERE goblin = ? LIMIT 1`)
				.get(ev.goblin);
			if (!chk) throw new Error("Unknown goblin id");
		}
		const stmt = this.db.prepare(
			`INSERT INTO tool_invocations (ts, guild, goblin, tool, command, success, duration_ms, reason)
       VALUES (@ts, @guild, @goblin, @tool, @command, @success, @duration_ms, @reason)`,
		);
		const row = {
			ts: ev.ts ?? Date.now(),
			guild: ev.guild ?? null,
			goblin: ev.goblin,
			tool: ev.tool,
			command: ev.command ?? null,
			success: ev.success ? 1 : 0,
			duration_ms: ev.duration_ms ?? null,
			reason: ev.reason ?? null,
		};
		stmt.run(row);
	}

	summary(sinceMs: number) {
		const since = Date.now() - sinceMs;
		const kpiRows = this.db
			.prepare(
				`SELECT kpi, COUNT(*) as count, AVG(value) as avg_value
         FROM kpi_events WHERE ts >= ?
           AND (? IS NULL OR guild = ?)
           AND (? IS NULL OR goblin = ?)
         GROUP BY kpi ORDER BY count DESC`,
			)
			.all(since, null, null, null, null);
		const toolRows = this.db
			.prepare(
				`SELECT tool, COUNT(*) as count, SUM(CASE success WHEN 1 THEN 1 ELSE 0 END) as success_count,
                AVG(duration_ms) as avg_duration
         FROM tool_invocations WHERE ts >= ?
           AND (? IS NULL OR guild = ?)
           AND (? IS NULL OR goblin = ?)
         GROUP BY tool ORDER BY count DESC`,
			)
			.all(since, null, null, null, null);
		return { since, kpis: kpiRows, tools: toolRows };
	}

	summaryFiltered(sinceMs: number, guild?: string, goblin?: string) {
		const since = Date.now() - sinceMs;
		const kpiRows = this.db
			.prepare(
				`SELECT kpi, COUNT(*) as count, AVG(value) as avg_value
         FROM kpi_events WHERE ts >= ?
           AND (? IS NULL OR guild = ?)
           AND (? IS NULL OR goblin = ?)
         GROUP BY kpi ORDER BY count DESC`,
			)
			.all(since, guild ?? null, guild ?? null, goblin ?? null, goblin ?? null);
		const toolRows = this.db
			.prepare(
				`SELECT tool, COUNT(*) as count, SUM(CASE success WHEN 1 THEN 1 ELSE 0 END) as success_count,
                AVG(duration_ms) as avg_duration
         FROM tool_invocations WHERE ts >= ?
           AND (? IS NULL OR guild = ?)
           AND (? IS NULL OR goblin = ?)
         GROUP BY tool ORDER BY count DESC`,
			)
			.all(since, guild ?? null, guild ?? null, goblin ?? null, goblin ?? null);
		return { since, kpis: kpiRows, tools: toolRows };
	}

	series(
		sinceMs: number,
		params: {
			kpi?: string;
			guild?: string;
			goblin?: string;
			intervalMs?: number;
		},
	) {
		const since = Date.now() - sinceMs;
		const interval =
			params.intervalMs && params.intervalMs > 0 ? params.intervalMs : 3600_000;
		const rows = this.db
			.prepare(
				`SELECT CAST((ts / ?) AS INTEGER) * ? AS bucket, COUNT(*) as count, AVG(value) as avg_value
         FROM kpi_events
         WHERE ts >= ?
           AND (? IS NULL OR kpi = ?)
           AND (? IS NULL OR guild = ?)
           AND (? IS NULL OR goblin = ?)
         GROUP BY bucket
         ORDER BY bucket`,
			)
			.all(
				interval,
				interval,
				since,
				params.kpi ?? null,
				params.kpi ?? null,
				params.guild ?? null,
				params.guild ?? null,
				params.goblin ?? null,
				params.goblin ?? null,
			);
		return { since, intervalMs: interval, points: rows };
	}

	toolSeries(
		sinceMs: number,
		params: {
			tool?: string;
			guild?: string;
			goblin?: string;
			intervalMs?: number;
		},
	) {
		const since = Date.now() - sinceMs;
		const interval =
			params.intervalMs && params.intervalMs > 0 ? params.intervalMs : 3600_000;
		const rows = this.db
			.prepare(
				`SELECT CAST((ts / ?) AS INTEGER) * ? AS bucket,
                COUNT(*) as count,
                SUM(CASE success WHEN 1 THEN 1 ELSE 0 END) as success_count,
                AVG(duration_ms) as avg_duration
         FROM tool_invocations
         WHERE ts >= ?
           AND (? IS NULL OR tool = ?)
           AND (? IS NULL OR guild = ?)
           AND (? IS NULL OR goblin = ?)
         GROUP BY bucket
         ORDER BY bucket`,
			)
			.all(
				interval,
				interval,
				since,
				params.tool ?? null,
				params.tool ?? null,
				params.guild ?? null,
				params.guild ?? null,
				params.goblin ?? null,
				params.goblin ?? null,
			);
		return { since, intervalMs: interval, points: rows };
	}

	meta() {
		const guilds = this.db
			.prepare(`SELECT DISTINCT guild FROM goblins ORDER BY guild`)
			.all();
		const goblins = this.db
			.prepare(`SELECT goblin, guild FROM goblins ORDER BY guild, goblin`)
			.all();
		const kpis = this.db
			.prepare(`SELECT DISTINCT kpi FROM kpi_definitions ORDER BY kpi`)
			.all();
		return {
			guilds: guilds.map((g: any) => g.guild).filter(Boolean),
			goblins: goblins as Array<{ goblin: string; guild: string }>,
			kpis: kpis.map((k: any) => k.kpi),
		};
	}

	recent(limit = 5) {
		const stmt = this.db.prepare(
			`SELECT * FROM (
         SELECT ts, 'kpi' as type, guild, goblin, kpi as item, value,
                NULL as success, NULL as duration_ms, source as meta
         FROM kpi_events
         UNION ALL
         SELECT ts, 'tool' as type, guild, goblin, tool as item, NULL as value,
                success, duration_ms, reason as meta
         FROM tool_invocations
       )
       ORDER BY ts DESC
       LIMIT ?`,
		);
		return stmt.all(limit);
	}

	private migrateForeignKeys() {
		// Recreate kpi_events and tool_invocations with explicit FKs
		this.db.exec("BEGIN");
		try {
			this.db.exec(`
        CREATE TABLE IF NOT EXISTS kpi_events_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts INTEGER NOT NULL,
          guild TEXT,
          goblin TEXT,
          kpi TEXT NOT NULL,
          value REAL,
          source TEXT,
          context TEXT,
          FOREIGN KEY (goblin) REFERENCES goblins(goblin) ON DELETE SET NULL,
          FOREIGN KEY (guild, goblin, kpi) REFERENCES kpi_definitions(guild, goblin, kpi) ON DELETE SET NULL
        );
      `);
			this.db.exec(`
        INSERT INTO kpi_events_new (ts, guild, goblin, kpi, value, source, context)
        SELECT ts, guild, goblin, kpi, value, source, context FROM kpi_events;
      `);
			this.db.exec(`DROP TABLE kpi_events;`);
			this.db.exec(`ALTER TABLE kpi_events_new RENAME TO kpi_events;`);

			this.db.exec(`
        CREATE TABLE IF NOT EXISTS tool_invocations_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts INTEGER NOT NULL,
          guild TEXT,
          goblin TEXT NOT NULL,
          tool TEXT NOT NULL,
          command TEXT,
          success INTEGER,
          duration_ms INTEGER,
          reason TEXT,
          FOREIGN KEY (goblin) REFERENCES goblins(goblin) ON DELETE CASCADE
        );
      `);
			this.db.exec(`
        INSERT INTO tool_invocations_new (ts, guild, goblin, tool, command, success, duration_ms, reason)
        SELECT ts, guild, goblin, tool, command, success, duration_ms, reason FROM tool_invocations;
      `);
			this.db.exec(`DROP TABLE tool_invocations;`);
			this.db.exec(
				`ALTER TABLE tool_invocations_new RENAME TO tool_invocations;`,
			);
			this.db.exec("COMMIT");
		} catch (e) {
			this.db.exec("ROLLBACK");
			throw e;
		}
	}
}
