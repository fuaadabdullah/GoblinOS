/**
 * OpenTelemetry configuration for Overmind services.
 *
 * Provides distributed tracing for:
 * - Routing decisions
 * - LLM API calls
 * - Memory operations
 * - Cross-service requests
 *
 * Usage:
 *   import { initTracing } from './tracing.js';
 *   initTracing('overmind-bridge');
 */

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import {
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

/**
 * Initialize OpenTelemetry tracing for a service.
 *
 * @param serviceName - Name of the service (e.g., 'overmind-bridge', 'overmind-api')
 * @param serviceVersion - Version of the service
 * @param otlpEndpoint - OTLP collector endpoint (default: http://localhost:4318/v1/traces)
 */
export function initTracing(
	serviceName: string,
	serviceVersion = "1.0.0",
	otlpEndpoint: string = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
		"http://localhost:4318/v1/traces",
): NodeSDK {
	const resource = resourceFromAttributes({
		[ATTR_SERVICE_NAME]: serviceName,
		[ATTR_SERVICE_VERSION]: serviceVersion,
	});

	const traceExporter = new OTLPTraceExporter({
		url: otlpEndpoint,
	});

	// Some OpenTelemetry type packages may provide slightly different
	// SpanProcessor shapes between versions. Cast to `any` here to avoid
	// compile-time mismatches during triage; long-term we should align
	// dependency versions or implement a thin adapter.
	const sdk = new NodeSDK({
		resource,
		spanProcessors: [new BatchSpanProcessor(traceExporter) as unknown as any],
		instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()],
	});

	sdk.start();

	console.log(`[OpenTelemetry] Tracing initialized for ${serviceName}`);
	console.log(`[OpenTelemetry] Exporting to ${otlpEndpoint}`);

	// Graceful shutdown
	process.on("SIGTERM", () => {
		sdk
			.shutdown()
			.then(() => console.log("[OpenTelemetry] Tracing terminated"))
			.catch((error) =>
				console.error("[OpenTelemetry] Error terminating tracing", error),
			)
			.finally(() => process.exit(0));
	});

	return sdk;
}

/**
 * Create a manual span for custom instrumentation.
 *
 * Example:
 *   import { trace } from '@opentelemetry/api';
 *   const tracer = trace.getTracer('overmind-routing');
 *   const span = tracer.startSpan('selectProvider');
 *   try {
 *     span.setAttribute('provider', 'gemini');
 *     // ... routing logic
 *   } finally {
 *     span.end();
 *   }
 */
export { trace, context, SpanStatusCode } from "@opentelemetry/api";

/**
 * Enhanced tracing utilities for Ollama and routing operations
 */
export const tracingUtils = {
	/**
	 * Add savings attributes to a span
	 */
	addSavingsAttributes(
		span: any,
		savings: {
			savings: number;
			percentage: number;
			cloudCost: number;
			ollamaCost: number;
		},
	) {
		span.setAttribute("savings.amount", savings.savings);
		span.setAttribute("savings.percentage", savings.percentage);
		span.setAttribute("cost.cloud", savings.cloudCost);
		span.setAttribute("cost.ollama", savings.ollamaCost);
	},

	/**
	 * Add Ollama model selection attributes to a span
	 */
	addOllamaSelectionAttributes(
		span: any,
		model: string,
		taskType: string,
		volumeThreshold?: number,
	) {
		span.setAttribute("ollama.model", model);
		span.setAttribute("ollama.task_type", taskType);
		if (volumeThreshold !== undefined) {
			span.setAttribute("ollama.volume_threshold", volumeThreshold);
		}
	},

	/**
	 * Add routing decision attributes to a span
	 */
	addRoutingAttributes(
		span: any,
		decision: {
			provider: string;
			model: string;
			reason: string;
			savings?: number;
		},
	) {
		span.setAttribute("routing.provider", decision.provider);
		span.setAttribute("routing.model", decision.model);
		span.setAttribute("routing.reason", decision.reason);
		if (decision.savings !== undefined) {
			span.setAttribute("routing.savings", decision.savings);
		}
	},

	/**
	 * Add health check attributes to a span
	 */
	addHealthCheckAttributes(
		span: any,
		health: { available: boolean; models: string[]; pulledModels: string[] },
	) {
		span.setAttribute("health.available", health.available);
		span.setAttribute("health.models_count", health.models.length);
		span.setAttribute("health.pulled_models_count", health.pulledModels.length);
		span.setAttribute("health.models", health.models.join(","));
		span.setAttribute("health.pulled_models", health.pulledModels.join(","));
	},
};
