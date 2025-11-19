/**
 * Tool Selector — Automatic tool selection for GoblinOS goblins
 * Maps task intents to appropriate toolbelt commands based on goblin responsibilities
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
// @ts-ignore
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// Prefer the 'yaml' package if available; otherwise fallback to 'js-yaml'
let yaml: any;
try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	yaml = require("yaml");
} catch (err) {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	yaml = require("js-yaml");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface SelectionRule {
	trigger: string;
	tool: string | null;
	note?: string;
}

export interface GoblinTools {
	owned: string[];
	selection_rules: SelectionRule[];
}

export interface Goblin {
	id: string;
	title: string;
	brain: {
		local: string[];
		routers: string[];
		embeddings?: string;
	};
	responsibilities: string[];
	kpis: string[];
	tools?: GoblinTools;
}

export interface Guild {
	name: string;
	charter: string;
	toolbelt?: Array<{
		id: string;
		name: string;
		summary: string;
		owner: string;
		command: string;
	}>;
	members: Goblin[];
}

export interface GoblinsConfig {
	overmind: {
		name: string;
		title: string;
		brain: {
			local: string[];
			routers: string[];
			embeddings: string;
		};
	};
	guilds: Guild[];
}

export class ToolSelector {
	private config: GoblinsConfig;
	private goblinMap: Map<string, { goblin: Goblin; guild: Guild }>;

	constructor(configPath: string = join(__dirname, "../../../goblins.yaml")) {
	const yamlContent = readFileSync(configPath, "utf8");
	this.config = yaml.parse ? yaml.parse(yamlContent) : yaml.load(yamlContent);
		this.goblinMap = this.buildGoblinMap();
	}

	private buildGoblinMap(): Map<string, { goblin: Goblin; guild: Guild }> {
		const map = new Map();
		for (const guild of this.config.guilds) {
			for (const member of guild.members) {
				map.set(member.id, { goblin: member, guild });
			}
		}
		return map;
	}

	/**
	 * Basic helper: normalize text for comparison
	 */
	private normalize(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, " ")
			.replace(/\s+/g, " ")
			.trim();
	}

	/**
	 * Tokenize to a set of words (for fuzzy matching)
	 */
	private tokens(text: string): Set<string> {
		return new Set(this.normalize(text).split(" ").filter(Boolean));
	}

	/**
	 * Compute overlap between trigger and intent (Jaccard-like on tokens)
	 */
	private similarity(trigger: string, intent: string): number {
		const a = this.tokens(trigger);
		const b = this.tokens(intent);
		if (a.size === 0) return 0;
		let inter = 0;
		for (const t of a) if (b.has(t)) inter++;
		return inter / a.size;
	}

	/**
	 * Select appropriate tool for a goblin based on task intent (first best match)
	 */
	selectTool(goblinId: string, taskIntent: string): string | null {
		const entry = this.goblinMap.get(goblinId);
		if (!entry) {
			throw new Error(`Goblin ${goblinId} not found`);
		}

		const { goblin } = entry;
		if (!goblin.tools || !goblin.tools.selection_rules) {
			return null;
		}

		const normalizedIntent = this.normalize(taskIntent);

		// First pass: strict substring includes
		for (const rule of goblin.tools.selection_rules) {
			if (normalizedIntent.includes(this.normalize(rule.trigger))) {
				return rule.tool;
			}
		}

		// Second pass: fuzzy — choose highest similarity above threshold
		let best: { tool: string | null; score: number } | null = null;
		for (const rule of goblin.tools.selection_rules) {
			const score = this.similarity(rule.trigger, taskIntent);
			if (!best || score > best.score) {
				best = { tool: rule.tool, score };
			}
		}
		if (best && best.score >= 0.6) {
			return best.tool;
		}

		return null;
	}

	/**
	 * Select multiple tools when the intent contains multiple actions.
	 * Returns tools in the order the rules appear; de-duplicates.
	 */
	selectTools(goblinId: string, taskIntent: string): string[] {
		const entry = this.goblinMap.get(goblinId);
		if (!entry) {
			throw new Error(`Goblin ${goblinId} not found`);
		}
		const { goblin } = entry;
		if (!goblin.tools || !goblin.tools.selection_rules) {
			return [];
		}
		const intentNorm = this.normalize(taskIntent);
		const picked: string[] = [];
		const add = (tool: string | null) => {
			if (!tool) return;
			if (!picked.includes(tool)) picked.push(tool);
		};
		// Strict includes for any rule matched
		for (const rule of goblin.tools.selection_rules) {
			if (intentNorm.includes(this.normalize(rule.trigger))) add(rule.tool);
		}
		// If nothing, try fuzzy and include all rules above threshold
		if (picked.length === 0) {
			for (const rule of goblin.tools.selection_rules) {
				const score = this.similarity(rule.trigger, taskIntent);
				if (score >= 0.6) add(rule.tool);
			}
		}
		return picked;
	}

	/**
	 * Get tool command from guild toolbelt
	 */
	getToolCommand(goblinId: string, toolId: string): string | null {
		const entry = this.goblinMap.get(goblinId);
		if (!entry) {
			throw new Error(`Goblin ${goblinId} not found`);
		}

		const { guild } = entry;
		if (!guild.toolbelt) {
			return null;
		}

		const tool = guild.toolbelt.find((t) => t.id === toolId);
		return tool ? tool.command : null;
	}

	/**
	 * Get all tools owned by a goblin
	 */
	getOwnedTools(goblinId: string): string[] {
		const entry = this.goblinMap.get(goblinId);
		if (!entry || !entry.goblin.tools) {
			return [];
		}
		return entry.goblin.tools.owned;
	}

	/**
	 * Check if a goblin can invoke a specific tool
	 */
	canInvokeTool(goblinId: string, toolId: string): boolean {
		const ownedTools = this.getOwnedTools(goblinId);
		return ownedTools.includes(toolId);
	}

	/**
	 * Get all goblins that own a specific tool
	 */
	getToolOwners(toolId: string): string[] {
		const owners: string[] = [];
		for (const [goblinId, entry] of this.goblinMap.entries()) {
			if (entry.goblin.tools?.owned.includes(toolId)) {
				owners.push(goblinId);
			}
		}
		return owners;
	}

	/**
	 * Automatically select and return tool command for a task
	 */
	autoSelectToolCommand(
		goblinId: string,
		taskIntent: string,
	): {
		tool: string | null;
		command: string | null;
		reason: string;
	} {
		const toolId = this.selectTool(goblinId, taskIntent);

		if (!toolId) {
			return {
				tool: null,
				command: null,
				reason: `No tool found for task: "${taskIntent}". Goblin will use brain only.`,
			};
		}

		// Ownership Validation: Verify that the selected tool ID is present in the goblin's owned tools list
		if (!this.canInvokeTool(goblinId, toolId)) {
			throw new Error(`Permission denied: Goblin ${goblinId} does not own tool ${toolId}`);
		}

		const command = this.getToolCommand(goblinId, toolId);

		if (!command) {
			return {
				tool: toolId,
				command: null,
				reason: `Tool ${toolId} not found in guild toolbelt`,
			};
		}

		return {
			tool: toolId,
			command,
			reason: `Selected ${toolId} based on task intent`,
		};
	}

	/**
	 * Automatically select a tool chain and return all commands
	 */
	autoSelectToolChain(
		goblinId: string,
		taskIntent: string,
	): {
		tools: string[];
		commands: (string | null)[];
		reasons: string[];
	} {
		const tools = this.selectTools(goblinId, taskIntent);
		if (tools.length === 0) {
			return {
				tools: [],
				commands: [],
				reasons: [
					`No tools matched for task: "${taskIntent}". Goblin will use brain only.`,
				],
			};
		}
		const commands = tools.map((t) => this.getToolCommand(goblinId, t));
		const reasons = tools.map(
			(t) => `Selected ${t} based on intent or fuzzy match`,
		);
		return { tools, commands, reasons };
	}
}

// Export singleton instance
let instance: ToolSelector | null = null;

export function getToolSelector(configPath?: string): ToolSelector {
	if (!instance) {
		instance = new ToolSelector(configPath);
	}
	return instance;
}
