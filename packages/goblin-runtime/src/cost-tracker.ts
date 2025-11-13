/**
 * CostTracker - Track LLM API costs across providers
 *
 * Pricing (per 1K tokens):
 * - OpenAI GPT-4: $0.03 input, $0.06 output
 * - OpenAI GPT-3.5: $0.0015 input, $0.002 output
 * - Gemini 2.0 Flash: $0.0005 (combined)
 * - Anthropic Claude 3.5: $0.003 input, $0.015 output
 * - Ollama (local): $0.00 (free)
 */

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
}

export interface CostEntry {
	id: string;
	goblinId: string;
	guild: string;
	provider: string;
	model: string;
	task: string;
	tokens: TokenUsage;
	cost: number; // USD
	timestamp: Date;
	duration: number; // ms
	success: boolean;
}

export interface CostSummary {
	totalCost: number;
	totalTasks: number;
	avgCostPerTask: number;
	byProvider: Record<
		string,
		{
			cost: number;
			tasks: number;
			tokens: TokenUsage;
		}
	>;
	byGoblin: Record<
		string,
		{
			cost: number;
			tasks: number;
			tokens: TokenUsage;
		}
	>;
	byGuild: Record<
		string,
		{
			cost: number;
			tasks: number;
			tokens: TokenUsage;
		}
	>;
	recentEntries: CostEntry[];
}

export interface CostBreakdown {
	goblinId?: string;
	guildId?: string;
	startDate?: Date;
	endDate?: Date;
	summary: CostSummary;
}

/**
 * Provider pricing configuration
 */
const PROVIDER_PRICING: Record<
	string,
	{
		inputCostPer1K: number;
		outputCostPer1K: number;
	}
> = {
	// OpenAI models
	"openai:gpt-4": {
		inputCostPer1K: 0.03,
		outputCostPer1K: 0.06,
	},
	"openai:gpt-3.5-turbo": {
		inputCostPer1K: 0.0015,
		outputCostPer1K: 0.002,
	},
	openai: {
		// Default OpenAI pricing (GPT-3.5)
		inputCostPer1K: 0.0015,
		outputCostPer1K: 0.002,
	},

	// Gemini models
	"gemini:gemini-1.5-pro": {
		inputCostPer1K: 0.0005,
		outputCostPer1K: 0.0005,
	},
	"gemini:gemini-2.0-flash": {
		inputCostPer1K: 0.0005,
		outputCostPer1K: 0.0005,
	},
	gemini: {
		// Default Gemini pricing
		inputCostPer1K: 0.0005,
		outputCostPer1K: 0.0005,
	},

	// Anthropic models
	"anthropic:claude-3-5-sonnet": {
		inputCostPer1K: 0.003,
		outputCostPer1K: 0.015,
	},
	"anthropic:claude-3-opus": {
		inputCostPer1K: 0.015,
		outputCostPer1K: 0.075,
	},
	"anthropic:claude-3-haiku": {
		inputCostPer1K: 0.00025,
		outputCostPer1K: 0.00125,
	},
	anthropic: {
		// Default Anthropic pricing (Sonnet)
		inputCostPer1K: 0.003,
		outputCostPer1K: 0.015,
	},

	// Local models
	ollama: {
		inputCostPer1K: 0.0,
		outputCostPer1K: 0.0,
	},

	// DeepSeek (third-party hosted provider)
	"deepseek:default": {
		inputCostPer1K: 0.002,
		outputCostPer1K: 0.002,
	},
	deepseek: {
		inputCostPer1K: 0.002,
		outputCostPer1K: 0.002,
	},
};

/**
 * Calculate cost for a given provider and token usage
 */
export function calculateCost(
	provider: string,
	model: string,
	tokens: TokenUsage,
): number {
	const providerLower = provider.toLowerCase();
	const modelLower = model.toLowerCase();

	// Try provider:model key first, then fall back to provider only
	const compositeKey = `${providerLower}:${modelLower}`;
	const pricing =
		PROVIDER_PRICING[compositeKey] ||
		PROVIDER_PRICING[providerLower] ||
		PROVIDER_PRICING.ollama;

	const inputCost = (tokens.inputTokens / 1000) * pricing.inputCostPer1K;
	const outputCost = (tokens.outputTokens / 1000) * pricing.outputCostPer1K;

	return inputCost + outputCost;
}

/**
 * CostTracker - Track and aggregate LLM API costs
 */
export class CostTracker {
	private entries: CostEntry[] = [];
	private maxEntries = 10000; // Keep last 10K entries in memory

	/**
	 * Record a new cost entry
	 */
	record(entry: Omit<CostEntry, "id" | "timestamp" | "cost">): CostEntry {
		const cost = calculateCost(entry.provider, entry.model, entry.tokens);

