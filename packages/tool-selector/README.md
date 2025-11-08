# Tool Selector

Automatic tool selection mechanism for GoblinOS goblins.

## Overview

Each goblin in GoblinOS now has:
- **Owned tools** — List of toolbelt commands they can invoke
- **Selection rules** — Trigger patterns that map task intents to specific tools

## How It Works

When a goblin receives a task, the tool selector:
1. Parses the task intent (e.g., "run tests", "start API server")
2. Matches against the goblin's selection rules
3. Returns the appropriate tool command to execute
4. Falls back to brain-only processing if no tool matches

## Usage

### Install dependencies
```bash
cd GoblinOS/packages/tool-selector
pnpm install
pnpm build
```

### Use in code
```typescript
import { getToolSelector } from '@goblinos/tool-selector';

const selector = getToolSelector();

// Auto-select tool for a task
const result = selector.autoSelectToolCommand('magnolia-nightbloom', 'run tests');
console.log(result.tool);    // 'forge-lite-test'
console.log(result.command); // 'cd apps/forge-lite && pnpm test && cd api && pytest'

// Check tool ownership
const canInvoke = selector.canInvokeTool('dregg-embercode', 'forge-lite-build');
console.log(canInvoke); // true

// Get all owners of a tool
const owners = selector.getToolOwners('forge-lite-lint');
console.log(owners); // ['launcey-gauge']
```

### Run the demo
```bash
cd GoblinOS
node examples/tool-selection-demo.js
```

## Selection Rules Format

In `goblins.yaml`:
```yaml
tools:
  owned: [forge-lite-test]
  selection_rules:
    - trigger: "run tests"
      tool: forge-lite-test
    - trigger: "identify flaky tests"
      tool: forge-lite-test
```

## API Reference

### `ToolSelector`

#### `selectTool(goblinId: string, taskIntent: string): string | null`
Returns tool ID that matches the task intent.

#### `getToolCommand(goblinId: string, toolId: string): string | null`
Returns the shell command for a specific tool.

#### `autoSelectToolCommand(goblinId, taskIntent)`
One-shot: selects tool and returns command + metadata.

#### `canInvokeTool(goblinId: string, toolId: string): boolean`
Checks if a goblin owns a specific tool.

#### `getToolOwners(toolId: string): string[]`
Returns list of goblin IDs that own the tool.

## Examples

See `examples/tool-selection-demo.js` for full working examples of:
- Forge Master building production bundles
- Glyph Scribe starting dev servers
- Vermin Huntress running tests
- Fine Spellchecker linting code
- Socketwright starting APIs
- Omenfinder analyzing logs (brain-only)

## Integration with Brains

When no tool matches, the goblin falls back to their allocated brain:
- **ollama/ollama-coder** for local inference
- **deepseek-r1/openai/gemini** for complex reasoning
- **nomic-embed-text** for RAG operations

Tool selector is transparent — goblins always try tool-first, brain-second.
