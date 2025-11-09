from fastapi import FastAPI, Request
import os
import time
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
import requests

# Minimal OTEL configuration (console exporter) for PoC
resource = Resource.create({"service.name": "litebrain-poc"})
provider = TracerProvider(resource=resource)
provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer(__name__)

app = FastAPI()
FastAPIInstrumentor.instrument_app(app)
RequestsInstrumentor().instrument()

# Simple ModelClient wrapper that computes tokens and cost (PoC)
MODEL_PRICE_PER_1K_TOKENS = 0.002 # $0.002 per 1k tokens (fake)

def compute_tokens(prompt: str, response: str):
    # naive token estimate for PoC
    return max(1, len(prompt.split())), max(1, len(response.split()))

@app.get('/process')
async def process(input: str, request: Request):
    with tracer.start_as_current_span('litebrain.process') as span:
        span.set_attribute('request.input_length', len(input))
        # Fake model call
        start = time.time()
        # Simulate calling a remote model provider (we call a dummy endpoint)
        try:
            r = requests.get('https://httpbin.org/get')
            model_response = 'simulated model answer'
        except Exception:
            model_response = 'simulated model fail'
        latency_ms = (time.time() - start) * 1000

        tokens_in, tokens_out = compute_tokens(input, model_response)
        cost_usd = (tokens_in + tokens_out) / 1000.0 * MODEL_PRICE_PER_1K_TOKENS

        span.set_attribute('model.tokens_in', tokens_in)
        span.set_attribute('model.tokens_out', tokens_out)
        span.set_attribute('model.cost_usd', cost_usd)
        span.set_attribute('model.latency_ms', latency_ms)

        return {"input": input, "answer": model_response, "cost_usd": cost_usd}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=int(os.environ.get('PORT', 8001)))
