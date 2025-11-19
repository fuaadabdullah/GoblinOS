# Testing Guide

This document describes the testing infrastructure and best practices for GoblinOS.

## Overview

GoblinOS uses [Vitest](https://vitest.dev/) as its test runner with comprehensive support for:

- Unit tests for individual functions and modules
- Integration tests for API endpoints and service interactions
- React component tests with DOM simulation
- End-to-end tests for complete workflows

## Test Configuration

### Root Configuration (`vitest.config.ts`)

The root test configuration is located at `vitest.config.ts` and includes:

```typescript
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./packages/goblins/overmind/dashboard/src/test/setup.ts']
  }
})
```

**Key Features:**
**Key Features:**

- **Default environment**: Node.js for server-side testing
- **Setup files**: Jest-DOM matchers for React component assertions
- **Coverage**: V8 coverage with 90% threshold enforcement

### Component Testing Setup

React components are tested using jsdom environment:

```typescript
// In test files
/**
 * @vitest-environment jsdom
 */
```

**Setup file** (`packages/goblins/overmind/dashboard/src/test/setup.ts`):

```typescript
// Conditional browser API mocking
if (typeof window !== 'undefined') {
  // Tauri, DOM APIs, etc.
}
```

## Test Categories

### Unit Tests

Located throughout the codebase with `.test.ts` or `.spec.ts` extensions.

**Example:**

```typescript
import { describe, it, expect } from 'vitest'

describe('MyModule', () => {
  it('should do something', () => {
    expect(myFunction()).toBe(expectedValue)
  })
})
```

### Integration Tests

Test API endpoints and service interactions:

**Server Availability Checks:**

```typescript
describe('API Integration', () => {
  let serverAvailable = false

  beforeAll(async () => {
    try {
      await fetch('http://localhost:3000/health')
      serverAvailable = true
    } catch {
      serverAvailable = false
    }
  })

  it('should work when server is available', async () => {
    const testFn = serverAvailable ? it : it.skip
    testFn('makes API call', async () => {
      // Test implementation
    })
  })
})
```

### Component Tests

React components tested with `@testing-library/react`:

```typescript
/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

it('renders component correctly', () => {
  render(<MyComponent />)
  expect(screen.getByText('Hello')).toBeInTheDocument()
})
```

## Running Tests

### Commands

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test my-test.test.ts
```

### CI/CD Integration

Tests run automatically on:

- **Pull Requests**: Type check, lint, test with coverage, build
- **Main branch**: All PR checks plus security scans

## Best Practices

### Test Organization

- **File naming**: `*.test.ts` or `*.spec.ts`
- **Directory structure**: Tests colocated with source files
- **Describe blocks**: Group related tests logically

### Environment Handling

- **Conditional mocking**: Only mock browser APIs when `window` exists
- **Server checks**: Skip integration tests when services unavailable
- **Process safety**: Prevent `process.exit()` in test environments

### Assertions

- Use **jest-dom matchers** for DOM assertions
- Prefer **semantic queries** (`getByRole`, `getByLabelText`)
- Test **user interactions** over implementation details

### Coverage

- **90% coverage** enforced across the codebase
- Focus on **meaningful coverage** over artificial metrics
- Use coverage reports to identify **untested code paths**

## Troubleshooting

### Common Issues

#### "document is not defined"

- Add `@vitest-environment jsdom` to component tests
- Ensure setup file has conditional mocking

#### Tests failing due to process.exit()

- Check bridge API initialization for NODE_ENV guards
- Use test-specific entry points if needed

#### Integration tests always skipping

- Verify server is running on expected port
- Check network connectivity in test environment

### Debug Mode

Run tests with detailed output:

```bash
# Verbose output
pnpm test --reporter=verbose

# Debug specific test
pnpm test --inspect-brk my-test.test.ts
```

## Contributing

When adding new tests:

1. **Follow existing patterns** for consistency
2. **Test both success and failure cases**
3. **Include integration tests** for API changes
4. **Update this documentation** for significant changes

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)
