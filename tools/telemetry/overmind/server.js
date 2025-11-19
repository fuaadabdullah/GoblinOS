// Use global fetch available in modern Node.js (v18+).
import { randomUUID } from "crypto";
import * as otel from "@opentelemetry/api";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import express from "express";
import { sendSignedAudit } from "./auditClient.js";

// Minimal OTEL setup (console exporter). For PoC only.
const provider = new NodeTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
provider.register();
const tracer = otel.trace.getTracer("goblin-overmind-poc");

const app = express();
// allow tests / callers to override the audit sender (dependency injection)
// fallback to the real sendSignedAudit implementation when not overridden
app.locals.auditSender = app.locals.auditSender || sendSignedAudit;
const LITEBRAIN_URL =
	process.env.LITEBRAIN_URL || "http://localhost:8001/process";

// Extracted handler so tests can call it directly and inject dependencies.
export async function handleQuestion(req, res) {
	const requestId = randomUUID();
	const goblinId = "glitch-whisperer-poc";
	const input = req.query?.input || "hello";

	return tracer.startActiveSpan("request.overmind.question", async (span) => {
		try {
			span.setAttribute("request.id", requestId);
			span.setAttribute("goblin.id", goblinId);

			// Call LiteBrain, inject trace context
			const headers = {};
			otel.propagation.inject(otel.context.active(), headers);

			const response = await fetch(
				`${LITEBRAIN_URL}?input=${encodeURIComponent(input)}`,
				{ headers },
			);
			const body = await response.json();

			// Determine ticket id: prefer LiteBrain-provided id, fall back to a generated id
			const ticketId =
				body?.ticket_id ||
				(body && body.ticket && body.ticket.id) ||
				randomUUID();

			// Emit a signed audit event for the decision using centralized audit client
			const envelope = {
				event_id: randomUUID(),
				occurred_at: new Date().toISOString(),
				actor: goblinId,
				action: "created_ticket_from_anomaly",
				resource: { type: "ticket", id: ticketId },
				context: {
					note: "PoC audit event",
					trace_id: span.spanContext().traceId,
				},
			};

			// pass debug option if environment requests it
			const auditSender =
				req.app?.locals?.auditSender ||
				app.locals.auditSender ||
				sendSignedAudit;
			const evt = await auditSender(envelope, {
				debug: process.env.DEBUG_AUDIT_BYTES === "1",
			});

			return res.json({
				requestId,
				result: body,
				audit_event: { event_id: evt.event_id, signature: evt.signature },
			});
		} catch (err) {
			return res.status(500).json({ error: String(err) });
		} finally {
			span.end();
		}
	});
}

app.get("/question", handleQuestion);

// Export the express app for testing and DI.
export { app };

// Simple health/debug endpoint
app.get("/_health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 7000;
app.listen(PORT, () =>
	console.log(`Overmind PoC listening on http://localhost:${PORT}`),
);
