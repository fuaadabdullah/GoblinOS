import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { execa } from "execa";
import yaml from "yaml";
import { getToolSelector } from "@goblinos/tool-selector";
import {
	type TaskDecisionAuditEvent,
	type ToolExecutionAuditEvent,
	sendSignedAudit,
} from "./audit-client.js";
import { MemoryStore } from "./memory-store.js";
import { buildSystemPrompt, buildTaskPrompt } from "./prompt-templates.js";
import { AnthropicProvider } from "./providers/anthropic-provider.js";
import { DeepSeekProvider } from "./providers/deepseek-provider.js";
import { GeminiProvider } from "./providers/gemini-provider.js";
import { OllamaProvider } from "./providers/ollama-provider.js";
import { OpenAIProvider } from "./providers/openai-provider.js";
import { RAGService } from "./rag-service.js";
import type {
	GoblinResponse,
	GoblinTask,
	ModelProvider,
	ToolExecutionResult,
} from "./types.js";

// Re-use types from tool-selector
interface GoblinConfig {
	id: string;
	title: string;
	brain: {
		local?: string[];
		routers?: string[];
		embeddings?: string;
	};
	responsibilities?: string[];
	kpis?: string[];
	tools?: {
		owned?: string[];
		selection_rules?: Array<{
			trigger: string;
			tool: string | null;
			note?: string;
		}>;
	};
}

interface GuildConfig {
	name: string;
	charter: string;
	verbosity?: string;
	toolbelt?: Array<{
		id: string;
		name: string;
		summary: string;
		owner: string;
		command: string;
	}>;
	members: GoblinConfig[];
}

interface GoblinsYaml {
	overmind: any;
	guilds: GuildConfig[];
}

async function parseGoblinsYaml(): Promise<GoblinsYaml> {
	// Look for goblins.yaml in several locations
	const possiblePaths = [
		join(process.cwd(), "goblins.yaml"),
		join(process.cwd(), "..", "..", "goblins.yaml"),
		join(process.cwd(), "../../goblins.yaml"),
		"/Users/fuaadabdullah/ForgeMonorepo/GoblinOS/goblins.yaml",
	];

	for (const yamlPath of possiblePaths) {
		try {
			const yamlContent = readFileSync(yamlPath, "utf8");
			return yaml.parse(yamlContent);
		} catch (err) {
			// Try next path
			continue;
		}
	}

	throw new Error("Could not find goblins.yaml in any expected location");
}

export class GoblinRuntime {
	private goblins: Map<string, GoblinConfig & { guild: string }> = new Map();
	private guilds: GuildConfig[] = [];
	private providers: Map<string, ModelProvider> = new Map();
	private memory: MemoryStore;
	private rag: RAGService | null = null;
	private initialized = false;

	constructor() {
		this.memory = new MemoryStore();
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		console.log("🔧 Initializing GoblinRuntime...");

		// Load goblin configuration
		const config = await parseGoblinsYaml();
		this.guilds = config.guilds;

		// Index all goblins
		for (const guild of config.guilds) {
			if (guild.members) {
				for (const member of guild.members) {
					this.goblins.set(member.id, { ...member, guild: guild.name });
				}
			}
		}

		// Initialize Ollama provider (primary)
		const ollamaProvider = new OllamaProvider();
		const ollamaHealthy = await ollamaProvider.checkHealth();

		if (ollamaHealthy) {
			this.providers.set("ollama", ollamaProvider);
			console.log("✅ Ollama provider ready");

			// Initialize RAG service with Ollama embeddings
			this.rag = new RAGService(ollamaProvider);
			console.log("✅ RAG service ready");
		} else {
			console.warn("⚠️  Ollama not available");
		}

		// Initialize OpenAI provider if API key is present
		if (process.env.OPENAI_API_KEY) {
			const openaiProvider = new OpenAIProvider();
			this.providers.set("openai", openaiProvider);
			console.log("✅ OpenAI provider ready");
		}

		// Initialize Gemini provider if API key is present
		if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
			try {
				const geminiProvider = new GeminiProvider();
				const geminiHealthy = await geminiProvider.checkHealth();
				if (geminiHealthy) {
					this.providers.set("gemini", geminiProvider);
					console.log("✅ Gemini provider ready");
				} else {
					console.warn("⚠️  Gemini health check failed");
				}
			} catch (error: any) {
				console.warn(`⚠️  Gemini initialization failed: ${error.message}`);
			}
		}

