import { type ProviderClient, createProvider } from "@goblinos/providers";
import { z } from "zod";

export const LiteBrainConfigSchema = z.object({
	memberId: z.string(),
	name: z.string(),
	defaultModel: z.string(),
	fallbackModels: z.array(z.string()).default([]),
	providerBaseURL: z
		.string()
		.default(process.env.LITELLM_BASE_URL || "http://litellm:4000"),
	apiKey: z.string().default(process.env.LITELLM_API_KEY || "dummy"),
	temperature: z.number().min(0).max(2).default(0.2),
	maxTokens: z.number().positive().default(2048),
	timeout: z.number().positive().default(30000),
	embeddingModel: z.string().optional(),
	analyticsTag: z.string().optional(),
	systemPrompt: z.string().optional(),
	styleGuidelines: z.array(z.string()).optional(),
	examples: z
		.array(
			z.object({
				user: z.string().min(1),
				assistant: z.string().min(1),
			}),
		)
		.optional(),
	// Candidates for complexity-based routing
	localCandidates: z.array(z.string()).default([]),
	remoteCandidates: z.array(z.string()).default([]),
	routingPolicy: z
		.object({
			low_word_max: z.number().int().positive().optional(),
			high_word_min: z.number().int().positive().optional(),
			prefer_local_keywords: z.array(z.string()).optional(),
			prefer_remote_keywords: z.array(z.string()).optional(),
		})
		.optional(),
});

export type LiteBrainConfig = z.infer<typeof LiteBrainConfigSchema>;

export const LiteBrainRequestSchema = z.object({
	task: z.string().min(1),
	context: z.record(z.any()).optional(),
	constraints: z.record(z.any()).optional(),
});

export type LiteBrainRequest = z.infer<typeof LiteBrainRequestSchema>;

export const LiteBrainPlanSchema = z.object({
	description: z.string(),
	steps: z.array(
		z.object({
			action: z.string(),
			target: z.string(),
			content: z.string().optional(),
			reasoning: z.string(),
		}),
	),
	estimatedComplexity: z.enum(["low", "medium", "high"]).default("medium"),
});

export const LiteBrainResponseSchema = z.object({
	success: z.boolean(),
	plan: LiteBrainPlanSchema,
	metadata: z.object({
		model: z.string(),
		processingTime: z.number(),
		tokensUsed: z.number().optional(),
		embeddingModel: z.string().optional(),
		analyticsTag: z.string().optional(),
		memberId: z.string(),
	}),
});

export type LiteBrainResponse = z.infer<typeof LiteBrainResponseSchema>;

export class LiteBrainError extends Error {
	constructor(
		message: string,
		public code: string,
		public details?: unknown,
	) {
		super(message);
		this.name = "LiteBrainError";
	}
}

export function mergeLiteBrainConfig(
	defaults: LiteBrainConfig,
	overrides: Partial<LiteBrainConfig> = {},
): LiteBrainConfig {
	const sanitizedOverrides = Object.fromEntries(
		Object.entries(overrides).filter(([, value]) => value !== undefined),
	) as Partial<LiteBrainConfig>;

	return LiteBrainConfigSchema.parse({
		...defaults,
		...sanitizedOverrides,
	});
}

export class BaseLiteBrain {
	protected config: LiteBrainConfig;
	protected provider: ProviderClient;

	constructor(config: LiteBrainConfig) {
		this.config = LiteBrainConfigSchema.parse(config);
		this.provider = createProvider({
			baseURL: this.config.providerBaseURL,
			apiKey: this.config.apiKey,
			defaultModel: this.config.defaultModel,
			fallbackModels: this.config.fallbackModels,
			temperature: this.config.temperature,
			maxTokens: this.config.maxTokens,
			timeout: this.config.timeout,
		});
	}

	getConfig(): LiteBrainConfig {
		return { ...this.config };
	}

	async process(request: LiteBrainRequest): Promise<LiteBrainResponse> {
		const start = Date.now();
		const validated = LiteBrainRequestSchema.parse(request);

		const prompt = this.buildPrompt(validated);
		try {
			const { sanitized: sanitizedExamples, warnings } = sanitizeExamples(
				this.config.examples,
			);
			if (
				warnings.length &&
				process.env.LITEBRAIN_SILENCE_WARNINGS !== "true"
			) {
				for (const w of warnings) {
					// eslint-disable-next-line no-console
					console.warn(`[LiteBrain] ${w}`);
				}
			}

			const messages = [] as {
				role: "system" | "user" | "assistant";
				content: string;
			}[];
			messages.push({
				role: "system",
				content:
					this.config.systemPrompt ||
					`You are ${this.config.name}, a specialized LiteBrain.`,
			});
			if (sanitizedExamples && sanitizedExamples.length) {
				for (const ex of sanitizedExamples) {
					messages.push({ role: "user", content: ex.user });
					messages.push({ role: "assistant", content: ex.assistant });
				}
			}
			messages.push({ role: "user", content: prompt });

			const model = pickModelForComplexity(this.config, validated, prompt);
			const response = await this.provider.chat({
				model,
				messages,
				temperature: this.config.temperature,
				maxTokens: this.config.maxTokens,
			});

			const plan = this.parsePlan(response.content);
			return LiteBrainResponseSchema.parse({
				success: true,
				plan,
				metadata: {
					model: response.model,
					processingTime: Date.now() - start,
					tokensUsed: response.usage?.totalTokens,
					embeddingModel: this.config.embeddingModel,
					analyticsTag: this.config.analyticsTag,
					memberId: this.config.memberId,
				},
			});
		} catch (err) {
			throw new LiteBrainError(
				`LiteBrain processing failed: ${err instanceof Error ? err.message : String(err)}`,
				"PROCESSING_ERROR",
			);
		}
	}

