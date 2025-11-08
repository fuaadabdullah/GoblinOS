#!/usr/bin/env node
/**
 * CI validator for Ollama configuration.
 * - Detects if goblins.yaml references local models (e.g., 'ollama', 'ollama-coder')
 * - Checks whether OLLAMA_BASE_URL is provided via env or GoblinOS/.env
 * - If CI_OLLAMA_REQUIRED=true and Ollama is referenced but no base URL is present, exits 1
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
		String(process.env.CI_OLLAMA_REQUIRED || "false").toLowerCase() === "true";
	const cfgRaw = fs.readFileSync(yamlPath, "utf8");
	const cfg = yaml.parse(cfgRaw);

	let usesOllama = false;
	const isOllamaLocal = (val) => String(val).toLowerCase().includes("ollama");
	if (Array.isArray(cfg?.overmind?.brain?.local)) {
		usesOllama = usesOllama || cfg.overmind.brain.local.some(isOllamaLocal);
	}
	for (const guild of cfg.guilds || []) {
		for (const m of guild.members || []) {
			if (Array.isArray(m?.brain?.local) && m.brain.local.some(isOllamaLocal)) {
				usesOllama = true;
				break;
			}
		}
	}

	const envHasBase = Boolean(
		process.env.OLLAMA_BASE_URL && process.env.OLLAMA_BASE_URL.trim(),
	);
	const dot = parseDotEnv(dotenvPath);
	const dotHasBase = Boolean(
		dot.OLLAMA_BASE_URL && String(dot.OLLAMA_BASE_URL).trim(),
	);
	const hasAnyBase = envHasBase || dotHasBase;

	const summary = {
		usesOllama,
		baseConfigured: hasAnyBase,
		mode: ciStrict ? "strict" : "permissive",
	};

	if (!usesOllama) {
		console.log(
			`[Ollama] No local ollama models referenced. Summary: ${JSON.stringify(summary)}`,
		);
		process.exit(0);
	}

	if (hasAnyBase) {
		console.log(
			`[Ollama] OK — OLLAMA_BASE_URL present. Summary: ${JSON.stringify(summary)}`,
		);
		process.exit(0);
	}

	if (ciStrict) {
		console.error(
			"[Ollama] ERROR: Goblins reference local ollama models but OLLAMA_BASE_URL not found in env or GoblinOS/.env",
		);
		process.exit(1);
	} else {
		console.warn(
			"[Ollama] WARNING: Local ollama models referenced but no base URL configured. CI running permissively.",
		);
		console.log(`Summary: ${JSON.stringify(summary)}`);
		process.exit(0);
	}
}

main();
