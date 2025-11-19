export { default } from "./tauri-client";
export * from "./tauri-client";

// Thin wrapper re-export to avoid compiled duplicate code.
export { default } from "./tauri-client";
export * from "./tauri-client";

    // ==========================================================================
    /**
     * Invoke parse_orchestration command
     * Parse orchestration syntax into execution plan
     */
    async parseOrchestration(text, defaultGoblinId) {
        try {
            const plan = await invoke("parse_orchestration", {
                text,
                defaultGoblinId,
            });
            return plan;
        }
        catch (error) {
            throw new Error(`Failed to parse orchestration: ${error}`);
        }
    }
    /**
     * Execute orchestration (could be implemented as a command)
     */
    async executeOrchestration(text, defaultGoblinId) {
        try {
            const plan = await invoke("execute_orchestration", { text, defaultGoblinId });
            return plan;
        } catch (error) {
            throw new Error(`Failed to execute orchestration: ${error}`);
        }
    }
    /**
     * Get orchestration plans (placeholder)
     */
    async getOrchestrationPlans() {
        // TODO: Implement when orchestration commands are available
        console.warn("getOrchestrationPlans not yet implemented in Tauri backend");
        return [];
    }
    /**
     * Get specific orchestration plan (placeholder)
     */
    async getOrchestrationPlan(planId) {
        // TODO: Implement when orchestration commands are available
        console.log("Requested planId:", planId);
        throw new Error("getOrchestrationPlan not yet implemented");
    }
    /**
     * Cancel orchestration (placeholder)
     */
    async cancelOrchestration(planId) {
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
    async getProviders() {
        try {
            const providers = await invoke("get_providers");
            return providers;
        }
        catch (error) {
            console.error("Failed to fetch providers:", error);
            throw new Error(`Failed to fetch providers: ${error}`);
        }
    }
    /**
     * Invoke get_provider_models command
     * Fetch available models for a specific provider
     */
    async getProviderModels(provider) {
        try {
            const models = await invoke("get_provider_models", {
                provider,
            });
            return models;
        }
        catch (error) {
            console.error("Failed to fetch provider models:", error);
            throw new Error(`Failed to fetch models for ${provider}: ${error}`);
        }
    }
    /**
     * Invoke store_api_key command
     * Store an API key for a provider
     */
    async storeApiKey(provider, key) {
        try {
            await invoke("store_api_key", { provider, key });
        }
        catch (error) {
            console.error("Failed to store API key:", error);
            throw new Error(`Failed to store API key: ${error}`);
        }
    }
    /**
     * Invoke get_api_key command
     * Retrieve an API key for a provider
     */
    async getApiKey(provider) {
        try {
            const key = await invoke("get_api_key", { provider });
            return key;
        }
        catch (error) {
            console.error("Failed to get API key:", error);
            throw new Error(`Failed to get API key: ${error}`);
        }
    }
    /**
     * Invoke clear_api_key command
     * Clear an API key for a provider
     */
    async clearApiKey(provider) {
        try {
            await invoke("clear_api_key", { provider });
        }
        catch (error) {
            console.error("Failed to clear API key:", error);
            throw new Error(`Failed to clear API key: ${error}`);
        }
    }
    /**
     * Invoke set_provider_api_key command
     * Set an API key for a provider (alias for storeApiKey)
     */
    async setProviderApiKey(provider, key) {
        return this.storeApiKey(provider, key);
    }
    /**
     * Invoke get_cost_summary command
     * Fetch cost summary data
     */
    async getCostSummary() {
        try {
            const summary = await invoke("get_cost_summary");
            return summary;
        }
        catch (error) {
            console.error("Failed to fetch cost summary:", error);
            throw new Error(`Failed to fetch cost summary: ${error}`);
        }
    }
    /**
     * Export cost data (placeholder - not yet implemented via IPC)
     */
    async exportCosts() {
        // TODO: Implement cost export via IPC
        throw new Error("Cost export not yet implemented via IPC");
    }
    // ==========================================================================
    // Event Streaming Methods (replace WebSocket)
    // ==========================================================================
    /**
     * Setup listeners for status updates and other events
     */
    setupStatusListeners() {
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
    async executeTaskStreaming(task, onStream) {
        // Register callback for this goblin
        this.streamCallbacks.set(task.goblin, onStream);
        // Set up event listener for task-stream events
        const unlisten = await listen("task-stream", (event) => {
            const payload = event.payload;
            // Convert Tauri event payload to StreamEvent format
            let streamEvent;
            if (payload.chunk) {
                // Streaming chunk
                streamEvent = {
                    type: "chunk",
                    goblin: payload.goblin || task.goblin,
                    task: payload.task || task.task,
                    data: payload.chunk,
                    timestamp: new Date().toISOString(),
                };
            }
            else if (payload.result) {
                // Final result
                streamEvent = {
                    type: "complete",
                    goblin: payload.goblin || task.goblin,
                    task: payload.task || task.task,
                    response: payload.result,
                    timestamp: new Date().toISOString(),
                };
            }
            else if (payload.error) {
                // Error
                streamEvent = {
                    type: "error",
                    goblin: payload.goblin || task.goblin,
                    task: payload.task || task.task,
                    error: payload.error,
                    timestamp: new Date().toISOString(),
                };
            }
            else {
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
        });
        // Store unlistener for cleanup
        this.eventUnlisteners.set(task.goblin, unlisten);
        try {
            // Start the task execution
            await invoke("execute_task", {
                goblinId: task.goblin,
                task: task.task,
                args: task.context || {},
            });
        }
        catch (error) {
            // Clean up on error
            this.cleanupStreaming(task.goblin);
            throw new Error(`Task execution failed: ${error}`);
        }
    }
    /**
     * Unsubscribe from streaming for a specific goblin
     */
    unsubscribe(goblinId) {
        this.cleanupStreaming(goblinId);
    }
    /**
     * Clean up streaming resources for a goblin
     */
    cleanupStreaming(goblinId) {
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
    isConnected() {
        return true; // Tauri IPC is always available
    }
    /**
     * Connect method for compatibility (no-op for Tauri)
     */
    // (legacy compiled JS removed)
// Export singleton instance
export * from "./tauri-client";
// (This file intentionally re-exports the TS module and contains no runtime code.)
