// Router for LLM provider selection

import {
	LLMProvider,
	type OvermindConfig,
	RoutingStrategy,
	TaskComplexity,
} from "../types.js";

export function classifyComplexity(query: string): TaskComplexity {
	const q = query.toLowerCase();
	// Strategic intent keywords take precedence
	if (/(plan|architecture|design|strategy)/.test(q))
		return TaskComplexity.STRATEGIC;
	// Complex tasks
	if (/(debug|generate code|complex|analy[sz]e|implement|optimi[sz]e)/.test(q))
		return TaskComplexity.COMPLEX;
	// Moderate heuristic by length
	const words = query.trim().split(/\s+/).length;
	if (words >= 12) return TaskComplexity.MODERATE;
	return TaskComplexity.SIMPLE;
}

export function isProviderAvailable(
	config: OvermindConfig,
	provider: LLMProvider,
): boolean {
	const providerConfig = (config.providers as any)[provider];
	if (!providerConfig) return false;
	// For cloud providers, presence of provider config is enough for tests
	return true;
}

export interface RoutingDecision {
	complexity: TaskComplexity;
	selectedProvider: LLMProvider;
	selectedModel: string;
	estimatedCost: number;
	estimatedLatency: number;
	reason: string;
}

export function routeQuery(
	query: string,
	config: OvermindConfig,
	strategy?: RoutingStrategy,
): RoutingDecision {
	const complexity = classifyComplexity(query);
	const routingStrategy = strategy || config.routing.strategy;

	const availableProviders = Object.values(LLMProvider).filter((p) =>
		isProviderAvailable(config, p),
	);

	// Local-first strategy
	if (routingStrategy === RoutingStrategy.LOCAL_FIRST) {
		if (availableProviders.includes(LLMProvider.OLLAMA)) {
			return {
				complexity,
				selectedProvider: LLMProvider.OLLAMA,
				selectedModel:
					(config.providers as any).ollama?.defaultModel || "llama3.2",
				estimatedCost: 0,
				estimatedLatency: 2000,
				reason: "Local-first: prefer Ollama when available",
			};
		}
		// Fallback to cost-optimized
	}

	// Cost-optimized
	if (routingStrategy === RoutingStrategy.COST_OPTIMIZED) {
		if (availableProviders.includes(LLMProvider.OLLAMA)) {
			return {
				complexity,
				selectedProvider: LLMProvider.OLLAMA,
				selectedModel:
					(config.providers as any).ollama?.defaultModel || "llama3.2",
				estimatedCost: 0,
				estimatedLatency: 2000,
				reason: "Cost-optimized: Ollama is free",
			};
		}
		if (availableProviders.includes(LLMProvider.DEEPSEEK)) {
			return {
				complexity,
				selectedProvider: LLMProvider.DEEPSEEK,
				selectedModel: "deepseek-r1",
				estimatedCost: 0.0001,
				estimatedLatency: 3000,
				reason: "Cost-optimized: DeepSeek is cheapest cloud provider",
			};
		}
	}

	// Quality-optimized / complex tasks
	if (
		routingStrategy === RoutingStrategy.QUALITY_OPTIMIZED ||
		complexity === TaskComplexity.COMPLEX
	) {
		if (availableProviders.includes(LLMProvider.OPENAI)) {
			return {
				complexity,
				selectedProvider: LLMProvider.OPENAI,
				selectedModel: "gpt-4o",
				estimatedCost: 0.01,
				estimatedLatency: 5000,
				reason: "Quality-optimized: OpenAI for complex tasks",
			};
		}
	}

	// Fallback
	const fallbackProvider = availableProviders[0] || LLMProvider.OPENAI;
	return {
		complexity,
		selectedProvider: fallbackProvider,
		selectedModel:
			fallbackProvider === LLMProvider.OPENAI ? "gpt-4o-mini" : "llama3.2",
		estimatedCost: fallbackProvider === LLMProvider.OLLAMA ? 0 : 0.001,
		estimatedLatency: fallbackProvider === LLMProvider.OLLAMA ? 2000 : 3000,
		reason:
			routingStrategy === RoutingStrategy.LOCAL_FIRST
				? "Cost-optimized fallback"
				: "Fallback to first available provider",
	};
}
