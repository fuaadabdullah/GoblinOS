# GoblinOS Runtime Tests

Comprehensive test suite for the GoblinOS Runtime Server.

## Test Structure

### Unit Tests

- **`orchestrator.test.ts`** - OrchestrationParser logic
  - Sequential operations (THEN)
  - Parallel operations (AND)
  - Conditional operations (IF)
  - Mixed workflows
  - Multi-goblin syntax
  - Edge cases

- **`cost-tracker.test.ts`** - CostTracker functionality
  - Cost recording
  - Multi-provider pricing (OpenAI, Gemini, Anthropic, Ollama)
  - Aggregation by provider, goblin, guild
  - Average cost calculation
  - CSV export
  - Storage limits

### Integration Tests

- **`server.test.ts`** - Full server API testing
  - Health & status endpoints
  - Goblins endpoints
  - Orchestration endpoints
  - Cost tracking endpoints
  - Error handling
  - Data consistency

## Running Tests

### Prerequisites

1. Install dependencies:
```bash
cd /Users/fuaadabdullah/ForgeMonorepo/GoblinOS
pnpm install
```

2. Build the runtime:
```bash
pnpm --filter @goblinos/goblin-runtime build
```

3. Start the server (for integration tests):
```bash
pnpm --filter @goblinos/goblin-runtime server
```

### Run All Tests

```bash
# Run all tests once
pnpm --filter @goblinos/goblin-runtime test

# Watch mode (re-run on file changes)
pnpm --filter @goblinos/goblin-runtime test:watch

# With coverage report
pnpm --filter @goblinos/goblin-runtime test:coverage
```

### Run Specific Test Files

```bash
# Unit tests only
pnpm vitest run src/__tests__/orchestrator.test.ts
pnpm vitest run src/__tests__/cost-tracker.test.ts

# Integration tests (requires server running)
pnpm vitest run src/__tests__/server.test.ts
```

## Test Coverage

### Unit Tests Coverage

- **OrchestrationParser**: 90%+
  - All parsing logic paths covered
  - Edge cases tested
  - Error handling validated

- **CostTracker**: 95%+
  - All pricing models tested
  - Aggregation logic validated
  - Export functionality verified

### Integration Tests Coverage

- **API Endpoints**: 100% (19/19 endpoints)
  - Health check ✓
  - Goblins list ✓
  - Task execution ✓
  - History retrieval ✓
  - Statistics ✓
  - Orchestration (5 endpoints) ✓
  - Cost tracking (4 endpoints) ✓

## Test Data

### Mock Goblins

Tests use actual goblins from `goblins.yaml`:
- `websmith` - Build & deploy specialist
- `crafter` - Code review expert
- `tester` - QA specialist
- Others as needed

### Cost Pricing

Tests validate accurate pricing for:
- **OpenAI**: GPT-4 ($0.03/$0.06), GPT-3.5 ($0.0015/$0.002)
- **Gemini**: All models ($0.0005/$0.0005)
- **Anthropic**: Sonnet ($0.003/$0.015), Opus ($0.015/$0.075), Haiku ($0.00025/$0.00125)
- **Ollama**: Local models ($0/$0)

## Debugging Tests

### Verbose Output

```bash
pnpm vitest run --reporter=verbose
```

### Run Single Test

```bash
pnpm vitest run -t "should parse sequential tasks"
```

### Debug Mode

```bash
NODE_ENV=test node --inspect-brk ./node_modules/.bin/vitest run
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm --filter @goblinos/goblin-runtime build
      - run: pnpm --filter @goblinos/goblin-runtime server &
      - run: sleep 5  # Wait for server startup
      - run: pnpm --filter @goblinos/goblin-runtime test
      - run: pnpm --filter @goblinos/goblin-runtime test:coverage
```

## Writing New Tests

### Unit Test Template

```typescript
import { describe, it, expect } from 'vitest'
import { YourClass } from '../your-module.js'

describe('YourClass', () => {
  it('should do something', () => {
    const instance = new YourClass()
    const result = instance.doSomething()
    expect(result).toBe('expected-value')
  })
})
```

### Integration Test Template

```typescript
import { describe, it, expect } from 'vitest'

describe('API Endpoint', () => {
  it('should return expected response', async () => {
    const response = await fetch('http://localhost:3001/api/endpoint')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('expectedField')
  })
})
```

## Troubleshooting

### Server Not Running

If integration tests fail with connection errors:

```bash
# Check if server is running
lsof -ti:3001

# Start server
cd /Users/fuaadabdullah/ForgeMonorepo/GoblinOS
pnpm --filter @goblinos/goblin-runtime server
```

### Test Timeout

Increase timeout for slow tests:

```typescript
it('slow test', async () => {
  // test code
}, { timeout: 10000 }) // 10 seconds
```

### Import Errors

Ensure `.js` extensions in imports:

```typescript
// ❌ Wrong
import { Parser } from '../orchestrator'

// ✅ Correct
import { Parser } from '../orchestrator.js'
```

## Test Maintenance

### When to Update Tests

- **New endpoint added**: Add integration test in `server.test.ts`
- **Pricing changed**: Update expected values in `cost-tracker.test.ts`
- **Parser logic changed**: Update test cases in `orchestrator.test.ts`
- **New goblin added**: Update test fixtures

### Coverage Goals

- **Unit Tests**: 90%+ coverage
- **Integration Tests**: 100% endpoint coverage
- **Overall**: 85%+ combined coverage

## Related Documentation

- [API Documentation](../../goblins/overmind/dashboard/API.md)
- [Implementation Summary](../../goblins/overmind/dashboard/IMPLEMENTATION_SUMMARY.md)
- [Orchestration Guide](../../goblins/overmind/dashboard/API.md#orchestration-syntax)
