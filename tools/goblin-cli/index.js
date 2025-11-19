#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const child_process = require("child_process");
const YAML = require("js-yaml");

const GOBLINS_FILE =
	process.env.GOBLINS_FILE || path.resolve(__dirname, "../../goblins.yaml");

// Import GoblinLoader for new-style goblin packages
let GoblinLoader;
(async () => {
	try {
		const goblinRuntime = await import("@goblinos/goblin-runtime");
		GoblinLoader = goblinRuntime.GoblinLoader;
	} catch (e) {
		// GoblinLoader not available
	}
})();

function loadGoblins(filePath) {
	if (!fs.existsSync(filePath)) {
		console.error("goblins.yaml not found at", filePath);
		process.exit(2);
	}
	const raw = fs.readFileSync(filePath, "utf8");
	const obj = YAML.load(raw);
	return obj || {};
}

function listGoblins(filePath) {
	const obj = loadGoblins(filePath);
	const guilds = obj.guilds || [];
	guilds.forEach((g) => {
		console.log(`\nGuild: ${g.name} (${g.id})`);
		(g.toolbelt || []).forEach((t) => {
			console.log(`  - id: ${t.id}`);
			console.log(`    name: ${t.name}`);
			if (t.owner) console.log(`    owner: ${t.owner}`);
			if (t.summary) console.log(`    summary: ${t.summary}`);
		});
	});
}

function findTool(obj, id) {
	const guilds = obj.guilds || [];
	for (const g of guilds) {
		for (const t of g.toolbelt || []) {
			if (t.id === id) return { guild: g, tool: t };
		}
	}
	return null;
}

function isNewStyleGoblin(toolId) {
	// Check if this goblin has a package structure in packages/goblins/
	const goblinPath = path.resolve(__dirname, "../../packages/goblins", toolId);
	const hasPackageJson = fs.existsSync(path.join(goblinPath, "package.json"));
	const hasIndexTs = fs.existsSync(path.join(goblinPath, "src/index.ts"));
	const hasDefaultJson = fs.existsSync(path.join(goblinPath, "config/default.json"));
	console.log(`Checking if ${toolId} is new-style:`, { goblinPath, hasPackageJson, hasIndexTs, hasDefaultJson });
	return hasPackageJson && hasIndexTs && hasDefaultJson;
}

async function runNewStyleGoblin(tool, opts = { dry: false, unsafe: false }) {
	console.log(`${opts.dry ? "[DRY] " : ""}Running new-style goblin: ${tool.id}`);

	if (opts.dry) {
		console.log(`Would initialize and execute goblin: ${tool.id}`);
		return;
	}

	try {
		// Create GoblinLoader
		const loader = new GoblinLoader({
			goblinDir: path.resolve(__dirname, "../../packages/goblins")
		});

		// Load only the specific goblin we want to run
		await loader.loadAllGoblins();

		// Get the goblin instance
		const goblinPackage = loader.getGoblin(tool.id);
		if (!goblinPackage) {
			console.error(`Goblin ${tool.id} not found in GoblinLoader`);
			process.exit(2);
		}

		// Initialize the goblin
		await goblinPackage.goblin.initialize();

		// Execute the goblin (provide a simple test input)
		const testContext = {
			input: {
				message: "Hello, this is a test message for the overmind goblin",
				context: [],
				metadata: { test: true }
			}
		};
		const result = await goblinPackage.goblin.execute(testContext);

		// Shutdown the goblin
		await goblinPackage.goblin.shutdown();

		console.log(`✅ Goblin ${tool.id} completed successfully`);
		console.log(`Result:`, result);

	} catch (error) {
		console.error(`❌ Failed to run goblin ${tool.id}:`, error);
		process.exit(1);
	}
}

