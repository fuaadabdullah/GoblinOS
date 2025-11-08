import { GuildRegistryError } from "@goblinos/registry";
import type { LiteBrainConfig } from "./base.js";
import { CraftersLiteBrain } from "./crafters.js";
import { ForgeLiteBrain } from "./forge.js";
import { HuntressLiteBrain } from "./huntress.js";
import { KeepersLiteBrain } from "./keepers.js";
import { MagesLiteBrain } from "./mages.js";
import {
	getMemberLiteBrainConfig,
	getRegistry,
	resolveGuildMember,
} from "./registry.js";
export * from "./base.js";
export * from "./forge.js";
export * from "./crafters.js";
export * from "./huntress.js";
export * from "./keepers.js";
export * from "./mages.js";

export const GUILD_MEMBER_IDS = [
	"dregg-embercode",
	"vanta-lumin",
	"volt-furnace",
	"magnolia-nightbloom",
	"mags-charietto",
	"sentenial-ledgerwarden",
	"hex-oracle",
	"grim-rune",
	"launcey-gauge",
] as const;

export type GuildMemberId = (typeof GUILD_MEMBER_IDS)[number];

const registry = getRegistry();
const registryMemberIds = new Set(registry.memberMap.keys());
const knownMemberIds = new Set<string>(GUILD_MEMBER_IDS as unknown as string[]);

for (const id of registryMemberIds) {
	if (!knownMemberIds.has(id)) {
		throw new GuildRegistryError(
			`Guild member \"${id}\" exists in goblins.yaml but is not represented in @goblinos/brains.`,
		);
	}
}

for (const id of knownMemberIds) {
	if (!registryMemberIds.has(id)) {
		throw new GuildRegistryError(
			`Guild member \"${id}\" is referenced in @goblinos/brains but missing from goblins.yaml.`,
		);
	}
}

export function createLiteBrain(member: GuildMemberId) {
	resolveGuildMember(member);
	switch (member) {
		case "dregg-embercode":
			return new ForgeLiteBrain();
		case "vanta-lumin":
			return new CraftersLiteBrain("vanta-lumin");
		case "volt-furnace":
			return new CraftersLiteBrain("volt-furnace");
		case "magnolia-nightbloom":
			return new HuntressLiteBrain("magnolia-nightbloom");
		case "mags-charietto":
			return new HuntressLiteBrain("mags-charietto");
		case "sentenial-ledgerwarden":
			return new KeepersLiteBrain();
		case "hex-oracle":
			return new MagesLiteBrain("hex-oracle");
		case "grim-rune":
			return new MagesLiteBrain("grim-rune");
		case "launcey-gauge":
			return new MagesLiteBrain("launcey-gauge");
		default:
			throw new GuildRegistryError(`Unknown guild member: ${member}`);
	}
}

export function getLiteBrainDefaults(member: GuildMemberId): LiteBrainConfig {
	return getMemberLiteBrainConfig(member);
}
