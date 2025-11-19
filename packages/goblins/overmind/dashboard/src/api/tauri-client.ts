/**
 * TauriClient - IPC + Event client for GoblinOS Tauri Runtime
 *
 * Provides type-safe methods for:
 * - Fetching goblins list
 * - Executing tasks (streaming and non-streaming)
 * - Retrieving history and stats
 * - Real-time Tauri event streaming (task-stream) and status updates
 */

import { invoke } from "@tauri-apps/api/core";
import { type UnlistenFn, listen } from "@tauri-apps/api/event";
import type {
	Goblin,
	GoblinTask,
	GoblinResponse,
	GoblinStats,
	HistoryEntry,
	HealthResponse,
	StreamEvent,
	StreamCallback,
	OrchestrationStep,
	OrchestrationPlan,
	OrchestrationProgress,
} from "./types";

// Re-export API types for backwards compatibility
export type {
	Goblin,
	GoblinTask,
	GoblinResponse,
	GoblinStats,
	HistoryEntry,
	HealthResponse,
	StreamEvent,
	StreamCallback,
	OrchestrationStep,
	OrchestrationPlan,
	OrchestrationProgress,
} from "./types";

// Types are imported from ./types

// ============================================================================
// Tauri Event Types
// ============================================================================

interface TaskStreamEventPayload {
	goblin?: string;
	task?: string;
	chunk?: string;
	result?: GoblinResponse;
	error?: string;
}

// Orchestration types are imported from ./types

// ============================================================================
// TauriClient
// ============================================================================

export class TauriClient {
	private streamCallbacks = new Map<string, StreamCallback>();
	private eventUnlisteners = new Map<string, UnlistenFn>();

	constructor() {
		// Initialize event listeners for status updates
		this.setupStatusListeners();
	}

	// ==========================================================================
	// IPC Command Methods (replace REST API)
	// ==========================================================================

	/**
	 * Invoke get_goblins command
	 * Fetch list of all available goblins
	 */
	async getGoblins(): Promise<Goblin[]> {
		try {
			const goblins = await invoke<Goblin[]>("get_goblins");
			return goblins;
		} catch (error) {
			console.error("Failed to fetch goblins:", error);
			throw new Error(`Failed to fetch goblins: ${error}`);
		}
	}

	/**
	 * Invoke execute_task command (non-streaming)
	 * Execute a task without streaming
	 */
	async executeTask(task: GoblinTask): Promise<GoblinResponse> {
		try {
			const response = await invoke<GoblinResponse>("execute_task", {
				goblinId: task.goblin,
				task: task.task,
				args: task.context || {},
			});
			return response;
		} catch (error) {
			throw new Error(`Task execution failed: ${error}`);
		}
	}

	/**
	 * Invoke get_history command
	 * Fetch task history for a specific goblin
	 */
	async getHistory(goblinId: string, limit = 10): Promise<HistoryEntry[]> {
		try {
			const history = await invoke<HistoryEntry[]>("get_history", {
				goblinId,
				limit,
			});
			return history;
		} catch (error) {
			throw new Error(`Failed to fetch history: ${error}`);
		}
	}

	/**
	 * Invoke get_stats command
	 * Fetch performance stats for a specific goblin
	 */
	async getStats(goblinId: string): Promise<GoblinStats> {
		try {
			const stats = await invoke<GoblinStats>("get_stats", {
				goblinId,
			});
			return stats;
		} catch (error) {
			throw new Error(`Failed to fetch stats: ${error}`);
		}
	}

