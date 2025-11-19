import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import type { ProviderConfig } from "./config.js";
import { MODEL_METADATA, createDefaultConfig, ProviderConfigSchema } from "./config.js";
import { FallbackHandler } from "./fallback.js";
import { createLLMSpan, recordProviderMetrics } from "./telemetry.js";
import type { ChatOptions, ChatResponse, ProviderMetrics } from "./types.js";
import { createLiteBrain, GUILD_MEMBER_IDS } from '/Users/fuaadabdullah/ForgeMonorepo/GoblinOS/packages/goblins/brains/dist/index.js';

/**
 * Universal provider client with LiteLLM gateway support
 */
export class ProviderClient {
	private client: OpenAI;
	private config: ProviderConfig;
	private fallbackHandler: FallbackHandler;

	constructor(config: ProviderConfig) {
		this.config = config;
		this.client = new OpenAI({
			baseURL: config.baseURL,
			apiKey: config.apiKey,
			timeout: config.timeout,
			maxRetries: 0, // We handle retries via fallback
		});
		this.fallbackHandler = new FallbackHandler(config);
	}

	/**
	 * Send a chat completion request with automatic fallbacks
	 */
	async chat(options: ChatOptions): Promise<ChatResponse> {
		const model = options.model || this.config.defaultModel;
		const startTime = Date.now();

		return createLLMSpan(
			"llm.chat",
			{
				"llm.model": model,
				"llm.provider": "litellm",
				"message.count": options.messages.length,
			},
			async () => {
				try {
					const response = await this.fallbackHandler.executeWithFallback(
						model,
						async (attemptModel) => {
							if (options.stream) {
								throw new Error(
									"Streaming chat completions are not yet supported",
								);
							}

							const request: ChatCompletionCreateParamsNonStreaming = {
								model: attemptModel,
								messages: options.messages,
								temperature: options.temperature ?? this.config.temperature,
								max_tokens: options.maxTokens ?? this.config.maxTokens,
								stream: false,
								tools: options.tools,
								tool_choice: options.toolChoice ?? "auto",
							};

							const completion =
								await this.client.chat.completions.create(request);

							return this.mapResponse(completion, attemptModel, startTime);
						},
					);

					return response;
				} catch (error) {
					const latencyMs = Date.now() - startTime;
					const metrics: ProviderMetrics = {
						model,
						provider: "litellm",
						latencyMs,
						inputTokens: 0,
						outputTokens: 0,
						totalTokens: 0,
						cost: 0,
						success: false,
						error: error instanceof Error ? error.message : String(error),
						timestamp: new Date(),
					};

					if (this.config.telemetry) {
						recordProviderMetrics(metrics);
					}

					throw error;
				}
			},
		);
	}

	/**
	 * Map OpenAI response to our ChatResponse type
	 */
	private mapResponse(
		completion: OpenAI.ChatCompletion,
		model: string,
		startTime: number,
	): ChatResponse {
		const latencyMs = Date.now() - startTime;
		const choice = completion.choices[0];
		const usage = completion.usage || {
			prompt_tokens: 0,
			completion_tokens: 0,
			total_tokens: 0,
		};

		const response: ChatResponse = {
			id: completion.id,
			model: completion.model,
			content: normalizeMessageContent(choice.message),
			usage: {
				promptTokens: usage.prompt_tokens,
				completionTokens: usage.completion_tokens,
				totalTokens: usage.total_tokens,
			},
			finishReason: choice.finish_reason ?? "stop",
			toolCalls: choice.message.tool_calls ?? undefined,
		};

		// Track metrics
		if (this.config.telemetry || this.config.trackCost) {
			const cost = this.calculateCost(
				model,
				usage.prompt_tokens,
				usage.completion_tokens,
			);

			const metrics: ProviderMetrics = {
				model,
				provider: MODEL_METADATA[model]?.provider || "unknown",
				latencyMs,
				inputTokens: usage.prompt_tokens,
				outputTokens: usage.completion_tokens,
				totalTokens: usage.total_tokens,
				cost,
				success: true,
				timestamp: new Date(),
			};

			if (this.config.telemetry) {
				recordProviderMetrics(metrics);
			}
		}

		return response;
	}

	/**
	 * Calculate estimated cost based on token usage
	 */
	private calculateCost(
		model: string,
		inputTokens: number,
		outputTokens: number,
	): number {
		const metadata = MODEL_METADATA[model];
		if (!metadata) return 0;

		const inputCost = (inputTokens / 1000) * metadata.inputCostPer1kTokens;
		const outputCost = (outputTokens / 1000) * metadata.outputCostPer1kTokens;

		return inputCost + outputCost;
	}

	/**
	 * Get the underlying OpenAI client for advanced use cases
	 */
	getClient(): OpenAI {
		return this.client;
	}

	/**
	 * Get current configuration
	 */
	getConfig(): ProviderConfig {
		return { ...this.config };
	}
}

/**
 * Factory function to create a provider client
 */
export function createProvider(
	config: Partial<ProviderConfig> = {},
): ProviderClient {
	const defaultConfig = createDefaultConfig();
	const mergedConfig = ProviderConfigSchema.parse({
		...defaultConfig,
		...config,
	});

	return new ProviderClient(mergedConfig);
}

type ChatMessage = OpenAI.ChatCompletion["choices"][number]["message"];

function normalizeMessageContent(message: ChatMessage): string {
	const originalContent = message.content;
	if (originalContent === null || originalContent === undefined) {
		return "";
	}

	const rawContent = originalContent as unknown;

	if (typeof rawContent === "string") {
		return rawContent;
	}

	if (Array.isArray(rawContent)) {
		let text = "";
		for (const part of rawContent as Array<Record<string, unknown>>) {
			if (typeof part === "object" && part !== null && "text" in part) {
				const candidate = (part as { text?: string }).text;
				if (typeof candidate === "string") {
					text += candidate;
				}
			}
		}
		return text;
	}

	return "";
}

// GoblinOS Brains Package Available!
// Available guild members: dregg-embercode, vanta-lumin, volt-furnace, magnolia-nightbloom, mags-charietto, sentenial-ledgerwarden, hex-oracle, grim-rune, launcey-gauge
// ✅ Successfully created LiteBrain for dregg-embercode
// Brain type: ForgeLiteBrain
// Metrics server listening on port 9090
