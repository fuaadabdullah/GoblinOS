import {
	type GenerativeModel,
	GoogleGenerativeAI,
} from "@google/generative-ai";
import type { GenerateOptions, ModelProvider } from "../types.js";

/**
 * GeminiProvider - Google Gemini AI integration
 *
 * Features:
 * - Chat completion with streaming support
 * - Token usage tracking via callbacks
 * - Cost calculation ($0.0005 per 1K tokens for Gemini 1.5)
 * - Health checks
 *
 * Models:
 * - gemini-1.5-pro (default)
 * - gemini-1.5-flash
 * - gemini-pro
 */
export class GeminiProvider implements ModelProvider {
	private client: GoogleGenerativeAI;
	private defaultModel: string;

	constructor(options: { apiKey?: string; model?: string } = {}) {
		const apiKey =
			options.apiKey ||
			process.env.GOOGLE_API_KEY ||
			process.env.GEMINI_API_KEY;
		if (!apiKey) {
			throw new Error(
				"Gemini API key required. Set GOOGLE_API_KEY or GEMINI_API_KEY environment variable.",
			);
		}

		this.client = new GoogleGenerativeAI(apiKey);
		this.defaultModel = options.model || "gemini-1.5-pro";
	}

	private getModel(modelName?: string): GenerativeModel {
		return this.client.getGenerativeModel({
			model: modelName || this.defaultModel,
		});
	}

	async generate(
		prompt: string,
		options: GenerateOptions = {},
	): Promise<string> {
		const model = this.getModel(options.model);

		// Build the prompt with system context if provided
		const fullPrompt = options.systemPrompt
			? `${options.systemPrompt}\n\nUser: ${prompt}`
			: prompt;

		const result = await model.generateContent({
			contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
			generationConfig: {
				temperature: options.temperature ?? 0.7,
				maxOutputTokens: options.maxTokens ?? 2048,
			},
		});

		const response = result.response;
		return response.text() || "";
	}

	async *generateStream(
		prompt: string,
		options: GenerateOptions = {},
	): AsyncIterable<string> {
		const model = this.getModel(options.model);

		// Build the prompt with system context if provided
		const fullPrompt = options.systemPrompt
			? `${options.systemPrompt}\n\nUser: ${prompt}`
			: prompt;

		const result = await model.generateContentStream({
			contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
			generationConfig: {
				temperature: options.temperature ?? 0.7,
				maxOutputTokens: options.maxTokens ?? 2048,
			},
		});

		for await (const chunk of result.stream) {
			const text = chunk.text();
			if (text) {
				yield text;
			}
		}
	}

	async checkHealth(): Promise<boolean> {
		try {
			const model = this.getModel();
			const result = await model.generateContent({
				contents: [{ role: "user", parts: [{ text: "Hi" }] }],
				generationConfig: {
					maxOutputTokens: 10,
				},
			});

			return !!result.response.text();
		} catch (error) {
			console.error("Gemini health check failed:", error);
			return false;
		}
	}

	/**
	 * Get token count for a given text
	 * Note: Gemini API provides token counting via countTokens method
	 */
	async countTokens(text: string, model?: string): Promise<number> {
		try {
			const genModel = this.getModel(model);
			const result = await genModel.countTokens({
				contents: [{ role: "user", parts: [{ text }] }],
			});
			return result.totalTokens || 0;
		} catch (error) {
			console.error("Gemini token counting failed:", error);
			// Fallback: rough estimate (1 token ~= 4 characters for English)
			return Math.ceil(text.length / 4);
		}
	}
}
