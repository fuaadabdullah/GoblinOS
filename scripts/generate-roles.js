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
const WORKSPACE_ROOT = join(ROOT, "..");
const YAML_PATH = join(ROOT, "goblins.yaml");
const ROLES_PATH = join(ROOT, "docs", "ROLES.md");
const SOURCE_OF_TRUTH_PATH = join(ROOT, "SOURCE_OF_TRUTH.md");
const COPILOT_INSTRUCTIONS_PATH = join(
	WORKSPACE_ROOT,
	".github",
	"copilot-instructions.md",
);
const GUILD_START_MARKER = "<!-- GUILD_SUMMARY_START -->";
const GUILD_END_MARKER = "<!-- GUILD_SUMMARY_END -->";

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

	const guilds = config.guilds || [];
	const filesToUpdate = [
		{
			path: SOURCE_OF_TRUTH_PATH,
			label: "SOURCE_OF_TRUTH.md",
			linkPrefix: "./docs/ROLES.md",
		},
		{
			path: COPILOT_INSTRUCTIONS_PATH,
			label: ".github/copilot-instructions.md",
			linkPrefix: "../GoblinOS/docs/ROLES.md",
		},
	];

	for (const file of filesToUpdate) {
		const summary = buildGuildSummary(guilds, file.linkPrefix);
		updateGuildSummaryInFile(file.path, summary, file.label);
	}
}

function slugify(text) {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function summarizeToolbelt(guild) {
	if (!guild.toolbelt || guild.toolbelt.length === 0) {
		return "Brain-driven workflows only; see member tool ownership below.";
	}
	const entries = guild.toolbelt.map(
		(tool) => `\`${tool.id}\` (${tool.owner})`,
	);
	return entries.join(", ");
}

function describeMember(member) {
	const resp =
		member.responsibilities && member.responsibilities.length > 0
			? member.responsibilities.slice(0, 2).join("; ")
			: "Focus defined in responsibilities";

	const kpis =
		member.kpis && member.kpis.length > 0
			? member.kpis.map((kpi) => `\`${kpi}\``).join(", ")
			: "n/a";

	const ownedTools =
		member.tools && member.tools.owned && member.tools.owned.length > 0
			? member.tools.owned.map((tool) => `\`${tool}\``).join(", ")
			: "Brain workflows only";

	return `  - **${member.title} (\`${member.id}\`)** — ${resp}. KPIs: ${kpis}. Tools: ${ownedTools}.`;
}

function buildGuildSummary(guilds, linkPrefix) {
	const lines = [];

	for (const guild of guilds) {
		const slug = slugify(guild.name);
		lines.push(
			`### ${guild.name} ([full breakdown](${linkPrefix}#${slug}))`,
		);
		if (guild.charter) {
			lines.push(`- **Charter:** ${guild.charter}`);
		}
		lines.push(`- **Toolbelt owners:** ${summarizeToolbelt(guild)}`);
		lines.push("- **Goblins:**");
		for (const member of guild.members || []) {
			lines.push(describeMember(member));
		}
		lines.push("");
	}

	return lines.join("\n").trim();
}

function updateGuildSummaryInFile(filePath, summary, label) {
	const current = readFileSync(filePath, "utf8");

	const startIndex = current.indexOf(GUILD_START_MARKER);
	const endIndex = current.indexOf(GUILD_END_MARKER, startIndex);

	if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
		throw new Error(
			`Guild summary markers not found in ${filePath}. Please ensure the markers exist.`,
		);
	}

	const before = current.slice(0, startIndex + GUILD_START_MARKER.length);
	const after = current.slice(endIndex);

	const updated = `${before}\n${summary}\n${after}`;
	writeFileSync(filePath, updated, "utf8");
	console.log(`✅ Updated guild summary in ${label}`);
}

main();
