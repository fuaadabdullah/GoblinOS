---
title: Universal LLM Provider Module
type: reference
project: GoblinOS
status: published
owner: GoblinOS
goblin_name: Universal Provider
---

# @goblinos/providers

Universal LLM provider abstraction with LiteLLM gateway support, intelligent fallbacks, and comprehensive observability.

## Features

- ✅ **Single SDK**: OpenAI-compatible API for all models (OpenAI, Gemini, DeepSeek, Ollama)
- ✅ **Smart Fallbacks**: Automatic fallback chains (cloud → local)
- ✅ **OpenTelemetry**: Built-in distributed tracing
- ✅ **Cost Tracking**: Automatic cost calculation per request
- ✅ **Type Safety**: Full TypeScript support with Zod validation
- ✅ **Zero Config**: Works out of the box with environment variables

## Installation

```bash
cd GoblinOS
pnpm add @goblinos/providers
```

## Quick Start

### Basic Usage

```typescript
import { createProvider } from '@goblinos/providers';

// Create client (reads from environment variables)
const client = createProvider();

// Send a chat message
const response = await client.chat({
  messages: [
    { role: 'user', content: 'What is the meaning of life?' }
  ]
});

console.log(response.content);
console.log(`Cost: $${response.usage.totalTokens * 0.00001}`);
```

### Custom Configuration

```typescript
import { createProvider } from '@goblinos/providers';

const client = createProvider({
  baseURL: 'http://litellm:4000',
  defaultModel: 'gpt-4-turbo',
  fallbackModels: ['gemini-pro', 'deepseek-chat', 'ollama-local'],
  maxRetries: 3,
  timeout: 60000,
  telemetry: true,
  trackCost: true,
});

const response = await client.chat({
  messages: [{ role: 'user', content: 'Hello!' }],
  temperature: 0.7,
  maxTokens: 1000,
});
```

### With Tools (Function Calling)

```typescript
const response = await client.chat({
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' }
  ],
  tools: [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' },
            unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
          },
          required: ['location'],
        },
      },
    },
  ],
});

if (response.toolCalls) {
  for (const toolCall of response.toolCalls) {
    console.log(`Calling ${toolCall.function.name}:`, toolCall.function.arguments);
  }
}
```

## Environment Variables

Set these in your `.env` file:

```bash
# Direct Ollama (preferred for local inference)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=llama3.2

# Or, LiteLLM Gateway URL (used when OLLAMA_BASE_URL is not set)
LITELLM_BASE_URL=http://litellm:4000

# API Key (can be "dummy" for LiteLLM)
LITELLM_API_KEY=dummy

# Default model for gateway mode
DEFAULT_MODEL=gpt-4-turbo

# Fallback models (comma-separated)
FALLBACK_MODELS=gemini-pro,deepseek-chat,ollama-local

# Telemetry
TELEMETRY_ENABLED=true
TRACK_COST=true
```

When `OLLAMA_BASE_URL` is set, the provider automatically targets the
OpenAI-compatible endpoint at `${OLLAMA_BASE_URL}/v1` and uses
`OLLAMA_DEFAULT_MODEL` as the default model.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseURL` | string | `http://litellm:4000` | LiteLLM gateway URL |
| `apiKey` | string | `dummy` | API key (dummy for LiteLLM) |
| `defaultModel` | string | `gpt-4-turbo` | Default model to use |
| `fallbackModels` | string[] | `['gemini-pro', 'ollama-local']` | Fallback chain |
| `maxRetries` | number | `3` | Max retries per model |
| `timeout` | number | `60000` | Request timeout (ms) |
| `telemetry` | boolean | `true` | Enable OpenTelemetry |
| `trackCost` | boolean | `true` | Track request costs |
| `maxTokens` | number | `undefined` | Max tokens per request |
| `temperature` | number | `0.7` | Sampling temperature |

## Model Metadata

Built-in cost and latency estimates (as of Oct 2025):

