#!/usr/bin/env node
/**
 * CI validator for DeepSeek configuration.
 * - Detects if goblins.yaml references DeepSeek routers (e.g., deepseek-r1)
 * - Checks whether DEEPSEEK_API_KEY is provided via env or GoblinOS/.env
 * - If CI_DEEPSEEK_REQUIRED=true and DeepSeek is referenced but no key is present, exits 1
 * - Otherwise prints a warning and exits 0
 */

import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

const repoRoot = path.resolve(
	path.dirname(new URL(import.meta.url).pathname),
	"..",
);
const yamlPath = path.join(repoRoot, "goblins.yaml");
const dotenvPath = path.join(repoRoot, ".env");

function parseDotEnv(filePath) {
	try {
		const raw = fs.readFileSync(filePath, "utf8");
		const out = {};
		for (const line of raw.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const idx = trimmed.indexOf("=");
			if (idx === -1) continue;
			const key = trimmed.slice(0, idx).trim();
			let val = trimmed.slice(idx + 1).trim();
			if (
				(val.startsWith('"') && val.endsWith('"')) ||
				(val.startsWith("'") && val.endsWith("'"))
			) {
				val = val.slice(1, -1);
			}
			out[key] = val;
		}
		return out;
	} catch {
		return {};
	}
}

function main() {
	const ciStrict =
		String(process.env.CI_DEEPSEEK_REQUIRED || "false").toLowerCase() ===
		"true";
	const cfgRaw = fs.readFileSync(yamlPath, "utf8");
	const cfg = yaml.parse(cfgRaw);

	let usesDeepseek = false;
	if (cfg?.overmind?.brain?.routers) {
		usesDeepseek =
			usesDeepseek ||
			cfg.overmind.brain.routers.some((r) =>
				String(r).toLowerCase().includes("deepseek"),
			);
	}
	for (const guild of cfg.guilds || []) {
		for (const m of guild.members || []) {
			if (
				m?.brain?.routers &&
				m.brain.routers.some((r) =>
					String(r).toLowerCase().includes("deepseek"),
				)
			) {
				usesDeepseek = true;
				break;
			}
		}
	}

	const envHasKey = Boolean(
		process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.trim(),
	);
	const dot = parseDotEnv(dotenvPath);
	const dotHasKey = Boolean(
		dot.DEEPSEEK_API_KEY && String(dot.DEEPSEEK_API_KEY).trim(),
	);
	const hasAnyKey = envHasKey || dotHasKey;

	const fallbacks = [];
	if (process.env.OLLAMA_BASE_URL || dot.OLLAMA_BASE_URL)
		fallbacks.push("ollama");
	if (process.env.LITELLM_BASE_URL || dot.LITELLM_BASE_URL)
		fallbacks.push("litellm");

	const summary = {
		usesDeepseek,
		deepseekKeyPresent: hasAnyKey,
		fallbacks,
		mode: ciStrict ? "strict" : "permissive",
	};

	if (!usesDeepseek) {
		console.log(
			`[DeepSeek] No DeepSeek routers referenced. Summary: ${JSON.stringify(summary)}`,
		);
		process.exit(0);
	}

	if (hasAnyKey) {
		console.log(
			`[DeepSeek] OK — key present. Summary: ${JSON.stringify(summary)}`,
		);
		process.exit(0);
	}

	if (ciStrict) {
		console.error(
			"[DeepSeek] ERROR: DeepSeek routers referenced but DEEPSEEK_API_KEY not found in env or GoblinOS/.env",
		);
		process.exit(1);
	} else {
		console.warn(
			"[DeepSeek] WARNING: DeepSeek routers referenced but no key found. Falling back to other providers if configured.",
		);
		console.log(`Summary: ${JSON.stringify(summary)}`);
		process.exit(0);
	}
}

main();
