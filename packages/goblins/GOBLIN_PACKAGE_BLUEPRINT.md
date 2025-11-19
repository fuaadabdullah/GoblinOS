# Goblin Package Blueprint

This document defines the standard structure and conventions for all GoblinOS goblin packages. Following this blueprint ensures consistency, maintainability, and clear separation of concerns across the entire GoblinOS ecosystem.

## Overview

Every goblin package is a self-contained module that implements a specific capability within GoblinOS. Each goblin follows the same architectural pattern to ensure predictability and ease of integration.

## Standard Folder Structure

```
packages/goblins/{goblin-name}/
├── src/
│   ├── index.ts           # Main "public API" for this goblin
│   ├── logic.ts           # The core internal logic (the "brain")
│   ├── schema.ts          # Defines database tables (e.g., using Drizzle, Prisma)
│   └── types.ts           # TypeScript interfaces for this goblin's API
│
├── config/
│   ├── default.json       # Default configuration values
│   └── schema.json        # JSON Schema for validating configuration
│
├── test/
│   ├── unit/              # Unit tests for individual functions
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test data and mocks
│
├── docs/
│   ├── README.md          # Goblin-specific documentation
│   ├── api.md             # API reference
│   └── examples/          # Usage examples
│
├── package.json           # Lists *only* the dependencies this goblin needs
├── tsconfig.json          # TypeScript configuration
└── README.md              # Package-level README
```

## File Responsibilities

### src/index.ts - Public API
- **Purpose**: The main entry point and public interface for the goblin
- **Exports**: Clean, simple API methods that other parts of GoblinOS can use
- **Pattern**: Implement the `GoblinInterface` with `initialize()`, `execute()`, `shutdown()`
- **Example**:
```typescript
import { BaseGoblin } from '@goblinos/shared';
import { goblinLogic } from './logic.js';
import type { GoblinConfig, GoblinContext, GoblinResult } from '@goblinos/shared';

export class MyGoblin extends BaseGoblin {
  getCapabilities() {
    return {
      name: 'My Goblin',
      description: 'Does amazing things',
      version: '1.0.0'
    };
  }

  protected async onInitialize(config: GoblinConfig) {
    // Setup logic here
  }

  protected async onExecute(context: GoblinContext): Promise<GoblinResult> {
    return goblinLogic.process(context.input);
  }
}

export default MyGoblin;
```

### src/logic.ts - Core Implementation
- **Purpose**: Contains the core business logic and algorithms
- **Visibility**: Private - only accessed by index.ts
- **Guidelines**:
  - Pure functions where possible
  - No external dependencies except those declared in package.json
  - Well-tested and documented
  - Focused on the goblin's primary responsibility

### src/schema.ts - Data Models
- **Purpose**: Defines database schemas, data structures, and validation
- **Tools**: Use Drizzle, Prisma, or Zod schemas
- **Responsibilities**:
  - Table definitions
  - Relationship mappings
  - Data validation schemas
  - Migration definitions

### src/types.ts - Type Definitions
- **Purpose**: TypeScript interfaces and type definitions
- **Contents**:
  - Input/output types for the goblin's API
  - Internal data structures
  - Configuration types
  - Error types

### config/default.json - Default Configuration
- **Purpose**: Sensible defaults for all configuration options
- **Format**: JSON object
- **Guidelines**:
  - Safe, production-ready defaults
  - Well-documented with comments
  - Environment-agnostic

### config/schema.json - Configuration Validation
- **Purpose**: JSON Schema for validating configuration
- **Benefits**:
  - Runtime configuration validation
  - IDE autocompletion
  - Documentation generation
  - Type safety

### package.json - Dependencies
- **Guidelines**:
  - List ONLY dependencies this goblin actually needs
  - No transitive dependencies
  - Use workspace references for internal packages
  - Keep versions pinned for reproducibility

## Implementation Guidelines

### Interface Compliance
All goblins MUST implement the `GoblinInterface`:

```typescript
interface GoblinInterface {
  initialize(config: GoblinConfig): Promise<void>;
  execute(context: GoblinContext): Promise<GoblinResult>;
  shutdown(): Promise<void>;
  getCapabilities(): GoblinCapabilities;
}
```

### Error Handling
- Use structured error types
- Provide meaningful error messages
- Log errors appropriately
- Never expose internal implementation details in errors

### Configuration Management
- Validate configuration on initialization
- Support environment variable overrides
- Provide clear error messages for invalid config
- Document all configuration options

### Testing Strategy
- Unit tests for all logic functions
- Integration tests for end-to-end flows
- Mock external dependencies
- Test error conditions thoroughly

### Documentation
- Keep README.md updated
- Document all public APIs
- Provide usage examples
- Include troubleshooting guides

## Migration Guide

### From Legacy Structure
1. Identify the core logic and extract to `logic.ts`
2. Define the public API in `index.ts` implementing `GoblinInterface`
3. Move configuration to `config/` directory
4. Define schemas in `schema.ts`
5. Update package.json to include only necessary dependencies
6. Add comprehensive tests

### Benefits of This Structure
- **Predictability**: All goblins follow the same pattern
- **Maintainability**: Clear separation of concerns
- **Testability**: Easy to unit test individual components
- **Reusability**: Clean APIs make goblins easy to integrate
- **Scalability**: Structure supports complex goblins without becoming unwieldy

## Examples

See the `overmind` goblin for a complete implementation of this blueprint.
