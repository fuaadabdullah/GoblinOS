import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { ProviderMetrics } from "./types.js";

const tracer = trace.getTracer("@goblinos/providers");

/**
 * Create a traced span for LLM operations
 */
export function createLLMSpan<T>(
	name: string,
	attributes: Record<string, string | number | boolean>,
	fn: () => Promise<T>,
): Promise<T> {
	return tracer.startActiveSpan(name, async (span) => {
		try {
			// Set initial attributes
			for (const [key, value] of Object.entries(attributes)) {
				span.setAttribute(key, value);
			}

			const result = await fn();
			span.setStatus({ code: SpanStatusCode.OK });
			return result;
		} catch (error) {
			span.setStatus({
				code: SpanStatusCode.ERROR,
				message: error instanceof Error ? error.message : String(error),
			});
			span.recordException(error as Error);
			throw error;
		} finally {
			span.end();
		}
	});
}

/**
 * Record provider metrics as span attributes
 */
export function recordProviderMetrics(metrics: ProviderMetrics): void {
	const span = trace.getActiveSpan();
	if (!span) return;

	span.setAttributes({
		"llm.provider": metrics.provider,
		"llm.model": metrics.model,
		"llm.latency": metrics.latencyMs,
		"llm.tokens.input": metrics.inputTokens,
		"llm.tokens.output": metrics.outputTokens,
		"llm.tokens.total": metrics.totalTokens,
		"llm.cost": metrics.cost,
		"llm.success": metrics.success,
	});

	if (metrics.error) {
		span.setAttribute("llm.error", metrics.error);
	}
}

/**
 * Record fallback chain in telemetry
 */
export function recordFallbackChain(
	attempts: Array<{ model: string; success: boolean; error?: string }>,
): void {
	const span = trace.getActiveSpan();
	if (!span) return;

	span.setAttribute("llm.fallback.attempts", attempts.length);
	span.setAttribute(
		"llm.fallback.chain",
		attempts.map((a) => a.model).join(" -> "),
	);

	const successfulModel = attempts.find((a) => a.success)?.model;
	if (successfulModel) {
		span.setAttribute("llm.fallback.success_model", successfulModel);
	}
}
