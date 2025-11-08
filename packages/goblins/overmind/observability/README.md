# OpenTelemetry Observability

Distributed tracing for Overmind using OpenTelemetry.

## Features

- **Automatic instrumentation** for HTTP requests, Express routes
- **Manual instrumentation** for custom spans (routing, LLM calls, memory operations)
- **OTLP export** to Jaeger, Zipkin, or any OTLP-compatible backend
- **Cross-service tracing** with trace context propagation

## Setup

### TypeScript (Node.js Bridge)

```bash
cd observability
pnpm install
```

In your `bridge/server.ts`:

```typescript
import { initTracing, trace, SpanStatusCode } from '../observability/tracing.js';

// Initialize tracing (do this FIRST, before creating Express app)
initTracing('overmind-bridge', '1.0.0');

// Get tracer for manual spans
const tracer = trace.getTracer('overmind-routing');

// Create custom span
app.post('/chat', async (req, res) => {
  const span = tracer.startSpan('routing_decision');

  try {
    span.setAttribute('message.length', req.body.message.length);

    // Routing logic
    const provider = 'gemini';
    span.setAttribute('routing.provider', provider);

    // ... rest of logic

    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
});
```

### Python (FastAPI)

Install dependencies:

```bash
pip install -r requirements-otel.txt
```

In your `api/app/main.py`:

```python
from observability.tracing import init_tracing, get_tracer

app = FastAPI()

# Initialize tracing
init_tracing(app, "overmind-api", "1.0.0")

# Get tracer for manual spans
tracer = get_tracer(__name__)

@app.post("/api/v1/chat")
async def chat(request: dict):
    with tracer.start_as_current_span("proxy_to_bridge") as span:
        span.set_attribute("bridge.url", "http://localhost:3030/chat")

        # Make request to bridge
        response = await http_client.post(...)

        span.set_attribute("response.status", response.status_code)
```

## Running with Jaeger

Use Docker Compose to run Jaeger for local development:

```yaml
# docker-compose.yml
version: '3.8'

services:
  jaeger:
    image: jaegertracing/all-in-one:1.60
    ports:
      - "16686:16686"  # Jaeger UI
      - "4318:4318"    # OTLP HTTP receiver
    environment:
      - COLLECTOR_OTLP_ENABLED=true
```

Start Jaeger:

```bash
docker-compose up -d jaeger
```

Access Jaeger UI: http://localhost:16686

## Environment Variables

Configure OTLP endpoint:

```bash
# .env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

## Span Attributes

Recommended attributes for Overmind spans:

**Routing spans:**
- `routing.strategy`: cost-optimized | performance | balanced
- `routing.provider`: openai | gemini | deepseek
- `routing.reason`: explanation of routing decision
- `message.length`: character count of user message
- `message.complexity`: simple | moderate | complex

**LLM call spans:**
- `llm.provider`: provider name
- `llm.model`: model identifier
- `llm.tokens`: total tokens used
- `llm.cost`: cost in USD
- `llm.latency`: response time in ms
- `llm.response.length`: character count of response

**Memory operation spans:**
- `memory.operation`: add | get | search | consolidate
- `memory.type`: short-term | working | long-term
- `memory.count`: number of items processed
- `memory.duration`: operation duration

## Viewing Traces

1. Start all services (FastAPI, Node bridge)
2. Make requests through the API
3. Open Jaeger UI: http://localhost:16686
4. Select service: `overmind-api` or `overmind-bridge`
5. View traces showing full request path:
   - HTTP request to FastAPI
   - Proxy call to Node bridge
   - Routing decision
   - LLM API call
   - Memory operations

## Production Deployment

For production, export traces to:
- **Jaeger**: Self-hosted or Jaeger Cloud
- **Zipkin**: Open-source distributed tracing
- **Datadog**: Commercial APM
- **New Relic**: Commercial APM
- **Honeycomb**: Observability platform

Update `OTEL_EXPORTER_OTLP_ENDPOINT` to point to your collector.

## Sampling

Control trace sampling in production:

```typescript
// TypeScript
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';

const sdk = new NodeSDK({
  sampler: new TraceIdRatioBasedSampler(0.1), // Sample 10% of traces
  // ... rest of config
});
```

```python
# Python
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased

provider = TracerProvider(
    resource=resource,
    sampler=TraceIdRatioBased(0.1),  # Sample 10% of traces
)
```

## Troubleshooting

**Traces not appearing in Jaeger:**
1. Check OTLP endpoint is reachable: `curl http://localhost:4318/v1/traces`
2. Verify environment variable: `echo $OTEL_EXPORTER_OTLP_ENDPOINT`
3. Check service logs for OpenTelemetry initialization messages
4. Ensure Jaeger collector is configured with OTLP receiver

**High overhead:**
- Use sampling in production (10-20% sample rate)
- Use batch span processor (default)
- Avoid creating too many custom spans (1-5 per request is typical)

## References

- [OpenTelemetry Docs](https://opentelemetry.io/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/)
