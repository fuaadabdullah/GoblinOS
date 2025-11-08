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
	token: string;
	is_complete: boolean;
}

export class TauriRuntimeClient {
	async getGoblins(): Promise<GoblinStatus[]> {
		return invoke("get_goblins");
	}

	async getProviders(): Promise<string[]> {
		return invoke("get_providers");
	}

	async executeTask(
		goblin: string,
		task: string,
		streaming = false,
	): Promise<GoblinResponse> {
		return invoke("execute_task", {
			request: { goblin, task, streaming },
		});
	}

	async getHistory(goblin: string, limit = 10): Promise<MemoryEntry[]> {
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
		onChunk: (chunk: string) => void,
		onComplete?: (response: GoblinResponse) => void,
	): Promise<void> {
		// Start streaming execution
		const responsePromise = this.executeTask(goblin, task, true);

		// Listen for stream events
		const unlisten = await listen(
			"stream-token",
			(event: { payload: StreamEvent }) => {
				const { token, is_complete } = event.payload;
				onChunk(token);

				if (is_complete) {
					unlisten();
					if (onComplete) {
						responsePromise.then(onComplete);
					}
				}
			},
		);

		return responsePromise.then(() => {}); // Return void, completion handled via events
	}
}

export const runtimeClient = new TauriRuntimeClient();
