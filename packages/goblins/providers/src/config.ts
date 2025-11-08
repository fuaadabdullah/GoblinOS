import { z } from "zod";

/**
 * Provider configuration schema
 */
export const ProviderConfigSchema = z.object({
	/** Base URL for LiteLLM gateway or OpenAI-compatible endpoint */
	baseURL: z.string().url(),

	/** API key (can be dummy for LiteLLM) */
	apiKey: z.string().default("dummy"),

	/** Default model to use */
	defaultModel: z.string().default("gpt-4-turbo"),

	/** Fallback models in priority order */
	fallbackModels: z
		.array(z.string())
		.default(["deepseek-r1", "gpt-4-turbo", "gemini-pro"]),

	/** Maximum retries per model */
	maxRetries: z.number().int().positive().default(3),

	/** Request timeout in milliseconds */
	timeout: z.number().int().positive().default(60000),

	/** Enable telemetry */
	telemetry: z.boolean().default(true),

	/** Cost tracking enabled */
	trackCost: z.boolean().default(true),

	/** Maximum tokens per request */
	maxTokens: z.number().int().positive().optional(),

	/** Temperature for sampling */
	temperature: z.number().min(0).max(2).default(0.7),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/**
 * Model metadata for cost/latency tracking
 */
export interface ModelMetadata {
	provider: string;
	model: string;
	inputCostPer1kTokens: number;
	outputCostPer1kTokens: number;
	avgLatencyMs: number;
}

/**
 * Known model metadata (approximate costs as of Oct 2025)
 */
export const MODEL_METADATA: Record<string, ModelMetadata> = {
	"gpt-4-turbo": {
		provider: "openai",
		model: "gpt-4-turbo-preview",
		inputCostPer1kTokens: 0.01,
		outputCostPer1kTokens: 0.03,
		avgLatencyMs: 2000,
	},
	"gemini-pro": {
		provider: "gemini",
		model: "gemini-1.5-pro-latest",
		inputCostPer1kTokens: 0.0035,
		outputCostPer1kTokens: 0.0105,
		avgLatencyMs: 1500,
	},
	"deepseek-chat": {
		provider: "deepseek",
		model: "deepseek-chat",
		inputCostPer1kTokens: 0.0014,
		outputCostPer1kTokens: 0.0028,
		avgLatencyMs: 1200,
	},
	"deepseek-r1": {
		provider: "deepseek",
		model: "deepseek-r1",
		inputCostPer1kTokens: 0.002,
		outputCostPer1kTokens: 0.004,
		avgLatencyMs: 1800,
	},
	ollama: {
		provider: "ollama",
		model: "ollama",
		inputCostPer1kTokens: 0,
		outputCostPer1kTokens: 0,
		avgLatencyMs: 450,
	},
	"ollama-local": {
		provider: "ollama",
		model: "llama3.2",
		inputCostPer1kTokens: 0,
		outputCostPer1kTokens: 0,
		avgLatencyMs: 500,
	},
	"ollama-coder": {
		provider: "ollama",
		model: "ollama-coder",
		inputCostPer1kTokens: 0,
		outputCostPer1kTokens: 0,
		avgLatencyMs: 480,
	},
	"nomic-embed-text": {
		provider: "nomic",
		model: "nomic-embed-text",
		inputCostPer1kTokens: 0,
		outputCostPer1kTokens: 0,
		avgLatencyMs: 300,
	},
};

/**
 * Create default provider configuration from environment variables
 */
export function createDefaultConfig(): ProviderConfig {
	// If OLLAMA_BASE_URL is set, prefer direct Ollama connection
	const ollamaBase = process.env.OLLAMA_BASE_URL;
	if (ollamaBase && ollamaBase.trim().length > 0) {
		const normalized = ollamaBase.endsWith("/v1")
			? ollamaBase
			: `${ollamaBase.replace(/\/$/, "")}/v1`;
		const defaultModel = process.env.OLLAMA_DEFAULT_MODEL || "llama3.2";
		const fallbacks = process.env.FALLBACK_MODELS?.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		return ProviderConfigSchema.parse({
			baseURL: normalized,
			apiKey: process.env.OLLAMA_API_KEY || "ollama", // not used by Ollama, placeholder
			defaultModel,
			fallbackModels:
				fallbacks && fallbacks.length > 0 ? fallbacks : [defaultModel],
			telemetry: process.env.TELEMETRY_ENABLED !== "false",
			trackCost: process.env.TRACK_COST !== "false",
		});
	}

	// If DeepSeek is configured for direct access, use it
	const deepseekBase =
		process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
	if (process.env.DEEPSEEK_API_KEY) {
		const normalized = deepseekBase.endsWith("/v1")
			? deepseekBase
			: `${deepseekBase.replace(/\/$/, "")}/v1`;
		const defaultModel = process.env.DEEPSEEK_DEFAULT_MODEL || "deepseek-r1";
		const fallbacks = process.env.FALLBACK_MODELS?.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		return ProviderConfigSchema.parse({
			baseURL: normalized,
			apiKey: process.env.DEEPSEEK_API_KEY,
			defaultModel,
			fallbackModels:
				fallbacks && fallbacks.length > 0 ? fallbacks : [defaultModel],
			telemetry: process.env.TELEMETRY_ENABLED !== "false",
			trackCost: process.env.TRACK_COST !== "false",
		});
	}

	// If OpenAI is configured for direct access, use it
	if (process.env.OPENAI_API_KEY) {
		const openaiBase = process.env.OPENAI_BASE_URL || "https://api.openai.com";
		const normalized = openaiBase.endsWith("/v1")
			? openaiBase
			: `${openaiBase.replace(/\/$/, "")}/v1`;
		const defaultModel = process.env.OPENAI_DEFAULT_MODEL || "gpt-4-turbo";
		// Note: In direct OpenAI mode, fallbacks must be OpenAI models only
		const fallbacks = (process.env.FALLBACK_MODELS || "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean)
			.filter(
				(m) =>
					!m.toLowerCase().includes("gemini") &&
					!m.toLowerCase().includes("deepseek"),
			);
		return ProviderConfigSchema.parse({
			baseURL: normalized,
			apiKey: process.env.OPENAI_API_KEY,
			defaultModel,
			fallbackModels: fallbacks.length ? fallbacks : [defaultModel],
			telemetry: process.env.TELEMETRY_ENABLED !== "false",
			trackCost: process.env.TRACK_COST !== "false",
		});
	}

	// Otherwise default to LiteLLM gateway
	return ProviderConfigSchema.parse({
		baseURL: process.env.LITELLM_BASE_URL || "http://litellm:4000",
		apiKey: process.env.LITELLM_API_KEY || "dummy",
		defaultModel: process.env.DEFAULT_MODEL || "gpt-4-turbo",
		fallbackModels: process.env.FALLBACK_MODELS?.split(",")
			.map((s) => s.trim())
			.filter(Boolean) || ["deepseek-r1", "gpt-4-turbo", "gemini-pro"],
		telemetry: process.env.TELEMETRY_ENABLED !== "false",
		trackCost: process.env.TRACK_COST !== "false",
	});
}