async function runTool(tool, opts = { dry: false, unsafe: false }) {
	if (!tool.command) {
		console.error("Tool has no command defined");
		process.exit(2);
	}

	// If the tool is explicitly marked unsafe and caller didn't pass --unsafe, refuse
	if (tool.safe === false && !opts.unsafe) {
		console.error(
			"Refusing to run: this goblin is marked as unsafe. Pass --unsafe to override.",
		);
		process.exit(3);
	}

	// Check if this is a new-style goblin package
	console.log(`Checking goblin ${tool.id}, GoblinLoader available:`, !!GoblinLoader);
	if (isNewStyleGoblin(tool.id)) {
		console.log(`Running ${tool.id} as new-style goblin`);
		// Load GoblinLoader if not available
		if (!GoblinLoader) {
			try {
				const goblinRuntime = await import("@goblinos/goblin-runtime");
				GoblinLoader = goblinRuntime.GoblinLoader;
			} catch (e) {
				console.error("Failed to load GoblinLoader:", e.message);
				process.exit(1);
			}
		}
		return await runNewStyleGoblin(tool, opts);
	}

	// Fall back to old-style shell command execution
	console.log(
		`${opts.dry ? "[DRY] " : ""}Running goblin: ${tool.id} -> ${tool.command}`,
	);

	// Central run-logging: write a per-run JSON file under GoblinOS/.runs (or directory from env)
	const RUNS_DIR =
		process.env.GOBLIN_RUNS_DIR || path.resolve(__dirname, "../../.runs");
	const RUN_ENDPOINT = process.env.GOBLIN_RUN_ENDPOINT || null;

	// ensure runs dir exists
	try {
		fs.mkdirSync(RUNS_DIR, { recursive: true });
	} catch (e) {}

	const runId = `${Date.now()}-${tool.id}-${Math.random().toString(36).slice(2, 8)}`;
	const runFile = path.join(RUNS_DIR, `${runId}.json`);

	function writeRun(obj) {
		try {
			fs.writeFileSync(runFile, JSON.stringify(obj, null, 2), {
				encoding: "utf8",
			});
		} catch (e) {
			console.error(
				"Failed to write run file:",
				e && e.message ? e.message : e,
			);
		}
		if (RUN_ENDPOINT) {
			postRun(RUN_ENDPOINT, obj).catch((err) => {
				console.error(
					"Failed to POST run event:",
					err && err.message ? err.message : err,
				);
			});
		}
	}

	async function postRun(urlStr, payload) {
		// support retries and optional auth header
		const maxRetries = Number.parseInt(
			process.env.GOBLIN_RUN_RETRIES || "2",
			10,
		);
		const baseDelay = Number.parseInt(
			process.env.GOBLIN_RUN_RETRY_DELAY_MS || "1000",
			10,
		);
		const authToken = process.env.GOBLIN_RUN_ENDPOINT_TOKEN || null;
		const authHeader = process.env.GOBLIN_RUN_AUTH_HEADER || "Authorization";

		function delay(ms) {
			return new Promise((resolve) => setTimeout(resolve, ms));
		}

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const urlObj = new URL(urlStr);
				const lib =
					urlObj.protocol === "https:" ? require("https") : require("http");
				const data = JSON.stringify(payload);
				const headers = {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(data),
				};
				if (authToken) headers[authHeader] = authToken;

				const result = await new Promise((resolve, reject) => {
					const req = lib.request(
						urlObj,
						{
							method: "POST",
							headers,
							timeout: 5000,
						},
						(res) => {
							const chunks = [];
							res.on("data", (c) => chunks.push(c));
							res.on("end", () => resolve(Buffer.concat(chunks).toString()));
						},
					);
					req.on("error", reject);
					req.on("timeout", () => {
						req.destroy(new Error("timeout"));
					});
					req.write(data);
					req.end();
				});
				return result;
			} catch (err) {
				if (attempt < maxRetries) {
					const backoff = baseDelay * Math.pow(2, attempt);
					console.error(
						`POST attempt ${attempt + 1} failed, retrying in ${backoff}ms:`,
						err && err.message ? err.message : err,
					);
					await delay(backoff);
					continue;
				}
				throw err;
			}
		}
		return null;
	}

	if (opts.dry) {
		const ev = {
			type: "dry-run",
			id: tool.id,
			command: tool.command,
			ts: new Date().toISOString(),
			user: process.env.USER || process.env.USERNAME || "unknown",
		};
		writeRun(ev);
		return;
	}

	const startTs = new Date();
	const runObj = {
		id: tool.id,
		command: tool.command,
		start: {
			ts: startTs.toISOString(),
			user: process.env.USER || process.env.USERNAME || "unknown",
		},
	};
	writeRun(runObj);

	const proc = child_process.spawn(tool.command, {
		shell: true,
		stdio: "inherit",
		env: process.env,
	});
	proc.on("exit", (code) => {
		const endTs = new Date();
		const updated = Object.assign({}, runObj, {
			end: {
				ts: endTs.toISOString(),
				code: code,
				duration_ms: endTs - startTs,
			},
		});
		writeRun(updated);
		process.exit(code);
	});
}