| Model | Provider | Input Cost | Output Cost | Avg Latency |
|-------|----------|------------|-------------|-------------|
| `gpt-4-turbo` | OpenAI | $0.01/1K | $0.03/1K | 2000ms |
| `gemini-pro` | Gemini | $0.0035/1K | $0.0105/1K | 1500ms |
| `deepseek-chat` | DeepSeek | $0.0014/1K | $0.0028/1K | 1200ms |
| `ollama-local` | Ollama | Free | Free | 500ms |

## Observability

### OpenTelemetry Spans

Every request creates spans with attributes:

- `llm.provider`: Provider name (openai, gemini, deepseek, ollama)
- `llm.model`: Model identifier
- `llm.latency`: Response time in milliseconds
- `llm.tokens.input`: Prompt tokens
- `llm.tokens.output`: Completion tokens
- `llm.tokens.total`: Total tokens
- `llm.cost`: Estimated cost in USD
- `llm.success`: Whether request succeeded

### Fallback Tracking

When fallbacks occur:

- `llm.fallback.attempts`: Number of attempts
- `llm.fallback.chain`: Model chain (e.g., "gpt-4-turbo -> gemini-pro")
- `llm.fallback.success_model`: Model that succeeded

### Example Trace

```
llm.chat (2.3s)
  ├─ llm.provider: "litellm"
  ├─ llm.model: "gpt-4-turbo"
  ├─ llm.fallback.attempts: 2
  ├─ llm.fallback.chain: "gpt-4-turbo -> gemini-pro"
  ├─ llm.fallback.success_model: "gemini-pro"
  ├─ llm.tokens.input: 45
  ├─ llm.tokens.output: 123
  ├─ llm.cost: 0.0018
  └─ llm.success: true
```

## Integration with Overmind

Update Overmind bridge to use the universal provider:

```typescript
// overmind/bridge/src/llm.ts
import { createProvider } from '@goblinos/providers';

const provider = createProvider({
  baseURL: process.env.LITELLM_BASE_URL || 'http://litellm:4000',
  fallbackModels: ['gemini-pro', 'deepseek-chat', 'ollama-local'],
});

export async function routeMessage(message: string) {
  const response = await provider.chat({
    messages: [
      { role: 'system', content: 'You are Overmind, the Chief Goblin.' },
      { role: 'user', content: message }
    ],
    temperature: 0.7,
  });

  return {
    content: response.content,
    model: response.model,
    cost: calculateCost(response.usage),
  };
}
```

## Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Lint
pnpm lint

# Fix lint issues
pnpm lint:fix
```

## Error Handling

The client automatically handles errors and falls back to alternative models:

```typescript
try {
  const response = await client.chat({
    messages: [{ role: 'user', content: 'Hello!' }]
  });
} catch (error) {
  // Only thrown if ALL models in the fallback chain fail
  console.error('All models failed:', error.message);
}
```

## Advanced Usage

### Get Fallback Attempt History

```typescript
const client = createProvider();
const response = await client.chat({
  messages: [{ role: 'user', content: 'Hello!' }]
});

// Access fallback history (if using FallbackHandler directly)
// Note: This is internal, exposed for debugging
```

### Direct OpenAI Client Access

```typescript
const client = createProvider();
const openai = client.getClient();

// Use OpenAI SDK directly for advanced features
const stream = await openai.chat.completions.create({
  model: 'gpt-4-turbo',
  messages: [{ role: 'user', content: 'Hello!' }],
  stream: true,
});

for await (const chunk of stream) {
  console.log(chunk.choices[0]?.delta?.content || '');
}
```

## References

- [LiteLLM Documentation](https://docs.litellm.ai)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [OpenTelemetry JS](https://opentelemetry.io/docs/languages/js/)

## Contributing

This package is maintained by GoblinOS. For issues or improvements:

1. Check existing issues
2. Submit a PR with tests
3. Update documentation

## License

MIT
