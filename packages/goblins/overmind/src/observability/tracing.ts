// Observability and tracing stub for Overmind

export interface Span {
	setAttribute(key: string, value: unknown): void;
	setStatus(status: { code: number; message?: string }): void;
	recordException(exception: Error): void;
	end(): void;
}

export interface Tracer {
	startActiveSpan<T>(name: string, fn: (span: Span) => T): T;
	startActiveSpan<T>(
		name: string,
		options: Record<string, unknown>,
		fn: (span: Span) => T,
	): T;
}

class MockSpan implements Span {
	private attributes: Record<string, unknown> = {};
	private status?: { code: number; message?: string };
	private exception?: Error;

	setAttribute(key: string, value: unknown): void {
		this.attributes[key] = value;
	}

	setStatus(status: { code: number; message?: string }): void {
		this.status = status;
	}

	recordException(exception: Error): void {
		this.exception = exception;
	}

	end(): void {
		// Span ended - in production would send to telemetry backend
	}
}

class MockTracer implements Tracer {
	startActiveSpan<T>(
		name: string,
		fnOrOptions: ((span: Span) => T) | Record<string, unknown>,
		maybeFn?: (span: Span) => T,
	): T {
		const span = new MockSpan();
		const fn = typeof fnOrOptions === "function" ? fnOrOptions : maybeFn!;

		try {
			return fn(span);
		} finally {
			span.end();
		}
	}
}

export const trace = {
	getTracer(name = "overmind"): Tracer {
		return new MockTracer();
	},
};

// Utility helpers for attaching attributes to spans (no-op stubs).
export const tracingUtils = {
	addSavingsAttributes(_span: Span, _attrs: Record<string, unknown>) {
		// no-op in stub
	},
	addOllamaSelectionAttributes(_span: Span, _attrs: Record<string, unknown>) {
		// no-op in stub
	},
	addRoutingAttributes(_span: Span, _attrs: Record<string, unknown>) {
		// no-op in stub
	},
	addHealthCheckAttributes(_span: Span, _attrs: Record<string, unknown>) {
		// no-op in stub
	},
};