		// Initialize Anthropic provider if API key is present
		if (process.env.ANTHROPIC_API_KEY) {
			try {
				const anthropicProvider = new AnthropicProvider();
				const anthropicHealthy = await anthropicProvider.checkHealth();
				if (anthropicHealthy) {
					this.providers.set("anthropic", anthropicProvider);
					console.log("✅ Anthropic provider ready");
				} else {
					console.warn("⚠️  Anthropic health check failed");
				}
			} catch (error: any) {
				console.warn(`⚠️  Anthropic initialization failed: ${error.message}`);
			}
		}

		// Initialize DeepSeek provider if API key is present
		if (process.env.DEEPSEEK_API_KEY) {
			try {
				const deepseekProvider = new DeepSeekProvider();
				const deepseekHealthy = await deepseekProvider.checkHealth();
				if (deepseekHealthy) {
					this.providers.set("deepseek", deepseekProvider);
					console.log("✅ DeepSeek provider ready");
				} else {
					console.warn("⚠️  DeepSeek health check failed");
				}
			} catch (error: any) {
				console.warn(`⚠️  DeepSeek initialization failed: ${error.message}`);
			}
		}

		if (this.providers.size === 0) {
			throw new Error(
				"No AI providers available. Please start Ollama or set OPENAI_API_KEY.",
			);
		}

		this.initialized = true;
		console.log(`✅ GoblinRuntime ready with ${this.goblins.size} goblins`);

		// Check audit service configuration
		const auditUrl = process.env.AUDIT_URL || "http://localhost:19001/audit";
		const hasAuditKeys =
			!!(process.env.SECRET_KEY_BASE64 && process.env.PUBKEY_BASE64) ||
			!!process.env.KMS_KEY_ID;

