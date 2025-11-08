import type { ProviderConfig } from "./config.js";
import { recordFallbackChain } from "./telemetry.js";
import type { FallbackAttempt } from "./types.js";

/**
 * Handles fallback logic across multiple models
 */
export class FallbackHandler {
	private config: ProviderConfig;
	private attempts: FallbackAttempt[] = [];

	constructor(config: ProviderConfig) {
		this.config = config;
	}

	/**
	 * Execute a function with automatic fallback to alternative models
	 */
	async executeWithFallback<T>(
		primaryModel: string,
		fn: (model: string) => Promise<T>,
	): Promise<T> {
		this.attempts = [];
		const modelsToTry = [primaryModel, ...this.config.fallbackModels];

		for (let i = 0; i < modelsToTry.length; i++) {
			const model = modelsToTry[i];
			const startTime = Date.now();

			try {
				const result = await fn(model);

				// Record successful attempt
				this.attempts.push({
					model,
					success: true,
					latencyMs: Date.now() - startTime,
				});

				if (this.config.telemetry && i > 0) {
					// Only record fallback chain if we actually fell back
					recordFallbackChain(this.attempts);
				}

				return result;
			} catch (error) {
				const latencyMs = Date.now() - startTime;

				this.attempts.push({
					model,
					success: false,
					error: error instanceof Error ? error.message : String(error),
					latencyMs,
				});

				// If this was the last model, throw the error
				if (i === modelsToTry.length - 1) {
					if (this.config.telemetry) {
						recordFallbackChain(this.attempts);
					}

					throw new Error(
						`All models failed. Attempts: ${this.attempts
							.map((a) => `${a.model}: ${a.error}`)
							.join(", ")}`,
					);
				}

				// Otherwise, continue to next fallback
				console.warn(
					`Model ${model} failed (${error instanceof Error ? error.message : String(error)}), ` +
						`falling back to ${modelsToTry[i + 1]}`,
				);
			}
		}

		// This should never be reached
		throw new Error("Fallback handler reached unexpected state");
	}

	/**
	 * Get fallback attempt history
	 */
	getAttempts(): FallbackAttempt[] {
		return [...this.attempts];
	}

	/**
	 * Reset attempt history
	 */
	resetAttempts(): void {
		this.attempts = [];
	}
}
