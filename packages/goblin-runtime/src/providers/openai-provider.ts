import OpenAI from "openai";
import type { GenerateOptions, ModelProvider } from "../types.js";

export class OpenAIProvider implements ModelProvider {
	private client: OpenAI;
	private defaultModel: string;

	constructor(options: { apiKey?: string; model?: string } = {}) {
		this.client = new OpenAI({
			apiKey: options.apiKey || process.env.OPENAI_API_KEY,
		});
		this.defaultModel = options.model || "gpt-4-turbo-preview";
	}

	async generate(
		prompt: string,
		options: GenerateOptions = {},
	): Promise<string> {
		const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

		if (options.systemPrompt) {
			messages.push({ role: "system", content: options.systemPrompt });
		}

		messages.push({ role: "user", content: prompt });

		const response = await this.client.chat.completions.create({
			model: options.model || this.defaultModel,
			messages,
			temperature: options.temperature ?? 0.7,
			max_tokens: options.maxTokens ?? 2048,
		});

		return response.choices[0]?.message?.content || "";
	}

	async *generateStream(
		prompt: string,
		options: GenerateOptions = {},
	): AsyncIterable<string> {
		const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

		if (options.systemPrompt) {
			messages.push({ role: "system", content: options.systemPrompt });
		}

		messages.push({ role: "user", content: prompt });

		const stream = await this.client.chat.completions.create({
			model: options.model || this.defaultModel,
			messages,
			temperature: options.temperature ?? 0.7,
			max_tokens: options.maxTokens ?? 2048,
			stream: true,
		});

		for await (const chunk of stream) {
			const content = chunk.choices[0]?.delta?.content;
			if (content) {
				yield content;
			}
		}
	}

	async checkHealth(): Promise<boolean> {
		try {
			await this.client.models.list();
			return true;
		} catch {
			return false;
		}
	}
}