	/**
	 * Health check via IPC (could be a simple ping command)
	 */
	async getHealth(): Promise<HealthResponse> {
		try {
			// For now, assume runtime is healthy if we can invoke commands
			// In the future, this could be a dedicated health command
			await invoke("get_goblins");
			return {
				status: "healthy",
				initialized: true,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			console.error("Health check failed:", error);
			return {
				status: "unhealthy",
				initialized: false,
				timestamp: new Date().toISOString(),
			};
		}
	}

	/**
	 * Start the goblin runtime
	 */
	async startRuntime(): Promise<string> {
		try {
			const result = await invoke<string>("start_runtime");
			return result;
		} catch (error) {
			throw new Error(`Failed to start runtime: ${error}`);
		}
	}

	/**
	 * Stop the goblin runtime
	 */
	async stopRuntime(): Promise<string> {
		try {
			const result = await invoke<string>("stop_runtime");
			return result;
		} catch (error) {
			throw new Error(`Failed to stop runtime: ${error}`);
		}
	}

	// ==========================================================================
	// Orchestration IPC Methods
	// ==========================================================================

	/**
	 * Invoke parse_orchestration command
	 * Parse orchestration syntax into execution plan
	 */
	async parseOrchestration(
		text: string,
		defaultGoblinId?: string,
	): Promise<OrchestrationPlan> {
		try {
			const plan = await invoke<OrchestrationPlan>("parse_orchestration", {
				text,
				defaultGoblinId,
			});
			return plan;
		} catch (error) {
			throw new Error(`Failed to parse orchestration: ${error}`);
		}
	}

	/**
	 * Execute orchestration (could be implemented as a command)
	 */
	async executeOrchestration(
		text: string,
		defaultGoblinId?: string,
	): Promise<OrchestrationPlan> {
		try {
			const plan = await invoke("execute_orchestration", { text, defaultGoblinId });
			return plan as OrchestrationPlan;
		} catch (error) {
			throw new Error(`Failed to execute orchestration: ${error}`);
		}
	}

	/**
	 * Get orchestration plans (placeholder)
	 */
	async getOrchestrationPlans(): Promise<OrchestrationPlan[]> {
		// TODO: Implement when orchestration commands are available
		console.warn("getOrchestrationPlans not yet implemented in Tauri backend");
		return [];
	}

	/**
	 * Get specific orchestration plan (placeholder)
	 */
	async getOrchestrationPlan(planId: string): Promise<OrchestrationPlan> {
		// TODO: Implement when orchestration commands are available
		console.log("Requested planId:", planId);
		throw new Error("getOrchestrationPlan not yet implemented");
	}

	/**
	 * Cancel orchestration (placeholder)
	 */
	async cancelOrchestration(
		planId: string,
	): Promise<{ success: boolean; planId: string }> {
		// TODO: Implement when orchestration commands are available
		console.log("Cancelling planId:", planId);
		throw new Error("cancelOrchestration not yet implemented");
	}

	// ==========================================================================
	// API Key Management IPC Methods
	// ==========================================================================

	/**
	 * Invoke get_providers command
	 * Fetch list of available AI providers
	 */
	async getProviders(): Promise<string[]> {
		try {
			const providers = await invoke<string[]>("get_providers");
			return providers;
		} catch (error) {
			console.error("Failed to fetch providers:", error);
			throw new Error(`Failed to fetch providers: ${error}`);
		}
	}

	/**
	 * Invoke get_provider_models command
	 * Fetch available models for a specific provider
	 */
	async getProviderModels(provider: string): Promise<string[]> {
		try {
			const models = await invoke<string[]>("get_provider_models", {
				provider,
			});
			return models;
		} catch (error) {
			console.error("Failed to fetch provider models:", error);
			throw new Error(`Failed to fetch models for ${provider}: ${error}`);
		}
	}

	/**
	 * Invoke store_api_key command
	 * Store an API key for a provider
	 */
	async storeApiKey(provider: string, key: string): Promise<void> {
		try {
			await invoke("store_api_key", { provider, key });
		} catch (error) {
			console.error("Failed to store API key:", error);
			throw new Error(`Failed to store API key: ${error}`);
		}
	}

	/**
	 * Invoke get_api_key command
	 * Retrieve an API key for a provider
	 */
	async getApiKey(provider: string): Promise<string | null> {
		try {
			const key = await invoke<string | null>("get_api_key", { provider });
			return key;
		} catch (error) {
			console.error("Failed to get API key:", error);
			throw new Error(`Failed to get API key: ${error}`);
		}
	}

	/**
	 * Invoke clear_api_key command
	 * Clear an API key for a provider
	 */
	async clearApiKey(provider: string): Promise<void> {
		try {
			await invoke("clear_api_key", { provider });
		} catch (error) {
			console.error("Failed to clear API key:", error);
			throw new Error(`Failed to clear API key: ${error}`);
		}
	}

	/**
	 * Invoke set_provider_api_key command
	 * Set an API key for a provider (alias for storeApiKey)
	 */
	async setProviderApiKey(provider: string, key: string): Promise<void> {
		return this.storeApiKey(provider, key);
	}

	/**
	 * Invoke get_cost_summary command
	 * Fetch cost summary data
	 */
	async getCostSummary(): Promise<any> {
		try {
			const summary = await invoke<any>("get_cost_summary");
			return summary;
		} catch (error) {
			console.error("Failed to fetch cost summary:", error);
			throw new Error(`Failed to fetch cost summary: ${error}`);
		}
	}

	/**
	 * Export cost data (placeholder - not yet implemented via IPC)
	 */
	async exportCosts(): Promise<string> {
		// TODO: Implement cost export via IPC
		throw new Error("Cost export not yet implemented via IPC");
	}

	// ==========================================================================
	// Event Streaming Methods (replace WebSocket)
	// ==========================================================================

	/**
	 * Setup listeners for status updates and other events
	 */
	private setupStatusListeners() {
		// Listen for runtime status updates
		listen("runtime-status", (event) => {
			console.log("Runtime status update:", event.payload);
		}).catch(console.error);

		// Listen for goblin status updates
		listen("goblin-status", (event) => {
			console.log("Goblin status update:", event.payload);
		}).catch(console.error);
	}

	/**
	 * Execute task with streaming response via Tauri events
	 * Streams chunks in real-time via "task-stream" events
	 */
	async executeTaskStreaming(
		task: GoblinTask,
		onStream: StreamCallback,
	): Promise<void> {
		// Register callback for this goblin
		this.streamCallbacks.set(task.goblin, onStream);

		// Set up event listener for task-stream events
		const unlisten = await listen(
			"task-stream",
			(event: { payload: TaskStreamEventPayload }) => {
				const payload = event.payload;

				// Convert Tauri event payload to StreamEvent format
				let streamEvent: StreamEvent;

				if (payload.chunk) {
					// Streaming chunk
					streamEvent = {
						type: "chunk",
						goblin: payload.goblin || task.goblin,
						task: payload.task || task.task,
						data: payload.chunk,
						timestamp: new Date().toISOString(),
					};
				} else if (payload.result) {
					// Final result
					streamEvent = {
						type: "complete",
						goblin: payload.goblin || task.goblin,
						task: payload.task || task.task,
						response: payload.result,
						timestamp: new Date().toISOString(),
					};
				} else if (payload.error) {
					// Error
					streamEvent = {
						type: "error",
						goblin: payload.goblin || task.goblin,
						task: payload.task || task.task,
						error: payload.error,
						timestamp: new Date().toISOString(),
					};
				} else {
					// Unknown payload type
					console.warn("Unknown task-stream payload:", payload);
					return;
				}

				// Call the registered callback
				const callback = this.streamCallbacks.get(task.goblin);
				if (callback) {
					callback(streamEvent);
				}

				// Clean up listener on completion or error
				if (streamEvent.type === "complete" || streamEvent.type === "error") {
					this.cleanupStreaming(task.goblin);
				}
			},
		);

		// Store unlistener for cleanup
		this.eventUnlisteners.set(task.goblin, unlisten);

		try {
			// Start the task execution
			await invoke("execute_task", {
				goblinId: task.goblin,
				task: task.task,
				args: task.context || {},
			});
		} catch (error) {
			// Clean up on error
			this.cleanupStreaming(task.goblin);
			throw new Error(`Task execution failed: ${error}`);
		}
	}

	/**
	 * Unsubscribe from streaming for a specific goblin
	 */
	unsubscribe(goblinId: string) {
		this.cleanupStreaming(goblinId);
	}

	/**
	 * Clean up streaming resources for a goblin
	 */
	private cleanupStreaming(goblinId: string) {
		// Remove callback
		this.streamCallbacks.delete(goblinId);

		// Unlisten from events
		const unlisten = this.eventUnlisteners.get(goblinId);
		if (unlisten) {
			unlisten();
			this.eventUnlisteners.delete(goblinId);
		}
	}

	/**
	 * Disconnect and clean up all resources
	 */
	disconnect() {
		// Clean up all streaming callbacks and listeners
		for (const goblinId of this.streamCallbacks.keys()) {
			this.cleanupStreaming(goblinId);
		}
		this.streamCallbacks.clear();
		this.eventUnlisteners.clear();
	}

	/**
	 * Check if client is connected (always true for Tauri IPC)
	 */
	isConnected(): boolean {
		return true; // Tauri IPC is always available
	}

	/**
	 * Connect method for compatibility (no-op for Tauri)
	 */
	async connect(): Promise<void> {
		// Tauri IPC is always connected
	}
}

// Export RuntimeClient as alias for TauriClient for backward compatibility
export type RuntimeClient = TauriClient;

// Export singleton instance
export const tauriClient = new TauriClient();

// Export getDefaultClient for backward compatibility
export function getDefaultClient(_baseUrl?: string): TauriClient {
	return tauriClient;
}
