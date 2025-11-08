import { z } from "zod";

export const LiteBrainConfigSchema = z.object({
	local: z.array(z.string()).default([]),
	routers: z.array(z.string()).default([]),
	embeddings: z.union([z.string(), z.array(z.string())]).optional(),
	temperature: z.number().optional(),
	max_tokens: z.number().optional(),
	timeout: z.number().optional(),
	analytics_tag: z.string().optional(),
});

export type LiteBrainConfigInput = z.infer<typeof LiteBrainConfigSchema>;

const ToolArgumentSchema = z.object({
	name: z.string().min(1),
	type: z.enum(["string", "number", "boolean", "enum"]).default("string"),
	description: z.string().optional(),
	default: z.union([z.string(), z.number(), z.boolean()]).optional(),
	options: z.array(z.union([z.string(), z.number()])).optional(),
	required: z.boolean().default(false),
});

export type ToolArgument = z.infer<typeof ToolArgumentSchema>;

export const GuildToolSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	command: z.string().min(1),
	summary: z.string().min(1),
	owner: z.string().min(1),
	docs: z.string().optional(),
	tags: z.array(z.string()).optional(),
	args: z.array(ToolArgumentSchema).optional(),
});

export type GuildTool = z.infer<typeof GuildToolSchema>;

export const GuildMemberSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	title: z.string().min(1),
	litebrain: LiteBrainConfigSchema,
	// Optional, per-goblin prompt template(s)
	prompt: z
		.object({
			system: z.string().min(1),
			style: z.array(z.string()).optional(),
			examples: z
				.array(
					z.object({
						user: z.string().min(1),
						assistant: z.string().min(1),
					}),
				)
				.optional(),
		})
		.optional(),
	responsibilities: z.array(z.string()).default([]),
	kpis: z.array(z.string()).optional(),
	tools: z.array(z.string()).optional(),
	reportsTo: z.string().default("guild"),
});

export type GuildMember = z.infer<typeof GuildMemberSchema>;

export const GuildSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	charter: z.string().min(1),
	verbosity: z.enum(["terse", "normal", "verbose"]).default("normal"),
	routing: z
		.object({
			low_word_max: z.number().int().positive().optional(),
			high_word_min: z.number().int().positive().optional(),
			prefer_local_keywords: z.array(z.string()).optional(),
			prefer_remote_keywords: z.array(z.string()).optional(),
		})
		.optional(),
	toolbelt: z.array(GuildToolSchema).default([]),
	reportsTo: z.string().default("overmind"),
	members: z.array(GuildMemberSchema).nonempty(),
});

export type GuildConfig = z.infer<typeof GuildSchema>;

export const OvermindSchema = z.object({
	name: z.string().min(1),
	title: z.string().min(1),
	litebrain: LiteBrainConfigSchema.extend({
		routers: z.array(z.string()).default([]),
		embeddings: z.union([z.string(), z.array(z.string())]).optional(),
	}),
	telemetry: z.object({
		router_audit_topic: z.string().min(1),
		policy_gates: z.boolean().optional(),
	}),
	pr_gates: z.array(z.string()).default([]),
});

export type OvermindConfig = z.infer<typeof OvermindSchema>;

export const GuildRegistrySchema = z.object({
	overmind: OvermindSchema,
	guilds: z.array(GuildSchema).nonempty(),
});

export type GuildRegistrySource = z.infer<typeof GuildRegistrySchema>;

export interface GuildToolReference extends GuildTool {
	guildId: string;
}

export interface GuildMemberReference extends GuildMember {
	guildId: string;
	toolDetails: GuildToolReference[];
}

export interface GuildWithLookups
	extends Omit<GuildConfig, "members" | "toolbelt"> {
	members: GuildMemberReference[];
	toolbelt: GuildToolReference[];
	toolMap: Map<string, GuildToolReference>;
	memberMap: Map<string, GuildMemberReference>;
}

export interface GuildRegistry {
	overmind: OvermindConfig;
	guilds: GuildWithLookups[];
	guildMap: Map<string, GuildWithLookups>;
	memberMap: Map<string, GuildMemberReference>;
	toolMap: Map<string, GuildToolReference>;
}

export class GuildRegistryError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GuildRegistryError";
	}
}
