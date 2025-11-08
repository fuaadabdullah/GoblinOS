import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import {
	type GuildMemberReference,
	type GuildRegistry,
	GuildRegistryError,
	GuildRegistrySchema,
	type GuildRegistrySource,
	type GuildToolReference,
	type GuildWithLookups,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CONFIG_CANDIDATES = [
	process.env.GOBLINOS_CONFIG_PATH,
	path.resolve(process.cwd(), "goblins.yaml"),
	path.resolve(__dirname, "../../../../../goblins.yaml"),
	path.resolve(__dirname, "../../../../../../goblins.yaml"),
].filter(Boolean) as string[];

let cachedRegistry: GuildRegistry | null = null;
let cachedConfigPath: string | null = null;

async function resolveConfigPath(configPath?: string) {
	const candidates = [configPath, ...DEFAULT_CONFIG_CANDIDATES];
	for (const candidate of candidates) {
		if (!candidate) continue;
		try {
			await fsp.access(candidate, fs.constants.R_OK);
			return candidate;
		} catch {}
	}
	throw new GuildRegistryError(
		"Unable to locate goblins.yaml configuration file",
	);
}

function resolveConfigPathSync(configPath?: string) {
	const candidates = [configPath, ...DEFAULT_CONFIG_CANDIDATES];
	for (const candidate of candidates) {
		if (!candidate) continue;
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}
	throw new GuildRegistryError(
		"Unable to locate goblins.yaml configuration file",
	);
}

function buildRegistry(source: GuildRegistrySource): GuildRegistry {
	const guilds: GuildWithLookups[] = source.guilds.map(normalizeGuild);

	const guildMap = new Map<string, GuildWithLookups>();
	const memberMap = new Map<string, GuildMemberReference>();
	const toolMap = new Map<string, GuildToolReference>();

	for (const guild of guilds) {
		guildMap.set(guild.id, guild);
		for (const tool of guild.toolbelt) {
			toolMap.set(tool.id, tool);
		}
		for (const member of guild.members) {
			memberMap.set(member.id, member);
		}
	}

	return {
		overmind: source.overmind,
		guilds,
		guildMap,
		memberMap,
		toolMap,
	};
}

function normalizeGuild(
	source: GuildRegistrySource["guilds"][number],
): GuildWithLookups {
	const memberIds = new Set(source.members.map((member) => member.id));
	if (memberIds.size !== source.members.length) {
		throw new GuildRegistryError(
			`Duplicate member IDs detected in guild ${source.id}`,
		);
	}

	const toolMap = new Map<string, GuildToolReference>();
	for (const tool of source.toolbelt) {
		if (toolMap.has(tool.id)) {
			throw new GuildRegistryError(
				`Duplicate tool id "${tool.id}" in guild ${source.id}`,
			);
		}
		if (!memberIds.has(tool.owner)) {
			throw new GuildRegistryError(
				`Tool "${tool.id}" in guild ${source.id} references unknown owner ${tool.owner}`,
			);
		}
		toolMap.set(tool.id, { ...tool, guildId: source.id });
	}

	const memberMap = new Map<string, GuildMemberReference>();
	const members: GuildMemberReference[] = source.members.map((member) => {
		const toolRefs = (member.tools ?? []).map((toolId) => {
			const tool = toolMap.get(toolId);
			if (!tool) {
				throw new GuildRegistryError(
					`Member ${member.id} in guild ${source.id} references unknown tool ${toolId}`,
				);
			}
			return tool;
		});

		const memberRef: GuildMemberReference = {
			...member,
			tools: member.tools ? [...member.tools] : undefined,
			guildId: source.id,
			toolDetails: [...toolRefs],
		};
		memberMap.set(member.id, memberRef);
		return memberRef;
	});

	for (const tool of toolMap.values()) {
		const owner = memberMap.get(tool.owner);
		if (!owner) {
			throw new GuildRegistryError(
				`Tool "${tool.id}" in guild ${source.id} references unknown owner ${tool.owner}`,
			);
		}
		const alreadyAssigned = owner.toolDetails.some(
			(assigned) => assigned.id === tool.id,
		);
		if (!alreadyAssigned) {
			owner.toolDetails.push(tool);
			if (owner.tools) {
				if (!owner.tools.includes(tool.id)) {
					owner.tools.push(tool.id);
				}
			} else {
				owner.tools = [tool.id];
			}
		}
	}

	return {
		...source,
		members,
		toolbelt: Array.from(toolMap.values()),
		toolMap,
		memberMap,
	};
}

/**
 * Backwards/forwards compatibility shim for goblins.yaml
 * - Allows "brain" to be used instead of "litebrain"
 * - Fills missing guild/member ids and names
 * - Normalizes member.tools from object { owned: [] } to string[]
 * - Provides minimal defaults for required overmind.telemetry/pr_gates
 */
function migrateRegistrySource(raw: unknown): unknown {
	if (!raw || typeof raw !== "object") return raw;
	const data: any = JSON.parse(JSON.stringify(raw)); // cheap deep clone

	// Helper: slugify a string into an id
	const slug = (s: string) =>
		s
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, "")
			.trim()
			.replace(/\s+/g, "-");

	// Overmind compatibility
	if (data.overmind) {
		const o = data.overmind;
		if (!o.litebrain && o.brain) {
			o.litebrain = o.brain;
			delete o.brain;
		}
		// Ensure telemetry exists
		if (!o.telemetry) o.telemetry = {};
		if (!o.telemetry.router_audit_topic) {
			o.telemetry.router_audit_topic = "goblinos.router.audit";
		}
		// Ensure pr_gates exists
		if (!Array.isArray(o.pr_gates)) o.pr_gates = [];
	}

	// Guilds compatibility
	if (Array.isArray(data.guilds)) {
		for (const g of data.guilds) {
			if (!g.id && g.name) g.id = slug(g.name);

			if (Array.isArray(g.members)) {
				for (const m of g.members) {
					// Allow "brain" alias for members
					if (!m.litebrain && m.brain) {
						m.litebrain = m.brain;
						delete m.brain;
					}
					// Ensure a name exists
					if (!m.name) {
						// Prefer a title if present, otherwise id
						m.name =
							typeof m.title === "string" && m.title.trim().length > 0
								? m.title
								: m.id;
					}
					// Normalize tools: { owned: [...] } -> [...]
					if (
						m.tools &&
						!Array.isArray(m.tools) &&
						typeof m.tools === "object"
					) {
						const owned = Array.isArray(m.tools.owned) ? m.tools.owned : [];
						m.tools = owned;
					}
				}
			}
		}
	}

	return data;
}