function usage() {
	console.log("goblin-cli list");
	console.log("goblin-cli run <id> [--dry] [--unsafe]");
	console.log("goblin-cli runs [--id <goblin-id>] [--limit N] [--json]");
	process.exit(1);
}

function listRuns(opts = { id: null, limit: 50, json: false }) {
	const RUNS_DIR =
		process.env.GOBLIN_RUNS_DIR || path.resolve(__dirname, "../../.runs");
	if (!fs.existsSync(RUNS_DIR)) {
		console.log("No runs directory found at", RUNS_DIR);
		return;
	}
	const files = fs.readdirSync(RUNS_DIR).filter((f) => f.endsWith(".json"));
	const items = files
		.map((f) => {
			try {
				const p = path.join(RUNS_DIR, f);
				const raw = fs.readFileSync(p, "utf8");
				const obj = JSON.parse(raw);
				obj.__file = f;
				return obj;
			} catch (e) {
				return null;
			}
		})
		.filter(Boolean);
	// sort by start.ts or file name desc
	items.sort((a, b) => {
		const aTs = (a.start && a.start.ts) || a.ts || a._ts || 0;
		const bTs = (b.start && b.start.ts) || b.ts || b._ts || 0;
		return new Date(bTs) - new Date(aTs);
	});
	const filtered = opts.id ? items.filter((i) => i.id === opts.id) : items;
	const out = filtered.slice(0, opts.limit || 50);
	if (opts.json) {
		console.log(JSON.stringify(out, null, 2));
		return;
	}
	out.forEach((it) => {
		console.log(
			`- file: ${it.__file} id: ${it.id} cmd: ${it.command || (it.start && it.start.command) || ""}`,
		);
		if (it.start)
			console.log(`    start: ${it.start.ts} user: ${it.start.user || ""}`);
		if (it.end)
			console.log(
				`    end: ${it.end.ts} code: ${it.end.code} duration_ms: ${it.end.duration_ms}`,
			);
	});
}

async function main() {
	const args = process.argv.slice(2);
	if (args.length === 0) return usage();
	const cmd = args[0];
	if (cmd === "list") {
		listGoblins(GOBLINS_FILE);
		return;
	}
	if (cmd === "runs") {
		// parse options: --id <id> --limit N --json
		const idIndex = args.indexOf("--id");
		const id = idIndex !== -1 ? args[idIndex + 1] : null;
		const limitIndex = args.indexOf("--limit");
		const limit =
			limitIndex !== -1 ? Number.parseInt(args[limitIndex + 1], 10) : 50;
		const json = args.includes("--json");
		listRuns({ id, limit, json });
		return;
	}
	if (cmd === "run") {
		const id = args[1];
		if (!id) return usage();
		const dry = args.includes("--dry");
		const unsafe = args.includes("--unsafe");
		const obj = loadGoblins(GOBLINS_FILE);
		const found = findTool(obj, id);
		if (!found) {
			console.error("No goblin with id", id);
			process.exit(2);
		}
		// basic validation: require id, name, command
		const t = found.tool;
		if (!t.id || !t.name || !t.command) {
			console.error("Goblin entry invalid: missing id/name/command");
			process.exit(2);
		}
		runTool(t, { dry, unsafe });
		return;
	}
	usage();
}

main();
