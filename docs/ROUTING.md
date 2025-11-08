# Complexity-Based Routing

GoblinOS routes tasks to different models based on estimated complexity, while honoring each goblin’s `litebrain.local` and `litebrain.routers` preferences from `goblins.yaml`.

## How It Works

- A simple heuristic estimates complexity (`low` | `medium` | `high`) using task keywords and prompt length.
- For `low` complexity, GoblinOS prefers local models (e.g., Ollama) when available.
- For `high` complexity, GoblinOS prefers remote/router models (e.g., DeepSeek/OpenAI) when available.
- `medium` uses the configured default model.

### Nuanced Signals

- Token/length awareness: large prompts (by word count and rough token estimate) skew toward `high`.
- Structured overrides via request constraints (LiteBrains):

```ts
await litebrain.process({
  task: 'Do X',
  constraints: {
    routing: {
      complexity: 'high' | 'medium' | 'low',
      preference: 'local' | 'remote',
      model: 'deepseek-r1', // hard-override
    },
  },
})
```

- Guild-level policy (in goblins.yaml):

```yaml
guilds:
  - name: Mages
    routing:
      low_word_max: 60
      high_word_min: 350
      prefer_local_keywords: ["lint", "format", "rename"]
      prefer_remote_keywords: ["design", "architecture", "spec"]
```

## Code Paths

- LiteBrains (automatic within the platform):
  - `packages/goblins/brains/src/registry.ts` — derives `localCandidates` and `remoteCandidates` from YAML
- `packages/goblins/brains/src/base.ts` — selects a model per request via `pickModelForComplexity`
  - Honors `constraints.routing` overrides and `routingPolicy` from guild

- Goblin CLI (ad hoc usage):
  - `bin/goblin` — reorders the model chain for `ask` depending on complexity

## Notes

- This is a conservative heuristic; you can still override models with environment variables or per‑member config.
- For cross‑provider fallbacks (OpenAI ⇄ Gemini ⇄ DeepSeek ⇄ Ollama), use a LiteLLM gateway.
