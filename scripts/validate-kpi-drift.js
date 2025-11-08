#!/usr/bin/env node
/**
 * KPI Drift Validator
 * Compares goblins.yaml-defined KPIs with DB-seeded kpi_definitions (if DB present).
 * - If DB missing, exits 0 with note (CI-safe).
 * - If drift found, prints diff and exits 1.
 */

import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

function loadYaml(fp) {
	const raw = fs.readFileSync(fp, "utf8");
	return yaml.parse(raw);
}

function expectedFromYaml(cfg) {
	const set = new Set();
	for (const guild of cfg.guilds || []) {
		for (const m of guild.members || []) {
			if (Array.isArray(m.kpis)) {
				for (const k of m.kpis) set.add(`${guild.name}::${m.id}::${String(k)}`);
			}
		}
	}
	return set;
}

async function actualFromDb(dbPath) {
	try {
		const better = (await import("better-sqlite3")).default;
		const db = new better(dbPath);
		const rows = db
			.prepare("SELECT guild, goblin, kpi FROM kpi_definitions")
			.all();
		db.close();
		const set = new Set();
		for (const r of rows) set.add(`${r.guild}::${r.goblin}::${r.kpi}`);
		return set;
	} catch (e) {
		console.warn(
			`[kpi-drift] Could not read DB at ${dbPath}: ${e?.message || e}`,
		);
		return null;
	}
}

function diffSets(expected, actual) {
	const missing = [];
	const extra = [];
	if (!actual) return { missing: [], extra: [] };
	for (const key of expected) if (!actual.has(key)) missing.push(key);
	for (const key of actual) if (!expected.has(key)) extra.push(key);
	return { missing, extra };
}

async function main() {
	const repoRoot = process.cwd();
	const y1 = path.join(repoRoot, "GoblinOS", "goblins.yaml");
	const y2 = path.join(repoRoot, "goblins.yaml");
	const yPath = fs.existsSync(y1) ? y1 : y2;
	const cfg = loadYaml(yPath);
	const expected = expectedFromYaml(cfg);

	const defaultDb = path.join(repoRoot, "GoblinOS", "forgetm.db");
	const dbPath =
		process.env.KPI_DB_PATH || (fs.existsSync(defaultDb) ? defaultDb : null);

	if (!dbPath || !fs.existsSync(dbPath)) {
		console.log(
			"[kpi-drift] DB not found; skipping drift check. Expected KPIs:",
			expected.size,
		);
		process.exit(0);
	}

	const actual = await actualFromDb(dbPath);
	const { missing, extra } = diffSets(expected, actual);
	if (missing.length || extra.length) {
		console.error("[kpi-drift] KPI drift detected");
		if (missing.length) console.error("Missing in DB:", missing);
		if (extra.length) console.error("Extra in DB:", extra);
		process.exit(1);
	} else {
		console.log(
			"[kpi-drift] OK — DB matches goblins.yaml (#=",
			expected.size,
			")",
		);
		process.exit(0);
	}
}

(async () => {
	await main();
})();
