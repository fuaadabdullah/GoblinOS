import express from 'express';
// Use global fetch available in modern Node.js (v18+).
import { randomUUID } from 'crypto';
import * as otel from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { sendSignedAudit } from './auditClient.js';

// Minimal OTEL setup (console exporter). For PoC only.
const provider = new NodeTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
provider.register();
const tracer = otel.trace.getTracer('goblin-overmind-poc');

const app = express();
const LITEBRAIN_URL = process.env.LITEBRAIN_URL || 'http://localhost:8001/process';

app.get('/question', async (req, res) => {
  const requestId = randomUUID();
  const goblinId = 'glitch-whisperer-poc';
  const input = req.query.input || 'hello';

  tracer.startActiveSpan('request.overmind.question', async span => {
    try {
      span.setAttribute('request.id', requestId);
      span.setAttribute('goblin.id', goblinId);

      // Call LiteBrain, inject trace context
      const headers = {};
      otel.propagation.inject(otel.context.active(), headers);

      const response = await fetch(`${LITEBRAIN_URL}?input=${encodeURIComponent(input)}`, { headers });
      const body = await response.json();

      // Emit a signed audit event for the decision using centralized audit client
      const envelope = {
        event_id: randomUUID(),
        occurred_at: new Date().toISOString(),
        actor: goblinId,
        action: 'created_ticket_from_anomaly',
        resource: { type: 'ticket', id: 'TBD' },
        context: { note: 'PoC audit event', trace_id: span.spanContext().traceId }
      };
      // pass debug option if environment requests it
      const evt = await sendSignedAudit(envelope, { debug: process.env.DEBUG_AUDIT_BYTES === '1' });

      res.json({ requestId, result: body, audit_event: { event_id: evt.event_id, signature: evt.signature } });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    } finally {
      span.end();
    }
  });
});

// Simple health/debug endpoint
app.get('/_health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Overmind PoC listening on http://localhost:${PORT}`));
