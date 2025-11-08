#!/usr/bin/env node
/**
 * Toolbelt Runner — Execute a toolbelt command by tool id.
 *
 * Usage examples:
 *   node GoblinOS/examples/toolbelt-runner.js --tool forge-lite-build
 *   node GoblinOS/examples/toolbelt-runner.js -t portfolio-dev --as vanta-lumin
 *   node GoblinOS/examples/toolbelt-runner.js -t forge-lite-api-dev --dry-run
 *
 * Notes:
 * - Scans goblins.yaml for the tool id across all guilds
 * - If --as is provided, enforces ownership unless --force is used
 * - Executes relative to the repo root (GoblinOS)
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

function makeFmt(noColor) {
	const c = (code) => (s) =>
		noColor || process.env.NO_COLOR
			? String(s)
			: `\u001b[${code}m${s}\u001b[0m`;
	return {
		bold: c("1"),
		dim: c("2"),
		cyan: c("36"),
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
		tool: "",
		as: "",
		dryRun: false,
		force: false,
		json: false,
		noColor: false,
	};
	for (let i = 2; i < argv.length; i++) {
		const arg = argv[i];
		if ((arg === "--tool" || arg === "-t") && argv[i + 1]) {
			out.tool = argv[++i];
		} else if (arg === "--as" && argv[i + 1]) {
			out.as = argv[++i];
		} else if (arg === "--dry-run" || arg === "--print") {
			out.dryRun = true;
		} else if (arg === "--force") {
			out.force = true;
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
	console.log(
		`Toolbelt Runner\n\nUsage:\n  node GoblinOS/examples/toolbelt-runner.js -t <toolId> [--as <goblinId>] [--dry-run] [--force] [--json] [--no-color]\n\nOptions:\n  -t, --tool   Tool id from guild toolbelt (e.g., forge-lite-build)\n      --as     Execute as goblin id (ownership enforced unless --force)\n      --dry-run  Print command without executing\n      --force    Bypass ownership check when using --as\n      --json     Emit structured JSON\n      --no-color Disable ANSI colors\n  -h, --help   Show this help\n`,
	);
	process.exit(code);
}

function loadConfig() {
	const configPath = join(repoRoot, "goblins.yaml");
	const raw = readFileSync(configPath, "utf8");
	return yaml.parse(raw);
}

function findTool(config, toolId) {
	for (const guild of config.guilds || []) {
		for (const tool of guild.toolbelt || []) {
			if (tool.id === toolId) {
				return { guild, tool };
			}
		}
	}
	return null;
}

async function runCommand(command, label = "toolbelt-runner", ctx = {}) {
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
	const {
		tool: toolId,
		as,
		dryRun,
		force,
		json,
		noColor,
	} = parseArgs(process.argv);
	if (!toolId) {
		console.error("Error: --tool is required");
		printHelpAndExit(1);
	}
	const fmt = makeFmt(noColor);

	const config = loadConfig();
	const match = findTool(config, toolId);
	if (!match) {
		console.error(`Tool not found: ${toolId}`);
		process.exit(1);
	}

	const { guild, tool } = match;
	if (as && !force) {
		if (tool.owner && tool.owner !== as) {
			console.error(
				`Ownership error: ${toolId} is owned by ${tool.owner}, not ${as}. Use --force to bypass.`,
			);
			process.exit(1);
		}
	}

	const result = {
		guild: guild.name,
		tool: {
			id: tool.id,
			name: tool.name,
			owner: tool.owner,
			command: tool.command,
		},
		as,
	};
	if (json) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		fmt.section("Toolbelt Runner");
		fmt.kv("Guild", guild.name);
		fmt.kv("Tool", `${tool.id} (${tool.name})`);
		fmt.kv("Owner", tool.owner);
		fmt.kv("Command", tool.command);
		if (as) fmt.kv("As", as);
	}

	// Transparency: show guild verbosity and an estimated maxTokens derived from first matching member using this tool (if any)
	const guildVerbosity = match.guild.verbosity || "normal";
	let appliedMax = 2048;
	// try to find a member who owns this tool to infer their brain settings
	const ownerId = tool.owner;
	const owner = (match.guild.members || []).find((m) => m.id === ownerId);
	if (owner && owner.brain && typeof owner.brain.max_tokens === "number") {
		appliedMax = owner.brain.max_tokens;
	}
	if (guildVerbosity === "terse") appliedMax = Math.min(appliedMax, 700);
	if (guildVerbosity === "verbose") appliedMax = Math.max(appliedMax, 2200);
	if (!json) {
		fmt.kv("Verbosity (guild)", guildVerbosity);
		fmt.kv("Applied maxTokens (est.)", appliedMax);
	}

	// Preflight: validate common env-paths and helper scripts referenced in the command
	const issues = [];
	const cmdStr = String(tool.command);
	const m = cmdStr.match(/PORTFOLIO_DIR=\"?([^\s\"']+)\"?/);
	if (m && m[1] && !m[1].includes("$")) {
		const p = m[1].replace(/^~\//, `${process.env.HOME || ""}/`);
		try {
			const { existsSync } = await import("node:fs");
			if (!existsSync(p)) {
				issues.push(`PORTFOLIO_DIR does not exist: ${p}`);
			}
		} catch {}
	}
	if (cmdStr.includes("tools/portfolio_env.sh")) {
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

	if (dryRun) {
		if (!json) console.log("\n--dry-run enabled; not executing command.");
		return;
	}

	await runCommand(tool.command, tool.name, {
		goblin: as || tool.owner,
		tool: tool.id,
	});
}

main().catch((err) => {
	console.error(err?.message || err);
	process.exit(1);
});