		const costEntry: CostEntry = {
			...entry,
			id: `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			timestamp: new Date(),
			cost,
		};

		this.entries.push(costEntry);

		// Prune old entries if over limit
		if (this.entries.length > this.maxEntries) {
			this.entries = this.entries.slice(-this.maxEntries);
		}

		return costEntry;
	}

	/**
	 * Get cost summary for all entries
	 */
	getSummary(options?: {
		goblinId?: string;
		guildId?: string;
		startDate?: Date;
		endDate?: Date;
		limit?: number;
	}): CostSummary {
		let filtered = this.entries;

		// Apply filters
		if (options?.goblinId) {
			filtered = filtered.filter((e) => e.goblinId === options.goblinId);
		}
		if (options?.guildId) {
			filtered = filtered.filter((e) => e.guild === options.guildId);
		}
		if (options?.startDate) {
			filtered = filtered.filter((e) => e.timestamp >= options.startDate!);
		}
		if (options?.endDate) {
			filtered = filtered.filter((e) => e.timestamp <= options.endDate!);
		}

		// Calculate totals
		const totalCost = filtered.reduce((sum, e) => sum + e.cost, 0);
		const totalTasks = filtered.length;

		// Group by provider
		const byProvider: CostSummary["byProvider"] = {};
		for (const entry of filtered) {
			if (!byProvider[entry.provider]) {
				byProvider[entry.provider] = {
					cost: 0,
					tasks: 0,
					tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
				};
			}
			byProvider[entry.provider].cost += entry.cost;
			byProvider[entry.provider].tasks += 1;
			byProvider[entry.provider].tokens.inputTokens += entry.tokens.inputTokens;
			byProvider[entry.provider].tokens.outputTokens +=
				entry.tokens.outputTokens;
			byProvider[entry.provider].tokens.totalTokens += entry.tokens.totalTokens;
		}

		// Group by goblin
		const byGoblin: CostSummary["byGoblin"] = {};
		for (const entry of filtered) {
			if (!byGoblin[entry.goblinId]) {
				byGoblin[entry.goblinId] = {
					cost: 0,
					tasks: 0,
					tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
				};
			}
			byGoblin[entry.goblinId].cost += entry.cost;
			byGoblin[entry.goblinId].tasks += 1;
			byGoblin[entry.goblinId].tokens.inputTokens += entry.tokens.inputTokens;
			byGoblin[entry.goblinId].tokens.outputTokens += entry.tokens.outputTokens;
			byGoblin[entry.goblinId].tokens.totalTokens += entry.tokens.totalTokens;
		}

		// Group by guild
		const byGuild: CostSummary["byGuild"] = {};
		for (const entry of filtered) {
			if (!byGuild[entry.guild]) {
				byGuild[entry.guild] = {
					cost: 0,
					tasks: 0,
					tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
				};
			}
			byGuild[entry.guild].cost += entry.cost;
			byGuild[entry.guild].tasks += 1;
			byGuild[entry.guild].tokens.inputTokens += entry.tokens.inputTokens;
			byGuild[entry.guild].tokens.outputTokens += entry.tokens.outputTokens;
			byGuild[entry.guild].tokens.totalTokens += entry.tokens.totalTokens;
		}

		// Get recent entries
		const limit = options?.limit || 10;
		const recentEntries = filtered.slice(-limit).reverse();

		// Calculate average cost per task
		const avgCostPerTask = totalTasks > 0 ? totalCost / totalTasks : 0;

		return {
			totalCost,
			totalTasks,
			avgCostPerTask,
			byProvider,
			byGoblin,
			byGuild,
			recentEntries,
		};
	}

	/**
	 * Get cost breakdown for specific goblin or guild
	 */
	getBreakdown(options: {
		goblinId?: string;
		guildId?: string;
		startDate?: Date;
		endDate?: Date;
	}): CostBreakdown {
		// Return a flattened breakdown object: include the requested id (goblinId or guild)
		// at the top level and spread the summary fields so callers get totalCost,
		// totalTasks, byProvider, etc. directly (matches existing API expectations
		// and tests).
		const summary = this.getSummary(options);
		const result: any = {
			...summary,
		};
		if (options.goblinId) {
			result.goblinId = options.goblinId;
		}
		if (options.guildId) {
			// Use `guild` as the public field name in responses (tests expect `guild`).
			result.guild = options.guildId;
		}

		return result;
	}

	/**
	 * Get all cost entries
	 */
	getAllEntries(): CostEntry[] {
		return [...this.entries];
	}

	/**
	 * Get entries for specific goblin
	 */
	getGoblinEntries(goblinId: string, limit?: number): CostEntry[] {
		const filtered = this.entries.filter((e) => e.goblinId === goblinId);
		return limit ? filtered.slice(-limit) : filtered;
	}

	/**
	 * Get entries for specific guild
	 */
	getGuildEntries(guildId: string, limit?: number): CostEntry[] {
		const filtered = this.entries.filter((e) => e.guild === guildId);
		return limit ? filtered.slice(-limit) : filtered;
	}

	/**
	 * Get total cost for a goblin
	 */
	getGoblinCost(goblinId: string): number {
		return this.entries
			.filter((e) => e.goblinId === goblinId)
			.reduce((sum, e) => sum + e.cost, 0);
	}

	/**
	 * Get total cost for a guild
	 */
	getGuildCost(guildId: string): number {
		return this.entries
			.filter((e) => e.guild === guildId)
			.reduce((sum, e) => sum + e.cost, 0);
	}

	/**
	 * Clear all entries
	 */
	clear(): void {
		this.entries = [];
	}

	/**
	 * Export entries as CSV
	 */
	exportCSV(): string {
		// The CSV format is intentionally compact and matches test expectations.
		// Header: id,goblinId,guild,provider,model,task,inputTokens,outputTokens,totalTokens,cost,duration,success
		const headers = [
			"id",
			"goblinId",
			"guild",
			"provider",
			"model",
			"task",
			"inputTokens",
			"outputTokens",
			"totalTokens",
			"cost",
			"duration",
			"success",
		];

		const rows = this.entries.map((e) => [
			e.id,
			e.goblinId,
			e.guild,
			e.provider,
			e.model,
			e.task.substring(0, 50), // Truncate long tasks
			e.tokens.inputTokens.toString(),
			e.tokens.outputTokens.toString(),
			e.tokens.totalTokens.toString(),
			e.cost.toFixed(6),
			e.duration.toString(),
			e.success ? "true" : "false",
		]);

		return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
	}
}
