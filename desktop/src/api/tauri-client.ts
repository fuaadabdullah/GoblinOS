import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface GoblinStatus {
	id: string;
	name: string;
	title: string;
	status: string;
	guild?: string;
}

export interface ExecuteRequest {
	goblin: string;
	task: string;
	streaming?: boolean;
	provider?: string;
	model?: string;
}

export interface GoblinResponse {
	goblin: string;
	task: string;
	reasoning: string;
	tool?: string;
	command?: string;
	output?: string;
	duration_ms: number;
	cost?: number;
	model?: string;
	provider?: string;
}

export interface MemoryEntry {
	id: string;
	goblin: string;
	task: string;
	response: string;
	timestamp: number;
	kpis?: string;
}

export interface CostSummary {
	total_cost: number;
	cost_by_provider: Record<string, number>;
	cost_by_model: Record<string, number>;
}

export interface OrchestrationStep {
	id: string;
	goblin: string;
	task: string;
	dependencies: string[];
	batch: number;
}

export interface OrchestrationPlan {
	steps: OrchestrationStep[];
	total_batches: number;
	max_parallel: number;
	estimated_cost?: number;
}

export interface StreamEvent {
	content: string;
	done: boolean;
}

export class TauriRuntimeClient {
	async getGoblins(): Promise<GoblinStatus[]> {
		return invoke("get_goblins");
	}

	async getProviders(): Promise<string[]> {
		return invoke("get_providers");
	}

	async getProviderModels(provider: string): Promise<string[]> {
		return invoke("get_provider_models", { provider });
	}

	async executeTask(
		goblin: string,
		task: string,
		streaming = false,
		provider?: string,
		model?: string,
	): Promise<string> {
		return invoke("execute_task", {
			goblinId: goblin,
			task,
			streaming,
			args: { provider, model },
		});
	}	async getHistory(goblin: string, limit = 10): Promise<MemoryEntry[]> {
		return invoke("get_history", { goblin, limit });
	}

	async getStats(goblin: string): Promise<any> {
		return invoke("get_stats", { goblin });
	}

	async getCostSummary(): Promise<CostSummary> {
		return invoke("get_cost_summary");
	}

	async parseOrchestration(
		text: string,
		defaultGoblin?: string,
	): Promise<OrchestrationPlan> {
		return invoke("parse_orchestration", {
			text,
			default_goblin: defaultGoblin,
		});
	}

	// Streaming execution with callback
	async executeTaskStreaming(
		goblin: string,
		task: string,
		onChunk: (chunk: any) => void,
		onComplete?: (response: any) => void,
		provider?: string,
		model?: string,
	): Promise<void> {
		// Start streaming execution
		const startPromise = this.executeTask(goblin, task, true, provider, model);

		// Listen for task-stream events
		const unlisten = await listen("task-stream", (event: { payload: any }) => {
			const payload = event.payload;
			onChunk(payload);

			// Check if this is the final result (has 'result' field)
			if (payload.result !== undefined) {
				unlisten();
				if (onComplete) {
					onComplete(payload);
				}
			}
		});

		return startPromise.then(() => {}); // Return void, completion handled via events
	}

	async storeApiKey(provider: string, key: string): Promise<void> {
		return invoke("store_api_key", { provider, key });
	}

	async getApiKey(provider: string): Promise<string | null> {
		return invoke("get_api_key", { provider });
	}

	async clearApiKey(provider: string): Promise<void> {
		return invoke("clear_api_key", { provider });
	}

	async setProviderApiKey(provider: string, key: string): Promise<void> {
		return invoke("set_provider_api_key", { provider, key });
	}
}

export const runtimeClient = new TauriRuntimeClient();
