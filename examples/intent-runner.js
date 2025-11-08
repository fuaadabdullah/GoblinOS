#!/usr/bin/env node
/**
 * Intent Runner — Pick a tool for a goblin and (optionally) execute it.
 *
 * Usage examples:
 *   node GoblinOS/examples/intent-runner.js --goblin vanta-lumin --intent "start portfolio dev server"
 *   node GoblinOS/examples/intent-runner.js -g magnolia-nightbloom -i "run tests" --dry-run
 *
 * Notes:
 * - Reads GoblinOS/goblins.yaml directly (no build needed)
 * - Mirrors ToolSelector behavior (trigger substring match, ownership check)
 * - Executes commands relative to the repo root
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path, { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

// Simple formatter
function makeFmt(noColor) {
	const c = (code) => (s) =>
		noColor || process.env.NO_COLOR
			? String(s)
			: `\u001b[${code}m${s}\u001b[0m`;
	return {
		bold: c("1"),
		dim: c("2"),
		green: c("32"),
		cyan: c("36"),
		yellow: c("33"),
		red: c("31"),
		section(title) {
			console.log("\n" + c("1")(title));
			console.log(c("2")("─".repeat(Math.max(12, String(title).length))));
		},
		kv(k, v) {
			console.log(`${c("36")(k)}: ${v}`);
		},
	};
}

function parseArgs(argv) {
	const out = {
		goblin: "",
		intent: "",
		dryRun: false,
		json: false,
		noColor: false,
	};
	for (let i = 2; i < argv.length; i++) {
		const arg = argv[i];
		if ((arg === "--goblin" || arg === "-g") && argv[i + 1]) {
			out.goblin = argv[++i];
		} else if ((arg === "--intent" || arg === "-i") && argv[i + 1]) {
			out.intent = argv[++i];
		} else if (arg === "--dry-run" || arg === "--print") {
			out.dryRun = true;
		} else if (arg === "--json") {
			out.json = true;
		} else if (arg === "--no-color" || arg === "--no-colour") {
			out.noColor = true;
		} else if (arg === "--help" || arg === "-h") {
			printHelpAndExit();
		}
	}
	return out;
}

function printHelpAndExit(code = 0) {
	console.log(`Intent Runner

Usage:
  node GoblinOS/examples/intent-runner.js -g <goblinId> -i <intent> [--dry-run] [--json] [--no-color]

Options:
  -g, --goblin   Goblin ID (e.g., vanta-lumin)
  -i, --intent   Task intent/description (e.g., "run tests")
      --dry-run  Print selected command without executing
      --json     Emit structured JSON instead of human text
      --no-color Disable ANSI colors
  -h, --help     Show this help
`);
	process.exit(code);
}

function loadConfig() {
	const configPath = join(repoRoot, "goblins.yaml");
	const raw = readFileSync(configPath, "utf8");
	return yaml.parse(raw);
}

function buildGoblinIndex(config) {
	const index = new Map();
	for (const guild of config.guilds || []) {
		for (const member of guild.members || []) {
			index.set(member.id, { goblin: member, guild });
		}
	}
	return index;
}

function normalize(s) {
	return String(s || "")
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}
function tokens(s) {
	return new Set(normalize(s).split(" ").filter(Boolean));
}
function similarity(a, b) {
	const A = tokens(a);
	const B = tokens(b);
	if (A.size === 0) return 0;
	let inter = 0;
	for (const t of A) if (B.has(t)) inter++;
	return inter / A.size;
}
function selectTools(goblin, intent) {
	const rules = goblin?.tools?.selection_rules || [];
	const intentNorm = normalize(intent);
	const picked = [];
	const add = (t) => {
		if (!t) return;
		if (!picked.includes(t)) picked.push(t);
	};
	for (const rule of rules) {
		if (!rule || typeof rule.trigger !== "string") continue;
		if (intentNorm.includes(normalize(rule.trigger))) add(rule.tool);
	}
	if (picked.length === 0) {
		for (const rule of rules) {
			const score = similarity(rule.trigger, intent);
			if (score >= 0.6) add(rule.tool);
		}
	}
	return picked;
}

function getToolCommand(guild, toolId) {
	const tool = (guild.toolbelt || []).find((t) => t.id === toolId);
	return tool
		? { command: tool.command, meta: tool }
		: { command: null, meta: null };
}

async function runCommand(command, label = "intent-runner", ctx = {}) {
	const segments = String(command).split(" ").filter(Boolean);
	const cmd = segments[0];
	const args = segments.slice(1);

	if (!cmd) throw new Error("Empty command");

	const started = Date.now();
	await new Promise((resolvePromise, reject) => {
		const child = spawn(cmd, args, {
			cwd: repoRoot,
			stdio: "inherit",
			shell: true,
		});
		child.on("exit", (code) => {
			const ok = code === 0;
			if (ok) resolvePromise(undefined);
			else reject(new Error(`${label} failed with exit code ${code}`));
		});
		child.on("error", reject);
	});
	try {
		const url = process.env.GOBLIN_BRIDGE_URL || "http://localhost:3030";
		await fetch(`${url.replace(/\/$/, "")}/kpi/tool-invocation`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				goblin: ctx.goblin || "unknown",
				tool: ctx.tool || label,
				command,
				success: true,
				duration_ms: Date.now() - started,
			}),
		});
	} catch {}
}

async function main() {
	const { goblin, intent, dryRun, json, noColor } = parseArgs(process.argv);
	if (!goblin || !intent) {
		console.error("Error: --goblin and --intent are required");
		printHelpAndExit(1);
	}
	const fmt = makeFmt(noColor);

	const config = loadConfig();
	const index = buildGoblinIndex(config);
	const entry = index.get(goblin);
	if (!entry) {
		console.error(`Goblin not found: ${goblin}`);
		process.exit(1);
	}

	const toolIds = selectTools(entry.goblin, intent);
	const toolIdsFiltered = toolIds.filter(Boolean);

	if (!toolIdsFiltered.length) {
		console.log(
			`No external tool selected for intent. Goblin will use brain only.`,
		);
		process.exit(0);
	}

	const ownedList = Array.isArray(entry.goblin?.tools?.owned)
		? entry.goblin.tools.owned
		: [];
	for (const tid of toolIdsFiltered) {
		if (!ownedList.includes(tid)) {
			console.error(
				`Permission error: goblin ${goblin} does not own tool ${tid}`,
			);
			process.exit(1);
		}
	}

	const resolved = toolIdsFiltered.map((tid) => ({
		tid,
		...getToolCommand(entry.guild, tid),
	}));
	for (const r of resolved) {
		if (!r.command) {
			console.error(
				`Tool ${r.tid} not found in guild ${entry.guild.name} toolbelt`,
			);
			process.exit(1);
		}
	}

	// Preflight checks for each command
	for (const r of resolved) {
		const issues = [];
		const m = String(r.command).match(/PORTFOLIO_DIR=\"?([^\s\"']+)\"?/);
		if (m && m[1] && !m[1].includes("$")) {
			const p = m[1].replace(/^~\//, `${process.env.HOME || ""}/`);
			try {
				const { existsSync } = await import("node:fs");
				if (!existsSync(p)) {
					issues.push(`PORTFOLIO_DIR does not exist: ${p}`);
				}
			} catch {}
		}
		if (String(r.command).includes("tools/portfolio_env.sh")) {
			const scriptPath = join(repoRoot, "tools/portfolio_env.sh");
			const { existsSync } = await import("node:fs");
			if (!existsSync(scriptPath)) {
				issues.push(`Missing helper script: ${scriptPath}`);
			}
		}
		if (issues.length) {
			console.error("Preflight checks failed:");
			for (const i of issues) console.error(`- ${i}`);
			console.error(
				"\nFix paths or set environment variables, then retry. Use --dry-run to preview.",
			);
			process.exit(1);
		}
	}

	const result = {
		goblin,
		guild: entry.guild.name,
		intent,
		tools: resolved.map((r) => ({
			id: r.tid,
			name: r.meta?.name,
			command: r.command,
		})),
	};

	if (json) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		fmt.section("Intent Runner");
		fmt.kv("Goblin", goblin);
		fmt.kv("Guild", entry.guild.name);
		fmt.kv("Intent", intent);
		fmt.kv("Selected", toolIdsFiltered.join(", "));
		for (const r of resolved) {
			console.log(
				`- ${fmt.bold(r.tid)} ${fmt.dim(`(${r.meta?.name || ""})`)}\n  ${fmt.cyan ? fmt.cyan("cmd") : "cmd"}: ${r.command}`,
			);
		}
	}

	// Transparency: show guild verbosity and an estimated maxTokens derived from goblin brain
	const guildVerbosity = entry.guild.verbosity || "normal";
	const brain = entry.goblin.brain || {};
	const baseMax =
		typeof brain.max_tokens === "number" ? brain.max_tokens : 2048;
	let appliedMax = baseMax;
	if (guildVerbosity === "terse") appliedMax = Math.min(baseMax, 700);
	if (guildVerbosity === "verbose") appliedMax = Math.max(baseMax, 2200);
	if (!json) {
		fmt.kv("Verbosity (guild)", guildVerbosity);
		fmt.kv("Applied maxTokens (est.)", appliedMax);
	}

	if (dryRun) {
		if (!json) console.log("\n--dry-run enabled; not executing command.");
		return;
	}

	// Execute sequentially
	for (const r of resolved) {
		await runCommand(r.command, r.meta?.name || r.tid, { goblin, tool: r.tid });
	}
}

main().catch((err) => {
	console.error(err?.message || err);
	process.exit(1);
});
