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
	// no-op placeholders in this stub implementation

	setAttribute(key: string, value: unknown): void {
		this.attributes[key] = value;
	}

	setStatus(_status: { code: number; message?: string }): void {
		// no-op in stub
	}

	recordException(_exception: Error): void {
		// no-op in stub
	}

	end(): void {
		// Span ended - in production would send to telemetry backend
	}
}

class MockTracer implements Tracer {
	startActiveSpan<T>(
		_name: string,
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
	getTracer(_name = "overmind"): Tracer {
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
