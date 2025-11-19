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
import type { NodeSDK } from "@opentelemetry/sdk-node";
/**
 * Initialize OpenTelemetry tracing for a service.
 *
 * @param serviceName - Name of the service (e.g., 'overmind-bridge', 'overmind-api')
 * @param serviceVersion - Version of the service
 * @param otlpEndpoint - OTLP collector endpoint (default: http://localhost:4318/v1/traces)
 */
export declare function initTracing(
	serviceName: string,
	serviceVersion?: string,
	otlpEndpoint?: string,
): NodeSDK;
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
export declare const tracingUtils: {
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
	): void;
	/**
	 * Add Ollama model selection attributes to a span
	 */
	addOllamaSelectionAttributes(
		span: any,
		model: string,
		taskType: string,
		volumeThreshold?: number,
	): void;
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
	): void;
	/**
	 * Add health check attributes to a span
	 */
	addHealthCheckAttributes(
		span: any,
		health: {
			available: boolean;
			models: string[];
			pulledModels: string[];
		},
	): void;
};
//# sourceMappingURL=tracing.d.ts.map
