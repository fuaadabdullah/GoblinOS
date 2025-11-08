/**
 * RuntimeClient - HTTP + WebSocket client for GoblinOS Runtime Server
 *
 * Provides type-safe methods for:
 * - Fetching goblins list
 * - Executing tasks (streaming and non-streaming)
 * - Retrieving history and stats
 * - Real-time WebSocket streaming with auto-reconnect
 */
// ============================================================================
// RuntimeClient
// ============================================================================
export class RuntimeClient {
	constructor(baseUrl = "http://localhost:3001") {
		this.ws = null;
		this.reconnectAttempts = 0;
		this.maxReconnectAttempts = 5;
		this.reconnectDelay = 1000; // ms
		this.streamCallbacks = new Map();
		this.isReconnecting = false;
		this.baseUrl = baseUrl;
	}
	// ==========================================================================
	// REST API Methods
	// ==========================================================================
	/**
	 * GET /api/goblins
	 * Fetch list of all available goblins
	 */
	async getGoblins() {
		const response = await fetch(`${this.baseUrl}/api/goblins`);
		if (!response.ok) {
			throw new Error(`Failed to fetch goblins: ${response.statusText}`);
		}
		return response.json();
	}
	/**
	 * POST /api/execute
	 * Execute a task (non-streaming)
	 */
	async executeTask(task) {
		const response = await fetch(`${this.baseUrl}/api/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(task),
		});
		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: response.statusText }));
			throw new Error(error.error || "Task execution failed");
		}
		return response.json();
	}
	/**
	 * GET /api/history/:goblin
	 * Fetch task history for a specific goblin
	 */
	async getHistory(goblinId, limit = 10) {
		const response = await fetch(
			`${this.baseUrl}/api/history/${goblinId}?limit=${limit}`,
		);
		if (!response.ok) {
			throw new Error(`Failed to fetch history: ${response.statusText}`);
		}
		return response.json();
	}
	/**
	 * GET /api/stats/:goblin
	 * Fetch performance stats for a specific goblin
	 */
	async getStats(goblinId) {
		const response = await fetch(`${this.baseUrl}/api/stats/${goblinId}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch stats: ${response.statusText}`);
		}
		return response.json();
	}
	/**
	 * GET /api/health
	 * Check server health
	 */
	async getHealth() {
		const response = await fetch(`${this.baseUrl}/api/health`);
		if (!response.ok) {
			throw new Error(`Health check failed: ${response.statusText}`);
		}
		return response.json();
	}
	// ==========================================================================
	// Orchestration API Methods
	// ==========================================================================
	/**
	 * POST /api/orchestrate/parse
	 * Parse orchestration syntax into execution plan
	 */
	async parseOrchestration(text, defaultGoblinId) {
		const response = await fetch(`${this.baseUrl}/api/orchestrate/parse`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text, defaultGoblinId }),
		});
		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: response.statusText }));
			throw new Error(error.error || "Failed to parse orchestration");
		}
		return response.json();
	}
	/**
	 * POST /api/orchestrate/execute
	 * Execute an orchestration plan
	 */
	async executeOrchestration(text, defaultGoblinId) {
		const response = await fetch(`${this.baseUrl}/api/orchestrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text, defaultGoblinId }),
		});
		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: response.statusText }));
			throw new Error(error.error || "Failed to execute orchestration");
		}
		return response.json();
	}
	/**
	 * GET /api/orchestrate/plans
	 * Get all orchestration plans, optionally filtered by status
	 */
	async getOrchestrationPlans(status) {
		const url = status
			? `${this.baseUrl}/api/orchestrate/plans?status=${status}`
			: `${this.baseUrl}/api/orchestrate/plans`;
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch orchestration plans: ${response.statusText}`,
			);
		}
		return response.json();
	}
	/**
	 * GET /api/orchestrate/plans/:planId
	 * Get specific orchestration plan by ID
	 */
	async getOrchestrationPlan(planId) {
		const response = await fetch(
			`${this.baseUrl}/api/orchestrate/plans/${planId}`,
		);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch orchestration plan: ${response.statusText}`,
			);
		}
		return response.json();
	}
	/**
	 * POST /api/orchestrate/cancel/:planId
	 * Cancel a running orchestration
	 */
	async cancelOrchestration(planId) {
		const response = await fetch(
			`${this.baseUrl}/api/orchestrate/cancel/${planId}`,
			{
				method: "POST",
			},
		);
		if (!response.ok) {
			throw new Error(`Failed to cancel orchestration: ${response.statusText}`);
		}
		return response.json();
	}
	// ==========================================================================
	// WebSocket Streaming Methods
	// ==========================================================================
	/**
	 * Connect to WebSocket server
	 * Auto-reconnects on disconnect
	 */
	connect() {
		return new Promise((resolve, reject) => {
			const wsUrl = this.baseUrl.replace(/^http/, "ws") + "/ws";
			try {
				this.ws = new WebSocket(wsUrl);
				this.ws.onopen = () => {
					console.log("✅ WebSocket connected");
					this.reconnectAttempts = 0;
					this.isReconnecting = false;
					resolve();
				};
				this.ws.onmessage = (event) => {
					try {
						const streamEvent = JSON.parse(event.data);
						const callback = this.streamCallbacks.get(streamEvent.goblin);
						if (callback) {
							callback(streamEvent);
						}
					} catch (err) {
						console.error("Failed to parse WebSocket message:", err);
					}
				};
				this.ws.onerror = (error) => {
					console.error("WebSocket error:", error);
					reject(error);
				};
				this.ws.onclose = () => {
					console.log("🔌 WebSocket disconnected");
					this.handleReconnect();
				};
			} catch (error) {
				reject(error);
			}
		});
	}
	/**
	 * Handle automatic reconnection
	 */
	handleReconnect() {
		if (
			this.isReconnecting ||
			this.reconnectAttempts >= this.maxReconnectAttempts
		) {
			return;
		}
		this.isReconnecting = true;
		this.reconnectAttempts++;
		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
		console.log(
			`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
		);
		setTimeout(() => {
			this.connect().catch((err) => {
				console.error("Reconnection failed:", err);
			});
		}, delay);
	}
	/**
	 * Execute task with streaming response
	 * Streams chunks in real-time via WebSocket
	 */
	async executeTaskStreaming(task, onStream) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			await this.connect();
		}
		// Register callback for this goblin
		this.streamCallbacks.set(task.goblin, onStream);
		// Send execute request
		this.ws.send(
			JSON.stringify({
				action: "execute",
				goblin: task.goblin,
				task: task.task,
				context: task.context,
			}),
		);
	}
	/**
	 * Unsubscribe from streaming for a specific goblin
	 */
	unsubscribe(goblinId) {
		this.streamCallbacks.delete(goblinId);
	}
	/**
	 * Disconnect WebSocket
	 */
	disconnect() {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.streamCallbacks.clear();
	}
	/**
	 * Check if WebSocket is connected
	 */
	isConnected() {
		return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
	}
}
// ============================================================================
// Singleton instance (optional convenience)
// ============================================================================
let defaultClient = null;
export function getDefaultClient(baseUrl) {
	if (!defaultClient) {
		defaultClient = new RuntimeClient(baseUrl);
	}
	return defaultClient;
}
export function resetDefaultClient() {
	if (defaultClient) {
		defaultClient.disconnect();
		defaultClient = null;
	}
}
