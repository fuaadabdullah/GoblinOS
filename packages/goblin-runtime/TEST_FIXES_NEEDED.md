# Test Suite Fixes Required

## Summary

Tests are now running (47/60 tests failing). The failures are due to API mismatches between test files and actual implementation. Here are the fixes needed:

## 1. CostTracker API Mismatch

**Problem**: Tests call `tracker.recordTask()` but actual method is `tracker.record()`

**Files Affected**:
- `cost-tracker.test.ts` (all 20 tests)

**Fix Required**:
```typescript
// WRONG (in tests):
tracker.recordTask({ ... })

// CORRECT:
tracker.record({ ... })
```

**Additional Fix**: `getSummary()` returns different structure:
- Test expects: `avgCostPerTask` property
- Actual API: May not include this property or named differently

## 2. OrchestrationParser API Mismatch

**Problem**: Tests call `parser.parse()` on instance, but it's a static method

**Files Affected**:
- `orchestrator.test.ts` (22 tests)

**Fix Required**:
```typescript
// WRONG (in tests):
const parser = new OrchestrationParser()
const result = parser.parse('build THEN test', 'websmith')

// CORRECT:
const result = OrchestrationParser.parse('build THEN test', 'websmith')
```

## 3. Server API Mismatches

**Files Affected**:
- `server.test.ts` (7 integration tests)

### 3.1 Goblin Structure

**Problem**: Expected property `name`, actual structure may differ

**Test Line 91**:
```typescript
// Failing:
expect(goblin).toHaveProperty('name')

// Fix: Check actual goblin structure from goblins.yaml
// Likely should be checking for 'title' or another property
```

### 3.2 Conditional Steps

**Problem**: Expected `condition` property on step, actual structure differs

**Test Line 134**:
```typescript
// Failing:
expect(conditionalStep).toHaveProperty('condition')

// Fix: Check OrchestrationStep interface for actual condition structure
```

### 3.3 Cost Summary Response

**Problem**: Response missing `avgCostPerTask` property

**Test Line 184**:
```typescript
// Failing:
expect(data).toHaveProperty('avgCostPerTask')

// Fix: Check CostSummary interface for actual property names
```

### 3.4 Cost Breakdown Responses

**Problem**: Goblin/Guild breakdown responses have different structure

**Test Lines 197, 207**:
```typescript
// Failing for goblin:
expect(data).toHaveProperty('totalCost')

// Failing for guild:
expect(data).toHaveProperty('guild', 'forge-guild')

// Fix: Check actual API response structure from server.ts
```

### 3.5 CSV Export Headers

**Problem**: CSV headers don't match expected format

**Test Line 220**:
```typescript
// Expected: 'id,goblinId,guild,provider,model'
// Actual: 'ID,Timestamp,Goblin,Guild,Provider,Model,Task,Input Tokens,...'

// Fix: Update test to match actual CSV format
```

### 3.6 Invalid Syntax Handling

**Problem**: Empty orchestration text returns 200 instead of 400

**Test Line 236**:
```typescript
// Currently: Empty text is accepted (returns 200)
// Expected: Should return 400 for invalid/empty syntax

// Fix: Update server.ts to validate orchestration text is not empty
```

## Quick Fix Steps

### Step 1: Fix cost-tracker.test.ts

Replace all instances of:
- `tracker.recordTask(` → `tracker.record(`

Check CostSummary interface and update assertions for `avgCostPerTask`.

### Step 2: Fix orchestrator.test.ts

Replace:
```typescript
// Remove:
const parser = new OrchestrationParser()

// Change all:
parser.parse(...) → OrchestrationParser.parse(...)
```

### Step 3: Fix server.test.ts

1. Check actual Goblin interface structure
2. Check OrchestrationStep condition structure
3. Check CostSummary response structure
4. Update CSV header expectations
5. Add validation in server.ts for empty orchestration text

## Test Execution After Fixes

```bash
# Run tests with TMPDIR override
TMPDIR=/tmp pnpm --filter @goblinos/goblin-runtime test

# Or add to package.json script:
"test": "TMPDIR=/tmp vitest run"
```

## Current Test Results

- **Total Tests**: 60
- **Passing**: 13 (22%)
- **Failing**: 47 (78%)

### Passing Tests

- Health endpoint ✓
- Sequential orchestration parsing ✓
- Parallel orchestration parsing ✓
- Mixed orchestration parsing ✓
- Multi-goblin syntax ✓
- Invalid syntax handling (partial) ✓
- Empty text handling ✓
- Invalid operator handling ✓
- 404 errors ✓
- Plan retrieval ✓
- Data consistency (2 tests) ✓

### Failing Test Categories

- CostTracker API calls (20 tests) - Wrong method name
- OrchestrationParser API (22 tests) - Static method not instance
- Server API structure (7 tests) - Response structure mismatches

## Recommended Approach

### Option 1: Fix Tests to Match Implementation (Recommended)

1. Read actual implementation APIs
2. Update test files to match
3. Run tests again
4. Should see ~85-90% pass rate

### Option 2: Add Wrapper Methods

Add instance methods that call static methods:
```typescript
// In OrchestrationParser class:
parse(text: string, defaultGoblinId?: string) {
  return OrchestrationParser.parse(text, defaultGoblinId)
}
```

Add alias for CostTracker:
```typescript
// In CostTracker class:
recordTask(entry: ...) {
  return this.record(entry)
}
```

This maintains backward compatibility but adds redundant code.

## Next Actions

1. **Read Implementation Files**:
   - `src/orchestrator.ts` - Check OrchestrationStep interface
   - `src/cost-tracker.ts` - Check CostSummary interface
   - `src/server.ts` - Check actual API responses

2. **Update Test Files** with correct API calls

3. **Re-run Tests**: `TMPDIR=/tmp pnpm --filter @goblinos/goblin-runtime test`

4. **Target**: 90%+ pass rate (54/60 tests passing)

## Files to Update

1. `/packages/goblin-runtime/src/__tests__/cost-tracker.test.ts`
2. `/packages/goblin-runtime/src/__tests__/orchestrator.test.ts`
3. `/packages/goblin-runtime/src/__tests__/server.test.ts`
4. `/packages/goblin-runtime/src/server.ts` (add empty text validation)
