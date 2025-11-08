import { join } from "path";
import Database from "better-sqlite3";
import type { MemoryEntry } from "./types.js";

export class MemoryStore {
	private db: Database.Database;

	constructor(dbPath?: string) {
		const path = dbPath || join(process.cwd(), ".goblin-memory.db");
		this.db = new Database(path);
		this.initialize();
	}

	private initialize() {
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory (
        id TEXT PRIMARY KEY,
        goblin TEXT NOT NULL,
        task TEXT NOT NULL,
        response TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        kpis TEXT,
        success INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_goblin ON memory(goblin);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON memory(timestamp);

      CREATE TABLE IF NOT EXISTS kpis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goblin TEXT NOT NULL,
        metric TEXT NOT NULL,
        value REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_kpi_goblin ON kpis(goblin);
      CREATE INDEX IF NOT EXISTS idx_kpi_metric ON kpis(metric);
    `);
	}

	save(entry: MemoryEntry): void {
		const stmt = this.db.prepare(`
      INSERT INTO memory (id, goblin, task, response, timestamp, kpis, success)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

		stmt.run(
			entry.id,
			entry.goblin,
			entry.task,
			entry.response,
			entry.timestamp.getTime(),
			entry.kpis ? JSON.stringify(entry.kpis) : null,
			entry.success ? 1 : 0,
		);

		// Save individual KPIs
		if (entry.kpis) {
			const kpiStmt = this.db.prepare(`
        INSERT INTO kpis (goblin, metric, value, timestamp)
        VALUES (?, ?, ?, ?)
      `);

			for (const [metric, value] of Object.entries(entry.kpis)) {
				kpiStmt.run(entry.goblin, metric, value, entry.timestamp.getTime());
			}
		}
	}

	getHistory(goblin: string, limit = 10): MemoryEntry[] {
		const stmt = this.db.prepare(`
      SELECT * FROM memory
      WHERE goblin = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

		const rows = stmt.all(goblin, limit) as any[];

		return rows.map((row) => ({
			id: row.id,
			goblin: row.goblin,
			task: row.task,
			response: row.response,
			timestamp: new Date(row.timestamp),
			kpis: row.kpis ? JSON.parse(row.kpis) : undefined,
			success: row.success === 1,
		}));
	}

	getKPIStats(goblin: string, metric: string, hours = 24): number[] {
		const since = Date.now() - hours * 60 * 60 * 1000;

		const stmt = this.db.prepare(`
      SELECT value FROM kpis
      WHERE goblin = ? AND metric = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `);

		const rows = stmt.all(goblin, metric, since) as any[];
		return rows.map((r) => r.value);
	}

	getSuccessRate(goblin: string, hours = 24): number {
		const since = Date.now() - hours * 60 * 60 * 1000;

		const stmt = this.db.prepare(`
      SELECT
        SUM(success) as successes,
        COUNT(*) as total
      FROM memory
      WHERE goblin = ? AND timestamp >= ?
    `);

		const result = stmt.get(goblin, since) as any;

		if (!result || result.total === 0) return 0;
		return (result.successes / result.total) * 100;
	}

	close(): void {
		this.db.close();
	}
}
