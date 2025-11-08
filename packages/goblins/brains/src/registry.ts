import {
	type GuildMemberReference,
	GuildRegistryError,
	loadRegistrySync,
} from "@goblinos/registry";
import type { LiteBrainConfig } from "./base.js";

const ROUTER_MODEL_MAP: Record<string, string> = {
	"deepseek-r1": "deepseek-r1",
	openai: "gpt-4-turbo",
	gemini: "gemini-pro",
};

const DEFAULT_PROVIDER_URL = (() => {
	const obase = process.env.OLLAMA_BASE_URL;
	if (obase && obase.trim().length > 0) {
		return obase.endsWith("/v1") ? obase : `${obase.replace(/\/$/, "")}/v1`;
	}
	const dbase = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
	if (process.env.DEEPSEEK_API_KEY) {
		return dbase.endsWith("/v1") ? dbase : `${dbase.replace(/\/$/, "")}/v1`;
	}
	const obase2 = process.env.OPENAI_BASE_URL || "https://api.openai.com";
	if (process.env.OPENAI_API_KEY) {
		return obase2.endsWith("/v1") ? obase2 : `${obase2.replace(/\/$/, "")}/v1`;
	}
	return process.env.LITELLM_BASE_URL || "http://litellm:4000";
})();
const DEFAULT_API_KEY = process.env.OLLAMA_BASE_URL
	? process.env.OLLAMA_API_KEY || "ollama"
	: process.env.DEEPSEEK_API_KEY
		? process.env.DEEPSEEK_API_KEY
		: process.env.OPENAI_API_KEY
			? process.env.OPENAI_API_KEY
			: process.env.LITELLM_API_KEY || "dummy";

const registry = loadRegistrySync();

export function resolveGuildMember(memberId: string): GuildMemberReference {
	const member = registry.memberMap.get(memberId);
	if (!member) {
		throw new GuildRegistryError(`Unknown guild member: ${memberId}`);
	}
	return member;
}

export function getMemberLiteBrainConfig(memberId: string): LiteBrainConfig {
	const member = resolveGuildMember(memberId);
	return buildConfigFromMember(member);
}

function buildConfigFromMember(member: GuildMemberReference): LiteBrainConfig {
	const litebrain = member.litebrain;
	const localModels = litebrain.local ?? [];
	const defaultModel =
		(localModels[0] ?? process.env.OLLAMA_DEFAULT_MODEL) ||
		process.env.DEEPSEEK_DEFAULT_MODEL ||
		process.env.OPENAI_DEFAULT_MODEL ||
		mapRouterToModel(litebrain.routers?.[0]) ||
		"ollama";

	const fallbackModels: string[] = [];
	if (localModels.length > 1) {
		fallbackModels.push(...localModels.slice(1));
	}
	if (litebrain.routers) {
		for (const router of litebrain.routers) {
			const mapped = mapRouterToModel(router);
			if (mapped && mapped !== defaultModel) {
				fallbackModels.push(mapped);
			}
		}
	}
	const remoteCandidates: string[] = [];
	if (litebrain.routers) {
		for (const router of litebrain.routers) {
			const mapped = mapRouterToModel(router);
			if (mapped) remoteCandidates.push(mapped);
		}
	}
	const localCandidates = [...localModels];
	const embeddingModel = Array.isArray(litebrain.embeddings)
		? litebrain.embeddings[0]
		: litebrain.embeddings;

	// Derive a sensible default system prompt if none provided on the member
	const defaultSystemPrompt = buildDefaultSystemPrompt({
		title: member.title ?? member.name,
		responsibilities: member.responsibilities || [],
		kpis: member.kpis || [],
	});
	const systemPrompt = (member as any).prompt?.system || defaultSystemPrompt;
	let styleGuidelines: string[] | undefined =
		(member as any).prompt?.style || undefined;
	const examples: { user: string; assistant: string }[] | undefined = (
		member as any
	).prompt?.examples;

	// Apply guild-level verbosity policy
	const guild = registry.guildMap.get(member.guildId) as any;
	let maxTokens = litebrain.max_tokens ?? 2048;
	const verbosity = guild?.verbosity || "normal";
	const extraGuidelines: string[] = [];
	if (verbosity === "terse") {
		maxTokens = Math.min(maxTokens, 700);
		extraGuidelines.push("Be terse. Use bullets where possible. Omit filler.");
	} else if (verbosity === "verbose") {
		maxTokens = Math.max(maxTokens, 2200);
		extraGuidelines.push(
			"Be thorough. Include brief rationale and trade-offs.",
		);
	}
	if (extraGuidelines.length) {
		styleGuidelines = [...(styleGuidelines || []), ...extraGuidelines];
	}

	return {
		memberId: member.id,
		name: `${member.title ?? member.name} LiteBrain`,
		defaultModel,
		fallbackModels,
		providerBaseURL: DEFAULT_PROVIDER_URL,
		apiKey: DEFAULT_API_KEY,
		temperature: litebrain.temperature ?? 0.2,
		maxTokens,
		timeout: litebrain.timeout ?? 30000,
		embeddingModel,
		analyticsTag: litebrain.analytics_tag,
		systemPrompt,
		styleGuidelines,
		examples,
		localCandidates,
		remoteCandidates,
		routingPolicy: guild?.routing,
	};
}

function mapRouterToModel(router?: string) {
	if (!router) return undefined;
	return ROUTER_MODEL_MAP[router] ?? router;
}

export function getRegistry() {
	return registry;
}

function buildDefaultSystemPrompt(input: {
	title: string;
	responsibilities: string[];
	kpis: string[];
}): string {
	const lines: string[] = [];
	lines.push(`You are ${input.title}, a focused engineering assistant.`);
	if (input.responsibilities.length) {
		lines.push("Primary duties:");
		for (const r of input.responsibilities) lines.push(`- ${r}`);
	}
	if (input.kpis.length) {
		lines.push("Key performance indicators (optimize for these):");
		for (const k of input.kpis) lines.push(`- ${k}`);
	}
	lines.push(
		"Behaviors: be concise, avoid hallucinations, show assumptions, prefer actionable steps, and produce deterministic, testable output.",
	);
	lines.push("If unsure, ask for clarification before proceeding.");
	return lines.join("\n");
}
