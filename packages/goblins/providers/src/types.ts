import type OpenAI from "openai";

/**
 * Chat message
 */
export type Message = OpenAI.ChatCompletionMessageParam;

/**
 * Chat request options
 */
export interface ChatOptions {
	messages: Message[];
	model?: string;
	temperature?: number;
	maxTokens?: number;
	stream?: boolean;
	tools?: OpenAI.ChatCompletionTool[];
	toolChoice?: OpenAI.ChatCompletionToolChoiceOption | "auto" | "none";
}

/**
 * Usage statistics
 */
export interface Usage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

/**
 * Chat response
 */
export interface ChatResponse {
	id: string;
	model: string;
	content: string;
	usage: Usage;
	finishReason: string;
	toolCalls?: OpenAI.ChatCompletionMessageToolCall[] | null;
}

/**
 * Provider metrics for observability
 */
export interface ProviderMetrics {
	model: string;
	provider: string;
	latencyMs: number;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	cost: number;
	success: boolean;
	error?: string;
	timestamp: Date;
}

/**
 * Fallback attempt tracking
 */
export interface FallbackAttempt {
	model: string;
	success: boolean;
	error?: string;
	latencyMs: number;
}