		if (hasAuditKeys) {
			console.log(`✅ Audit logging enabled (${auditUrl})`);
		} else {
			console.log(
				`⚠️  Audit logging disabled - set SECRET_KEY_BASE64/PUBKEY_BASE64 or KMS_KEY_ID`,
			);
		}
		console.log("");
	}

	async executeTask(task: GoblinTask): Promise<GoblinResponse> {
		const startTime = Date.now();

		if (!this.initialized) {
			await this.initialize();
		}

		const goblin = this.goblins.get(task.goblin);
		if (!goblin) {
			throw new Error(`Goblin '${task.goblin}' not found`);
		}

		// Audit: Task started
		const taskStartEvent: TaskDecisionAuditEvent = {
			event_id: randomUUID(),
			occurred_at: new Date().toISOString(),
			actor: task.goblin,
			action: "task_started",
			task: task.task,
			reasoning: "",
			success: false, // Will be updated
			duration_ms: 0, // Will be updated
			context: task.context,
		};
		sendSignedAudit(taskStartEvent).catch((err) =>
			console.warn("Failed to send task start audit event:", err),
		);

		console.log(`🤖 ${goblin.title || task.goblin} is analyzing task...`);

		// Build prompts
		const systemPrompt = buildSystemPrompt(goblin);
		const taskPrompt = buildTaskPrompt(task.task, task.context);

		// Select provider
		const provider = this.selectProvider(goblin);

		let reasoning = "";
		let toolResult: ToolExecutionResult | null = null;
		let success = true;

		try {
			// Generate response from AI
			reasoning = await provider.generate(taskPrompt, {
				systemPrompt,
				temperature: 0.7,
			});

			// If dry-run, use ToolSelector to suggest a tool but don't execute it
			if (task.dryRun) {
				try {
					const selector = getToolSelector();
					const suggested = selector.autoSelectToolCommand(goblin.id, task.task);
					if (suggested && suggested.tool) {
						toolResult = {
							tool: suggested.tool,
							command: suggested.command,
							output: "(dry-run) command not executed",
							exitCode: 0,
							success: true,
						} as ToolExecutionResult;
					}
				} catch (err: any) {
					// Permission denied or other selector error - don't execute
					console.warn(`ToolSelector error (dry-run) for ${goblin.id}: ${err.message}`);
					toolResult = null;
				}
			} else {
				// Check if tool execution is needed
				toolResult = await this.executeToolIfNeeded(
					goblin,
					task.task,
					reasoning,
				);
				if (toolResult && !toolResult.success) {
					success = false;
				}
			}
		} catch (error: any) {
			success = false;
			reasoning = `Error: ${error.message}`;
		}

		const duration_ms = Date.now() - startTime;

		// Build response
		const response: GoblinResponse = {
			goblin: task.goblin,
			task: task.task,
			tool: toolResult?.tool,
			command: toolResult?.command,
			output: toolResult?.output,
			reasoning,
			timestamp: new Date(),
			duration_ms,
			success,
		};

		// Track KPIs
		response.kpis = this.extractKPIs(goblin, duration_ms, success);

		// Save to memory
		this.memory.save({
			id: randomUUID(),
			goblin: task.goblin,
			task: task.task,
			response: reasoning,
			timestamp: response.timestamp,
			kpis: response.kpis,
			success,
		});

		// Audit: Task completed
		const taskCompleteEvent: TaskDecisionAuditEvent = {
			event_id: randomUUID(),
			occurred_at: new Date().toISOString(),
			actor: task.goblin,
			action: success ? "task_completed" : "task_failed",
			task: task.task,
			reasoning,
			success,
			duration_ms,
			kpis: response.kpis,
			context: task.context,
		};
		sendSignedAudit(taskCompleteEvent).catch((err) =>
			console.warn("Failed to send task completion audit event:", err),
		);

		return response;
	}

	async executeTaskStreaming(
		task: GoblinTask,
		onChunk: (chunk: string) => void,
	): Promise<GoblinResponse> {
		const startTime = Date.now();

		if (!this.initialized) {
			await this.initialize();
		}

		const goblin = this.goblins.get(task.goblin);
		if (!goblin) {
			throw new Error(`Goblin '${task.goblin}' not found`);
		}

		console.log(
			`🤖 ${goblin.title || task.goblin} is analyzing task (streaming)...`,
		);

		// Build prompts
		const systemPrompt = buildSystemPrompt(goblin);
		const taskPrompt = buildTaskPrompt(task.task, task.context);

		// Select provider
		const provider = this.selectProvider(goblin);

		let reasoning = "";
		let toolResult: ToolExecutionResult | null = null;
		let success = true;

		try {
			// Stream response from AI
			const stream = provider.generateStream(taskPrompt, {
				systemPrompt,
				temperature: 0.7,
			});

			for await (const chunk of stream) {
				reasoning += chunk;
				onChunk(chunk);
			}

			// Check if tool execution is needed
			if (!task.dryRun) {
				toolResult = await this.executeToolIfNeeded(
					goblin,
					task.task,
					reasoning,
				);
				if (toolResult && !toolResult.success) {
					success = false;
				}
			}
		} catch (error: any) {
			success = false;
			reasoning = `Error: ${error.message}`;
			onChunk(`\n\n❌ Error: ${error.message}`);
		}

		const duration_ms = Date.now() - startTime;

		// Build response
		const response: GoblinResponse = {
			goblin: task.goblin,
			task: task.task,
			tool: toolResult?.tool,
			command: toolResult?.command,
			output: toolResult?.output,
			reasoning,
			timestamp: new Date(),
			duration_ms,
			success,
		};

		// Track KPIs
		response.kpis = this.extractKPIs(goblin, duration_ms, success);

		// Save to memory
		this.memory.save({
			id: randomUUID(),
			goblin: task.goblin,
			task: task.task,
			response: reasoning,
			timestamp: response.timestamp,
			kpis: response.kpis,
			success,
		});

		return response;
	}

	private selectProvider(goblin: GoblinConfig): ModelProvider {
		const brain = goblin.brain;

		// If the goblin specifies router order, try to honor it in order
		if (
			brain?.routers &&
			Array.isArray(brain.routers) &&
			brain.routers.length > 0
		) {
			for (const router of brain.routers) {
				const key = String(router).toLowerCase();
				// Direct match
				if (this.providers.has(key)) return this.providers.get(key)!;
				// Common aliases
				if (key === "google" && this.providers.has("gemini"))
					return this.providers.get("gemini")!;
				if (
					(key === "claude" || key === "anthropic") &&
					this.providers.has("anthropic")
				)
					return this.providers.get("anthropic")!;
				if (
					(key === "local" || key === "ollama") &&
					this.providers.has("ollama")
				)
					return this.providers.get("ollama")!;
			}
		}

		// Prefer local models if configured
		if (brain?.local && this.providers.has("ollama")) {
			return this.providers.get("ollama")!;
		}

		// Prefer OpenAI if available
		if (this.providers.has("openai")) {
			return this.providers.get("openai")!;
		}

		// Default to first available provider
		return this.providers.values().next().value!;
	}

	private async executeToolIfNeeded(
		goblin: GoblinConfig & { guild: string },
		task: string,
		reasoning: string,
	): Promise<ToolExecutionResult | null> {
		// Check if AI indicated tool execution
		const shouldExecute = reasoning.includes("EXECUTE_TOOL:");

		if (!shouldExecute) {
			// Fallback heuristic: common action words
			const actionWords = [
				"start",
				"run",
				"build",
				"test",
				"deploy",
				"execute",
			];
			const hasAction = actionWords.some((word) =>
				task.toLowerCase().includes(word),
			);

			if (!hasAction) return null;
		}

		// Use the shared ToolSelector to resolve tool and command for goblin intent
		const selector = getToolSelector();
		let selected: { tool: string | null; command: string | null; reason: string };
		try {
			selected = selector.autoSelectToolCommand(goblin.id, task);
		} catch (err: any) {
			// Permission error or other selection error - handle gracefully
			console.warn(`ToolSelector error for ${goblin.id}: ${err.message}`);
			return null;
		}

		if (!selected || !selected.tool) return null;

	const toolId = selected.tool;

		// Find guild and tool (for name & auditing metadata)
		const guild = this.guilds.find((g) => g.name === goblin.guild);
		if (!guild?.toolbelt) return null;

		const tool = guild.toolbelt.find((t: any) => t.id === toolId);
		if (!tool) {
			// If the tool is not found on the guild toolbelt, return null
			return null;
		}

		// Audit: Tool selected
		const toolSelectEvent: ToolExecutionAuditEvent = {
			event_id: randomUUID(),
			occurred_at: new Date().toISOString(),
			actor: goblin.id,
			action: "tool_selected",
			tool_id: tool.id,
			command: tool.command,
			success: false, // Will be updated
			duration_ms: 0, // Will be updated
			resource: {
				type: "tool",
				id: tool.id,
			},
			context: {
				task,
				selection_reason: selected.reason,
				guild: goblin.guild,
			},
		};
		sendSignedAudit(toolSelectEvent).catch((err) =>
			console.warn("Failed to send tool selection audit event:", err),
		);

		console.log(`\n🔧 Executing tool: ${tool.name}`);
		console.log(`📦 Command: ${tool.command}\n`);

		const toolStartTime = Date.now();

		try {
			const { stdout, stderr, exitCode } = await execa(
				"bash",
				["-c", tool.command],
				{
					cwd: process.cwd(),
					timeout: 120000, // 2 minutes
					reject: false, // Don't throw on non-zero exit
				},
			);

			const output = stdout || stderr || "No output";
			const success = exitCode === 0;

			// Audit: Tool executed successfully
			const toolCompleteEvent: ToolExecutionAuditEvent = {
				event_id: randomUUID(),
				occurred_at: new Date().toISOString(),
				actor: goblin.id,
				action: "tool_executed",
				tool_id: tool.id,
				command: tool.command,
				success,
				duration_ms: Date.now() - toolStartTime,
				resource: {
					type: "tool",
					id: tool.id,
				},
				context: {
					task,
					output_length: output.length,
					exit_code: exitCode,
				},
			};
			sendSignedAudit(toolCompleteEvent).catch((err) =>
				console.warn("Failed to send tool execution audit event:", err),
			);

			return {
				tool: tool.id,
				command: tool.command,
				output,
				exitCode,
				success,
			};
		} catch (error: any) {
			// Audit: Tool execution failed
			const toolFailEvent: ToolExecutionAuditEvent = {
				event_id: randomUUID(),
				occurred_at: new Date().toISOString(),
				actor: goblin.id,
				action: "tool_failed",
				tool_id: tool.id,
				command: tool.command,
				success: false,
				duration_ms: Date.now() - toolStartTime,
				resource: {
					type: "tool",
					id: tool.id,
				},
				context: {
					task,
					error: error.message,
				},
			};
			sendSignedAudit(toolFailEvent).catch((err) =>
				console.warn("Failed to send tool failure audit event:", err),
			);

			return {
				tool: tool.id,
				command: tool.command,
				output: `Execution error: ${error.message}`,
				exitCode: 1,
				success: false,
			};
		}
	}

	private extractKPIs(
		goblin: GoblinConfig,
		duration_ms: number,
		success: boolean,
	): Record<string, number> {
		const kpis: Record<string, number> = {
			duration_ms,
			success: success ? 1 : 0,
		};

		// Add goblin-specific KPIs if defined
		if (goblin.kpis) {
			// For now, just track task completion time as a basic metric
			kpis.task_completion_time = duration_ms / 1000; // in seconds
		}

		return kpis;
	}

	getGoblinHistory(goblinId: string, limit = 10) {
		return this.memory.getHistory(goblinId, limit);
	}

	getGoblinStats(goblinId: string) {
		const history = this.memory.getHistory(goblinId, 100); // Get more history for stats
		const totalTasks = history.length;
		const successfulTasks = history.filter((h) => h.success).length;
		const successRate =
			totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0;

		// Calculate average duration
		const durations = history
			.map((h) => h.kpis?.response_time_ms || 0)
			.filter((d) => d > 0);
		const avgDuration =
			durations.length > 0
				? durations.reduce((sum, d) => sum + d, 0) / durations.length
				: 0;

		return {
			totalTasks,
			successfulTasks,
			failedTasks: totalTasks - successfulTasks,
			successRate: Math.round(successRate * 100) / 100, // Round to 2 decimals
			avgDuration: Math.round(avgDuration),
			recentTasks: this.memory.getHistory(goblinId, 5),
		};
	}

	listGoblins() {
		return Array.from(this.goblins.entries()).map(([id, goblin]) => {
			// Find the guild this goblin belongs to
			const guild = this.guilds.find((g) => g.members.some((m) => m.id === id));
			const toolbelt =
				guild?.toolbelt?.filter((tool) => tool.owner === id) || [];

			return {
				id,
				name: goblin.title, // Add name for backward compatibility
				title: goblin.title,
				guild: goblin.guild,
				responsibilities: goblin.responsibilities,
				toolbelt: toolbelt.map((t) => ({
					id: t.id,
					name: t.name,
					summary: t.summary,
				})),
			};
		});
	}

	// RAG methods
	async addDocument(content: string, metadata?: Record<string, unknown>) {
		if (!this.rag) {
			throw new Error("RAG service not available. Ollama must be running.");
		}
		return await this.rag.addDocument(content, metadata);
	}

	async searchDocuments(query: string, limit = 5) {
		if (!this.rag) {
			throw new Error("RAG service not available. Ollama must be running.");
		}
		return await this.rag.search(query, limit);
	}

	async clearDocuments() {
		if (!this.rag) {
			throw new Error("RAG service not available. Ollama must be running.");
		}
		return await this.rag.clear();
	}

	close(): void {
		this.memory.close();
	}
}

export * from "./types.js";
export { OllamaProvider } from "./providers/ollama-provider.js";
export { OpenAIProvider } from "./providers/openai-provider.js";
export { GeminiProvider } from "./providers/gemini-provider.js";
export { AnthropicProvider } from "./providers/anthropic-provider.js";
export { DeepSeekProvider } from "./providers/deepseek-provider.js";
export { RAGService } from "./rag-service.js";
export * from "./rag/index.js";
export {
	OrchestrationParser,
	OrchestrationExecutor,
	OrchestrationStore,
	type OrchestrationStep,
	type OrchestrationPlan,
	type OrchestrationProgress,
} from "./orchestrator.js";
export { GoblinLoader } from "./goblin-loader.js";
export {
	CostTracker,
	calculateCost,
	type TokenUsage,
	type CostEntry,
	type CostSummary,
	type CostBreakdown,
} from "./cost-tracker.js";
