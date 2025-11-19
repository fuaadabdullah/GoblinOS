---
description: "README"
---

# Tool Layer

The Tool Layer is a secure API service that enables AI agents to delegate execution of worker tasks without directly running code. This creates true orchestration where agents make decisions but the system handles execution, security, and audit logging.

## Quick Start

```bash
cd GoblinOS/packages/tool-layer
pnpm install
pnpm test
pnpm build
pnpm start
```

The service runs on `http://localhost:3000`.

## API Usage

### Invoke a Tool

```bash
curl -X POST http://localhost:3000/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "caller_id": "test-agent",
    "capability_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tool_id": "monorepo_cli",
    "function_name": "run_script",
    "args": {
      "script_name": "forge:benchmark",
      "args": ["--target=core"]
    },
    "metadata": {
      "dry_run": true
    }
  }'
```

### Generate Capability Token (for testing)

```javascript
const jwt = require('jsonwebtoken');
// For testing, use a local secret: export TOOL_LAYER_JWT_SECRET=your_secret_here
const token = jwt.sign({ scopes: ['exec:scripts'] }, process.env.TOOL_LAYER_JWT_SECRET || 'dev-test-secret', { expiresIn: '1h' });
console.log(token);
```

## Available Tools

- **monorepo_cli**: Execute whitelisted scripts
- **config_manager**: Update configuration files safely
- **metrics_api**: Query performance metrics
- **github_pr**: Check PR status

## For GoblinOS Integration

Update your `goblins.yaml` to use the Tool Layer:

```yaml
guilds:
  - id: forge-lite-guild
    name: Forge Lite Guild
    charter: "Manage ForgeTM Lite development lifecycle"
    toolbelt:
      - id: forge-lite-build
        name: Forge Lite Build
        summary: "Build ForgeTM Lite app"
        owner: dregg-embercode
        tool_layer_invoke:
          tool_id: monorepo_cli
          function: run_script
          args:
            script_name: pnpm:build
            working_dir: apps/forge-lite
```

## Security Notes

- All invocations are logged with HMAC signatures
- Tokens expire after 1 hour
- Only whitelisted operations are allowed
- Dry-run mode available for testing

## Development

- `pnpm dev`: Start development server with hot reload
- `pnpm test`: Run unit tests
- `pnpm lint`: Check code style
- `pnpm typecheck`: TypeScript validation

## Architecture

The service uses:

- **Fastify**: High-performance web framework
- **AJV**: JSON Schema validation
- **better-sqlite3**: Audit logging
- **JWT**: Capability tokens
- **TypeScript**: Type safety
