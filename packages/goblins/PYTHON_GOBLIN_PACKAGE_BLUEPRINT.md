# Python Goblin Package Blueprint

This document defines the standard structure and conventions for Python-based GoblinOS goblin packages. Following this blueprint ensures consistency, maintainability, and clear separation of concerns across the entire GoblinOS ecosystem.

## Overview

Every Python goblin package is a self-contained module that implements a specific capability within GoblinOS. Each goblin follows the same architectural pattern to ensure predictability and ease of integration.

## Standard Folder Structure

```
packages/goblins/{goblin-name}/
├── src/
│   ├── __init__.py        # Package initialization
│   ├── goblin.py          # Main "public API" for this goblin (implements GoblinInterface)
│   ├── logic.py           # The core internal logic (the "brain")
│   ├── schema.py          # Defines data models and validation schemas
│   └── types.py           # Type definitions and interfaces
│
├── config/
│   ├── default.json       # Default configuration values
│   └── schema.json        # JSON Schema for validating configuration
│
├── tests/
│   ├── unit/              # Unit tests for individual functions
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test data and mocks
│
├── docs/
│   ├── README.md          # Goblin-specific documentation
│   ├── api.md             # API reference
│   └── examples/          # Usage examples
│
├── pyproject.toml         # Python package configuration and dependencies
├── mypy.ini               # MyPy type checking configuration
└── README.md              # Package-level README
```

## File Responsibilities

### src/goblin.py - Public API
- **Purpose**: The main entry point and public interface for the goblin
- **Exports**: Clean, simple API methods that other parts of GoblinOS can use
- **Pattern**: Implement the `GoblinInterface` with `initialize()`, `execute()`, `shutdown()`
- **Example**:
```python
from goblinos.interface import GoblinInterface, GoblinConfig, GoblinContext, GoblinResult, GoblinCapabilities
from .logic import MyGoblinLogic
from typing import Optional

class MyGoblin(GoblinInterface):
    def __init__(self):
        self.logic = MyGoblinLogic()
        self.config: Optional[GoblinConfig] = None

    async def initialize(self, config: GoblinConfig) -> None:
        self.config = config
        await self.logic.initialize(config)

    async def execute(self, context: GoblinContext) -> GoblinResult:
        return await self.logic.execute(context)

    async def shutdown(self) -> None:
        await self.logic.shutdown()

    def get_capabilities(self) -> GoblinCapabilities:
        return GoblinCapabilities(
            name="My Goblin",
            description="Does amazing things",
            version="1.0.0"
        )
```

### src/logic.py - Core Implementation
- **Purpose**: Contains the core business logic and algorithms
- **Visibility**: Private - only accessed by goblin.py
- **Guidelines**:
  - Pure functions where possible
  - No external dependencies except those declared in pyproject.toml
  - Well-tested and documented
  - Focused on the goblin's primary responsibility

### src/schema.py - Data Models
- **Purpose**: Defines data models, validation schemas, and database structures
- **Tools**: Use Pydantic models, SQLAlchemy, or similar
- **Responsibilities**:
  - Data model definitions
  - Validation schemas
  - Database table definitions (if applicable)

### src/types.py - Type Definitions
- **Purpose**: Type hints and type definitions
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

### pyproject.toml - Dependencies
- **Guidelines**:
  - List ONLY dependencies this goblin actually needs
  - No transitive dependencies
  - Use workspace references for internal packages
  - Keep versions pinned for reproducibility

## Implementation Guidelines

### Interface Compliance
All Python goblins MUST implement the `GoblinInterface` from `goblinos.interface`:

```python
from goblinos.interface import GoblinInterface

class MyGoblin(GoblinInterface):
    async def initialize(self, config: GoblinConfig) -> None:
        ...

    async def execute(self, context: GoblinContext) -> GoblinResult:
        ...

    async def shutdown(self) -> None:
        ...

    def get_capabilities(self) -> GoblinCapabilities:
        ...
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

### From Legacy Python Structure
1. Identify the core logic and extract to `logic.py`
2. Define the public API in `goblin.py` implementing `GoblinInterface`
3. Move configuration to `config/` directory
4. Define schemas in `schema.py`
5. Update pyproject.toml to include only necessary dependencies
6. Add comprehensive tests

### Benefits of This Structure
- **Predictability**: All goblins follow the same pattern
- **Maintainability**: Clear separation of concerns
- **Testability**: Easy to unit test individual components
- **Reusability**: Clean APIs make goblins easy to integrate
- **Scalability**: Structure supports complex goblins without becoming unwieldy

## Examples

See Python goblins in the GoblinOS packages for complete implementations of this blueprint.
