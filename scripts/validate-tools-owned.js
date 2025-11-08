#!/usr/bin/env node
// Validate that every tools.owned entry for each goblin exists in the guild toolbelt

import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "yaml";

const repoRoot = path.resolve(
	path.dirname(new URL(import.meta.url).pathname),
	"..",
);
const configPath = path.join(repoRoot, "goblins.yaml");

function main() {
	const raw = readFileSync(configPath, "utf8");
	const cfg = yaml.parse(raw);

	const errors = [];
	for (const guild of cfg.guilds || []) {
		const toolIds = new Set((guild.toolbelt || []).map((t) => t.id));
		for (const member of guild.members || []) {
			const toolsNode = member.tools;
			let owned = [];
			if (Array.isArray(toolsNode)) owned = toolsNode;
			else if (toolsNode && Array.isArray(toolsNode.owned))
				owned = toolsNode.owned;
			for (const t of owned) {
				if (!toolIds.has(t)) {
					errors.push(
						`Guild ${guild.name}: member ${member.id} owns unknown tool '${t}'`,
					);
				}
			}
		}
	}

	if (errors.length) {
		console.error("Tool ownership validation failed:");
		for (const e of errors) console.error(`- ${e}`);
		process.exit(1);
	}
	console.log("All tools.owned entries are valid.");
}

main();