	protected buildPrompt(request: LiteBrainRequest): string {
		const ctx = request.context
			? JSON.stringify(request.context, null, 2)
			: "None";
		const constraints = request.constraints
			? JSON.stringify(request.constraints, null, 2)
			: "None";
		const style =
			this.config.styleGuidelines && this.config.styleGuidelines.length
				? `\nGuidelines:\n- ${this.config.styleGuidelines.join("\n- ")}`
				: "";

		return `Task: ${request.task}

Context:
${ctx}

Constraints:
${constraints}

${style}

Respond with JSON only using this shape:
{
  "description": string,
  "steps": [{ "action": string, "target": string, "content"?: string, "reasoning": string }],
  "estimatedComplexity": "low"|"medium"|"high"
}`;
	}

	protected parsePlan(content: string): z.infer<typeof LiteBrainPlanSchema> {
		try {
			const match = content.match(/\{[\s\S]*\}/);
			const parsed = JSON.parse(match ? match[0] : content);
			return LiteBrainPlanSchema.parse(parsed);
		} catch (_e) {
			return {
				description: "Fallback plan due to parsing error",
				steps: [],
				estimatedComplexity: "medium",
			};
		}
	}
}

function sanitizeExamples(input?: { user: string; assistant: string }[]): {
	sanitized: { user: string; assistant: string }[] | undefined;
	warnings: string[];
} {
	const warnings: string[] = [];
	if (!input || input.length === 0) return { sanitized: undefined, warnings };
	const MAX_LEN = Number(process.env.LITEBRAIN_EXAMPLE_MAXLEN || 1200);

	const sanitized = input
		.map((ex, idx) => {
			const user = (ex.user ?? "").trim();
			const assistant = (ex.assistant ?? "").trim();
			if (!user || !assistant) {
				warnings.push(`Dropped empty example at index ${idx}`);
				return null;
			}
			if (user.length > MAX_LEN) {
				warnings.push(
					`User example ${idx} is very long (${user.length} chars) — consider shortening (<${MAX_LEN}).`,
				);
			}
			if (assistant.length > MAX_LEN) {
				warnings.push(
					`Assistant example ${idx} is very long (${assistant.length} chars) — consider shortening (<${MAX_LEN}).`,
				);
			}
			return { user, assistant };
		})
		.filter(Boolean) as { user: string; assistant: string }[];

	return { sanitized: sanitized.length ? sanitized : undefined, warnings };
}

type Complexity = "low" | "medium" | "high";

function estimateTokens(text: string): number {
	// Rough heuristic: 1 token ~ 4 chars
	return Math.ceil(text.length / 4);
}

function estimateComplexity(
	task: string,
	prompt: string,
	policy?: LiteBrainConfig["routingPolicy"],
	override?: Complexity | undefined,
): Complexity {
	if (override === "low" || override === "medium" || override === "high")
		return override;

	const text = `${task}\n${prompt}`.toLowerCase();
	const words = text.split(/\s+/).filter(Boolean);
	const tokens = estimateTokens(text);

	const hiKeywords = new Set<string>([
		"design",
		"architecture",
		"rewrite",
		"refactor",
		"end-to-end",
		"full",
		"spec",
		...(policy?.prefer_remote_keywords || []),
	]);
	const loKeywords = new Set<string>([
		"typo",
		"rename",
		"format",
		"lint",
		"small",
		"quick",
		...(policy?.prefer_local_keywords || []),
	]);

	const hiHits = Array.from(hiKeywords).some((k) =>
		text.includes(k.toLowerCase()),
	);
	const loHits = Array.from(loKeywords).some((k) =>
		text.includes(k.toLowerCase()),
	);

	const lowWordMax = policy?.low_word_max ?? 80;
	const highWordMin = policy?.high_word_min ?? 300;

	if (hiHits || words.length > highWordMin || tokens > highWordMin * 0.8)
		return "high";
	if (loHits || words.length < lowWordMax) return "low";
	return "medium";
}

function pickModelForComplexity(
	cfg: LiteBrainConfig,
	req: LiteBrainRequest,
	prompt: string,
): string {
	const routing = (req.constraints as any)?.routing || {};
	const forcedModel =
		typeof routing.model === "string" ? routing.model : undefined;
	if (forcedModel) return forcedModel;

	const overrideComplexity = routing.complexity as Complexity | undefined;
	const preference = routing.preference as "local" | "remote" | undefined;

	const complexity = estimateComplexity(
		req.task,
		prompt,
		cfg.routingPolicy,
		overrideComplexity,
	);
	if (preference === "local" && cfg.localCandidates.length)
		return cfg.localCandidates[0];
	if (preference === "remote" && cfg.remoteCandidates.length)
		return cfg.remoteCandidates[0];

	if (complexity === "low" && cfg.localCandidates.length) {
		return cfg.localCandidates[0];
	}
	if (complexity === "high" && cfg.remoteCandidates.length) {
		return cfg.remoteCandidates[0];
	}
	return cfg.defaultModel;
}
