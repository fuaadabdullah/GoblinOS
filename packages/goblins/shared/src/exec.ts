import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Logger, createLogger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let repoRootCache: string | null = null;

export interface RunCommandOptions {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	logger?: Logger;
	label?: string;
}

export function runCommand(
	command: string,
	args: string[] = [],
	options: RunCommandOptions = {},
): Promise<void> {
	const logger = options.logger ?? createLogger({ name: "goblin-cli" });
	const cwd = options.cwd ?? process.cwd();
	const label = options.label ?? `${command} ${args.join(" ")}`.trim();

	return new Promise((resolve, reject) => {
		logger.info({ cwd, command, args }, `➡️  Executing ${label}`);

		// If we are launching the packaged agent CLI (python -m forge.agent.cli)
		// route the spawn through Overmind's launch wrapper so it receives the
		// supervisor environment (FORGE_JOBS_DB, concurrency caps, budgets, etc.).
		// We call the wrapper via `sh <script>` to avoid requiring the script to
		// be executable in all environments.
		let spawnCmd = command;
		let spawnArgs = args;

		try {
			const looksLikePython = /(^|\/)python(3|3\..+)?$/.test(command);
			const isAgentModule =
				args.includes("-m") && args.includes("forge.agent.cli");
			if (looksLikePython && isAgentModule) {
				const wrapper = resolveRepoPath(
					"packages/goblins/overmind/scripts/launch_goblin.sh",
				);
				// call: sh <wrapper> -- <original command and args>
				spawnCmd = "sh";
				spawnArgs = [wrapper, "--", command, ...args];
				logger.info(
					{ wrapper, routed: true },
					`↪️  Routed agent launch through ${wrapper}`,
				);
			}
		} catch (e) {
			// best-effort: if something goes wrong resolving the wrapper, fall
			// back to the original command so we don't break other workflows.
			logger.debug(
				{ error: (e as Error).message },
				"Unable to route through launch wrapper; continuing with original command",
			);
		}

		const child = spawn(spawnCmd, spawnArgs, {
			cwd,
			env: { ...process.env, ...options.env },
			stdio: "inherit",
			shell: false,
		});

		child.on("error", (error) => {
			logger.error(
				{ error: error.message, stack: error.stack },
				`❌ Failed to start ${label}`,
			);
			reject(error);
		});

		child.on("exit", (code, signal) => {
			if (code === 0) {
				logger.info({ code }, `✅ Completed ${label}`);
				resolve();
			} else {
				const err = new Error(
					`Command ${command} ${args.join(" ")} exited with code ${code ?? "null"}${signal ? ` (signal ${signal})` : ""}`,
				);
				logger.error({ code, signal }, `❌ ${label} failed`);
				reject(err);
			}
		});
	});
}

export function resolveRepoPath(...segments: string[]) {
	if (!repoRootCache) {
		repoRootCache = findRepoRoot(__dirname);
	}
	return path.resolve(repoRootCache, ...segments);
}

function findRepoRoot(startDir: string) {
	let current = startDir;
	for (let depth = 0; depth < 8; depth += 1) {
		if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
			return current;
		}
		const parent = path.dirname(current);
		if (parent === current) {
			break;
		}
		current = parent;
	}
	return path.resolve(startDir, "../../../../../..");
}