function parseRegistryContents(contents: string): GuildRegistry {
	const parsed = yaml.load(contents);
	if (!parsed || typeof parsed !== "object") {
		throw new GuildRegistryError("goblins.yaml is empty or malformed");
	}
	const migrated = migrateRegistrySource(parsed);
	const source = GuildRegistrySchema.parse(migrated);
	return buildRegistry(source);
}

export interface LoadOptions {
	configPath?: string;
	reload?: boolean;
}

export async function loadRegistry(
	options: LoadOptions = {},
): Promise<GuildRegistry> {
	const configPath = await resolveConfigPath(options.configPath);
	if (!options.reload && cachedRegistry && cachedConfigPath === configPath) {
		return cachedRegistry;
	}
	const contents = await fsp.readFile(configPath, "utf8");
	const registry = parseRegistryContents(contents);
	cachedRegistry = registry;
	cachedConfigPath = configPath;
	return registry;
}

export function loadRegistrySync(options: LoadOptions = {}): GuildRegistry {
	const configPath = resolveConfigPathSync(options.configPath);
	if (!options.reload && cachedRegistry && cachedConfigPath === configPath) {
		return cachedRegistry;
	}
	const contents = fs.readFileSync(configPath, "utf8");
	const registry = parseRegistryContents(contents);
	cachedRegistry = registry;
	cachedConfigPath = configPath;
	return registry;
}

export function clearRegistryCache() {
	cachedRegistry = null;
	cachedConfigPath = null;
}
