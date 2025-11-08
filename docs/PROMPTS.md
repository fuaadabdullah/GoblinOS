# Goblin Prompt Templates

Each goblin can carry a basic prompt template to tailor its behavior. The system uses prompts from `goblins.yaml` when available and derives sensible defaults otherwise.

## Where Prompts Live

- Optional per-member field in `goblins.yaml`:

```yaml
members:
  - id: vanta-lumin
    title: Glyph Scribe
    litebrain:
      local: [ollama]
      routers: [deepseek-r1]
    prompt:
      system: |
        You are the Glyph Scribe, specializing in UI systems and accessibility.
        Prioritize CLS/LCP budgets and produce minimal, accessible code.
      style:
        - Be concise and explicit
        - Use keyboard-accessible patterns
        - Avoid visual regressions
```

If `prompt` is omitted, a default is built from responsibilities and KPIs.

### Few-shot Examples

You can also add examples to reinforce format or tone:

```yaml
prompt:
  system: |
    You are the Fine Spellchecker...
  style:
    - Keep responses terse
  examples:
    - user: "Run lint on project and summarize violations"
      assistant: "Running lint...\n- 3 errors in api/\n- 1 error in web/\nFix: pnpm biome:fix"
```

## How It’s Used

- The prompt is passed as the system message for the goblin’s LiteBrain.
- Extra `style` items are appended to the request prompt as guidelines.

## Code Paths

- Schema: `packages/goblins/registry/src/types.ts` (`prompt` field)
- Config derivation: `packages/goblins/brains/src/registry.ts` (default prompt builder)
- Provider usage: `packages/goblins/brains/src/base.ts` (systemPrompt + styleGuidelines + examples)

## Guild-Level Verbosity

Guilds can set `verbosity: terse|normal|verbose` to influence LiteBrain output:

```yaml
guilds:
  - name: Mages
    verbosity: verbose
```

Effects:
- terse → lower max tokens and “be brief” guideline
- normal → defaults
- verbose → higher max tokens and “be thorough” guideline


## Tip

Prompts should be short, role-aligned, and focused on measurable outputs (KPIs). Avoid over-constraining models; keep them directional.
