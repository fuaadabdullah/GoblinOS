#!/usr/bin/env node
/**
 * generate-roles.js
 * Reads GoblinOS/goblins.yaml and generates GoblinOS/docs/ROLES.md
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import yaml from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const YAML_PATH = join(ROOT, "goblins.yaml");
const ROLES_PATH = join(ROOT, "docs", "ROLES.md");

function main() {
	const yamlContent = readFileSync(YAML_PATH, "utf8");
	const config = yaml.parse(yamlContent);

	const lines = [];
	lines.push("# GoblinOS Roles — Overview");
	lines.push("");
	lines.push(`Last updated: ${new Date().toISOString().split("T")[0]}`);
	lines.push("Source of truth: `GoblinOS/goblins.yaml`");
	lines.push("");
	lines.push(
		"This document is generated from the YAML and summarizes the Overmind, guilds, members, brains, and KPIs.",
	);
	lines.push("");

	// Overmind
	if (config.overmind) {
		const { name, title, brain } = config.overmind;
		lines.push("## Overmind");
		lines.push("");
		lines.push(`- Name: ${name} — ${title}`);
		lines.push("- Brain");
		lines.push(`  - Local: ${brain.local.join(", ")}`);
		lines.push(`  - Routers: ${brain.routers.join(", ")}`);
		if (brain.embeddings) {
			lines.push(`  - Embeddings: ${brain.embeddings}`);
		}
		lines.push("");
	}

	// Guilds
	lines.push("## Guilds");
	lines.push("");

	for (const guild of config.guilds || []) {
		lines.push(`### ${guild.name}`);
		if (guild.charter) {
			lines.push(`- Charter: ${guild.charter}`);
		}

		// Toolbelt
		if (guild.toolbelt && guild.toolbelt.length > 0) {
			lines.push("- Toolbelt:");
			for (const tool of guild.toolbelt) {
				lines.push(`  - **${tool.id}** — ${tool.name}`);
				lines.push(`    - Summary: ${tool.summary}`);
				lines.push(`    - Owner: ${tool.owner}`);
				lines.push(`    - Command: \`${tool.command}\``);
			}
		}

		lines.push("- Members");

		for (const member of guild.members || []) {
			lines.push(`  - ${member.id} — ${member.title}`);
			const { brain } = member;
			const localStr = brain.local.join(", ");
			const routersStr = brain.routers.join(", ");
			let brainLine = `    - Brain: local=[${localStr}], routers=[${routersStr}]`;
			if (brain.embeddings) {
				brainLine += `, embeddings=[${brain.embeddings}]`;
			}
			lines.push(brainLine);

			if (member.responsibilities && member.responsibilities.length > 0) {
				lines.push("    - Responsibilities:");
				for (const resp of member.responsibilities) {
					lines.push(`      - ${resp}`);
				}
			}

			if (member.tools) {
				lines.push("    - Tools:");
				lines.push(
					`      - Owned: ${member.tools.owned.length > 0 ? member.tools.owned.join(", ") : "None"}`,
				);
				if (
					member.tools.selection_rules &&
					member.tools.selection_rules.length > 0
				) {
					lines.push("      - Selection Rules:");
					for (const rule of member.tools.selection_rules) {
						if (rule.tool) {
							lines.push(`        - "${rule.trigger}" → ${rule.tool}`);
						} else {
							lines.push(
								`        - "${rule.trigger}" → Brain only${rule.note ? ` (${rule.note})` : ""}`,
							);
						}
					}
				}
			}

			if (member.kpis && member.kpis.length > 0) {
				lines.push(`    - KPIs: ${member.kpis.join(", ")}`);
			}
		}
		lines.push("");
	}

	lines.push("---");
	lines.push("");
	lines.push("Notes");
	lines.push(
		"- The YAML is the single source of truth; update it to reflect org/role changes. Re-generate this file after edits.",
	);
	lines.push(
		"- KPIs are named metrics; thresholds/targets are tracked in telemetry systems and PR gates.",
	);
	lines.push("");

	const markdown = lines.join("\n");
	writeFileSync(ROLES_PATH, markdown, "utf8");
	console.log(`✅ Generated ${ROLES_PATH}`);
}

main();
