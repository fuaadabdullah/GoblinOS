# @goblinos/tool-selector

Automatic tool selection mechanism for GoblinOS goblins based on natural language task intents.

## Overview

The Tool Selector enables goblins to automatically select and execute the correct tools from their toolbelt based on natural language task descriptions. Each goblin has:

- **Owned tools** — Access-controlled list of toolbelt commands they can invoke
- **Selection rules** — Trigger patterns that map task intents to specific tools

## Architecture

### Configuration Loading
- Reads `goblins.yaml` from the GoblinOS root
- Builds in-memory index of goblins, tools, and selection rules
- Supports fast lookups for intent matching

### Intent Matching
1. Normalizes input text (lowercase, remove punctuation)
2. First pass: Exact substring matching against triggers
3. Second pass: Fuzzy matching with Jaccard similarity (>60% threshold)

### Access Control
- Validates tool ownership before returning commands
- Throws `Permission denied` errors for unauthorized tool access

## API Reference

### Core Methods

#### `autoSelectToolCommand(goblinId, intent)`
Main entry point for tool selection.

```typescript
const result = selector.autoSelectToolCommand('dregg-embercode', 'build production bundle');
/*
Returns:
{
  tool: 'forge-lite-build',
  command: 'cd ../apps/forge-lite && pnpm build',
  reason: 'Selected forge-lite-build based on task intent'
}
*/
```

#### `selectTool(goblinId, intent)`
Returns the best matching tool ID or null.

#### `getToolCommand(goblinId, toolId)`
Retrieves the command string for a tool from the guild toolbelt.

#### `canInvokeTool(goblinId, toolId)`
Checks if a goblin owns and can invoke a specific tool.

### Utility Methods

#### `getOwnedTools(goblinId)`
Returns array of tool IDs owned by the goblin.

#### `getToolOwners(toolId)`
Returns array of goblin IDs that own a specific tool.

#### `selectTools(goblinId, intent)`
Returns multiple tools when intent contains multiple actions.

## Usage Examples

### Basic Tool Selection
```typescript
import { getToolSelector } from '@goblinos/tool-selector';

const selector = getToolSelector();

// Forge Master building production
const result = selector.autoSelectToolCommand('dregg-embercode', 'build production bundle');
console.log(result.command); // 'cd ../apps/forge-lite && pnpm build'
```

### Multi-Tool Selection
```typescript
// Vermin Huntress analyzing and triaging
const results = selector.autoSelectToolChain('magnolia-nightbloom', 'analyze tests and triage regression');
console.log(results.tools); // ['huntress-guild-analyze-tests', 'huntress-guild-triage-regression']
```

### Access Control
```typescript
// Check permissions
const canBuild = selector.canInvokeTool('vanta-lumin', 'forge-lite-build');
console.log(canBuild); // false (only dregg-embercode owns this)

// Get all owners
const owners = selector.getToolOwners('mages-guild-quality-lint');
console.log(owners); // ['launcey-gauge']
```

## Error Handling

- **Invalid goblin ID**: `Error: Goblin {id} not found`
- **Permission denied**: `Error: Goblin {id} does not own tool {toolId}`
- **Tool not found**: Returns `{ tool: toolId, command: null, reason: "Tool not found in guild toolbelt" }`
- **No match**: Returns `{ tool: null, command: null, reason: "No tool found for task..." }`

## Selection Rules Format

Each goblin's `tools.selection_rules` contains:

```yaml
selection_rules:
  - trigger: "build production bundle"
    tool: forge-lite-build
  - trigger: "run tests"
    tool: forge-lite-test
    note: "Use when running the full test suite"
```

## Building & Testing

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Type check
pnpm check

# Run from GoblinOS root
cd ../..
node packages/tool-selector/dist/index.js
```

## Integration

The Tool Selector integrates with:
- **Goblin Runtime**: For executing selected tool commands
- **Goblin CLI**: For dispatching tools via command line
- **Goblin Loader**: For runtime tool discovery and execution

## Demo

There's a quick demo script that demonstrates the tool selector decisions for several goblins. Run it from the GoblinOS root:

```bash
cd GoblinOS
node packages/tool-selector/examples/tool-selection-demo.js
```

This executes sample requests for multiple goblins and prints the selected tool and command (or a brain-only fallback).
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
