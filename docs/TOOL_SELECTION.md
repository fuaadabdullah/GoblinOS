# Tool Selection System — Summary

All goblins in GoblinOS now automatically select and invoke tools based on task intent.

## What Was Built

### 1. **Tool Ownership & Selection Rules** (`goblins.yaml`)
Every goblin now has:
```yaml
tools:
  owned: [tool-id-1, tool-id-2]
  selection_rules:
    - trigger: "task description"
      tool: tool-id-1
```

### 2. **Tool Selector Module** (`packages/tool-selector/`)
TypeScript module that:
- Reads `goblins.yaml` configuration
- Matches task intents to tools using trigger patterns
- Returns tool commands for execution
- Validates tool ownership and permissions

### 3. **Documentation Generator Update** (`scripts/generate-roles.js`)
Updated to include:
- Owned tools list for each goblin
- Selection rules with trigger → tool mappings
- Auto-generated in ROLES.md

### 4. **Working Demo** (`examples/tool-selection-demo.js`)
Shows real examples of all goblins selecting tools based on tasks.

## Tool Allocation Summary

| Goblin | Owned Tools | Selection Triggers |
|--------|-------------|-------------------|
| **Forge Master** | forge-lite-build | "build production bundle", "optimize build" |
| **Glyph Scribe** | portfolio-dev, portfolio-build, forge-lite-dev | "start portfolio", "build portfolio", "start UI dev" |
| **Socketwright** | forge-lite-api-dev | "start API server", "test API", "debug backend" |
| **Vermin Huntress** | forge-lite-test | "run tests", "identify flaky tests", "regression check" |
| **Omenfinder** | None | Uses brain only for log analysis |
| **Sealkeeper** | None | Uses brain + external scripts |
| **Forecasting Fiend** | None | Uses brain for predictive modeling |
| **Glitch Whisperer** | None | Uses brain for anomaly detection |
| **Fine Spellchecker** | forge-lite-lint | "run linters", "check code quality", "validate PR" |

## How It Works

```typescript
import { getToolSelector } from '@goblinos/tool-selector';

const selector = getToolSelector();

// Goblin receives task
const result = selector.autoSelectToolCommand('magnolia-nightbloom', 'run tests');

// Returns:
{
  tool: 'forge-lite-test',
  command: 'cd apps/forge-lite && pnpm test && cd api && pytest',
  reason: 'Selected forge-lite-test based on task intent'
}
```

## Files Created/Modified

- ✅ `GoblinOS/goblins.yaml` — Added tools + selection_rules to all 9 goblins
- ✅ `GoblinOS/packages/tool-selector/index.ts` — Tool selector logic
- ✅ `GoblinOS/packages/tool-selector/package.json` — Package config
- ✅ `GoblinOS/packages/tool-selector/tsconfig.json` — TypeScript config
- ✅ `GoblinOS/packages/tool-selector/README.md` — Full API docs
- ✅ `GoblinOS/examples/tool-selection-demo.js` — Working examples
- ✅ `GoblinOS/scripts/generate-roles.js` — Updated generator
- ✅ `GoblinOS/docs/ROLES.md` — Regenerated with tool info

## Next Steps (Optional)

1. **Add to CI**: Validate that all tool IDs in `owned` arrays exist in guild toolbelts
2. **Add telemetry**: Track which tools are invoked most frequently
3. **Add caching**: Cache tool selector instance for faster lookups
4. **Add fuzzy matching**: "run all tests" → "run tests" with similarity scoring
5. **Add tool chains**: "build and test" → [forge-lite-build, forge-lite-test]

## Run the Demo

```bash
cd GoblinOS
pnpm install
pnpm --filter @goblinos/tool-selector build
node examples/tool-selection-demo.js
```

All goblins now know which tools to use for any given task! 🎯
