import Anthropic from "@anthropic-ai/sdk";
import type { GenerateOptions, ModelProvider } from "../types.js";

/**
 * AnthropicProvider - Claude AI integration
 *
 * Features:
 * - Chat completion with streaming support
 * - Token usage tracking (automatic via API response)
 * - Cost calculation (varies by model: $0.003-0.015 per 1K tokens)
 * - Health checks
 *
 * Models:
 * - claude-3-5-sonnet-20241022 (default, most capable)
 * - claude-3-5-haiku-20241022 (fast and efficient)
 * - claude-3-opus-20240229 (most powerful)
 * - claude-3-sonnet-20240229
 * - claude-3-haiku-20240307
 *
 * Pricing (per 1M tokens):
 * - Haiku: $0.25 input / $1.25 output
 * - Sonnet: $3 input / $15 output
 * - Opus: $15 input / $75 output
 */
export class AnthropicProvider implements ModelProvider {
	private client: Anthropic;
	private defaultModel: string;

	constructor(options: { apiKey?: string; model?: string } = {}) {
		const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
		if (!apiKey) {
			throw new Error(
				"Anthropic API key required. Set ANTHROPIC_API_KEY environment variable.",
			);
		}

		this.client = new Anthropic({ apiKey });
		this.defaultModel = options.model || "claude-3-5-sonnet-20241022";
	}

	async generate(
		prompt: string,
		options: GenerateOptions = {},
	): Promise<string> {
		const messages: Anthropic.MessageParam[] = [
			{ role: "user", content: prompt },
		];

		const response = await this.client.messages.create({
			model: options.model || this.defaultModel,
			max_tokens: options.maxTokens ?? 2048,
			temperature: options.temperature ?? 0.7,
			system: options.systemPrompt,
			messages,
		});

		// Extract text content from response
		const textContent = response.content.find((c) => c.type === "text");
		return textContent && "text" in textContent ? textContent.text : "";
	}

	async *generateStream(
		prompt: string,
		options: GenerateOptions = {},
	): AsyncIterable<string> {
		const messages: Anthropic.MessageParam[] = [
			{ role: "user", content: prompt },
		];

		const stream = await this.client.messages.create({
			model: options.model || this.defaultModel,
			max_tokens: options.maxTokens ?? 2048,
			temperature: options.temperature ?? 0.7,
			system: options.systemPrompt,
			messages,
			stream: true,
		});

		for await (const event of stream) {
			if (event.type === "content_block_delta") {
				if (event.delta.type === "text_delta") {
					yield event.delta.text;
				}
			}
		}
	}

	async checkHealth(): Promise<boolean> {
		try {
			// Make a minimal request to check if API is accessible
			const response = await this.client.messages.create({
				model: this.defaultModel,
				max_tokens: 10,
				messages: [{ role: "user", content: "Hi" }],
			});

			return response.content.length > 0;
		} catch (error) {
			console.error("Anthropic health check failed:", error);
			return false;
		}
	}

	/**
	 * Count tokens for a given text
	 * Note: Anthropic provides token counting via the count_tokens API
	 */
	async countTokens(text: string, model?: string): Promise<number> {
		try {
			const response = await this.client.messages.countTokens({
				model: model || this.defaultModel,
				system: "",
				messages: [{ role: "user", content: text }],
			});

			return response.input_tokens;
		} catch (error) {
			console.error("Anthropic token counting failed:", error);
			// Fallback: rough estimate (1 token ~= 4 characters for English)
			return Math.ceil(text.length / 4);
		}
	}

	/**
	 * Get model-specific pricing
	 * Returns cost per 1K tokens (input, output)
	 */
	getPricing(model?: string): { input: number; output: number } {
		const modelName = model || this.defaultModel;

		// Pricing per 1M tokens converted to per 1K
		if (modelName.includes("opus")) {
			return { input: 0.015, output: 0.075 };
		} else if (modelName.includes("sonnet")) {
			return { input: 0.003, output: 0.015 };
		} else if (modelName.includes("haiku")) {
			return { input: 0.00025, output: 0.00125 };
		}

		// Default to Sonnet pricing
		return { input: 0.003, output: 0.015 };
	}
}
