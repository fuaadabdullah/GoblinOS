---
description: "README"
---

# World-Class Biome Configuration for GoblinOS

This configuration provides enterprise-grade linting and formatting for the GoblinOS monorepo.

## Overview

Biome is configured as the primary code quality tool for GoblinOS, providing:

- **Linting**: Comprehensive rule set covering correctness, performance, security, and style
- **Formatting**: Consistent code formatting with TypeScript/JavaScript best practices
- **Import Organization**: Automatic import sorting and deduplication
- **Performance**: Optimized for large monorepos with caching and parallel processing

## Configuration Philosophy

- **Zero-config**: Works out of the box with sensible defaults
- **Gradual adoption**: Warnings for legacy code, errors for new code
- **Performance-first**: Optimized for large codebases with 1000+ files
- **Developer-friendly**: Clear error messages and auto-fix capabilities

## Key Features

### 1. Advanced Linting Rules

- **Correctness**: Prevents bugs with unused variables, exhaustive dependencies
- **Performance**: Flags performance anti-patterns like `delete` operator
- **Security**: Prevents dangerous patterns like `dangerouslySetInnerHtml`
- **Accessibility**: Enforces proper ARIA attributes and semantic HTML
- **Style**: Promotes modern JavaScript/TypeScript patterns

### 2. Smart Overrides

- **Test files**: Relaxed rules for `.test.ts` and `.spec.ts` files
- **Config files**: Permissive rules for configuration and build scripts
- **Legacy packages**: Gradual migration path for existing codebases

### 3. CI/CD Integration

- **GitHub Actions**: Automated checks on push/PR with auto-fix commits
- **Pre-commit hooks**: Fast local validation with Lefthook
- **Parallel execution**: Optimized for monorepo scale

## Usage

### Development Workflow

```bash
# Check all files
pnpm biome:check

# Auto-fix issues
pnpm biome:fix

# Format code
pnpm biome:format

# Organize imports
pnpm biome:imports:fix

# Check staged files only
pnpm biome:staged
```

### Pre-commit Setup

Pre-commit hooks automatically run Biome checks on staged files:

- **biome-check**: Linting validation
- **biome-format**: Code formatting
- **biome-imports**: Import organization

### CI/CD Pipeline

GitHub Actions workflow provides:

- **Parallel checks**: Format, lint, and import organization
- **Auto-fix PRs**: Automatically fixes and commits formatting issues
- **Fast feedback**: Early failure detection

## Rule Categories

### Correctness (Error Level)

- `noUnusedVariables`: Prevents dead code
- `useExhaustiveDependencies`: React hook dependency validation
- `useHookAtTopLevel`: Proper React hook usage

### Performance (Error Level)

- `noDelete`: Avoids performance issues with delete operator

### Security (Error Level)

- `noDangerouslySetInnerHtml`: Prevents XSS vulnerabilities

### Style (Error Level)

- `useTemplate`: Prefer template literals over string concatenation
- `useConst`: Prefer const over let when possible
- `useImportType`: Use type-only imports for better tree-shaking
- `useExponentiationOperator`: Use `**` instead of `Math.pow()`
- `noInferrableTypes`: Remove unnecessary type annotations
- `useNodejsImportProtocol`: Use `node:` protocol for Node.js built-ins

### Suspicious (Error Level)

- `noImplicitAnyLet`: Prevent implicit any types
- `noAssignInExpressions`: Avoid assignment in expressions
- `noArrayIndexKey`: Prevent array indices as React keys

### Accessibility (Error Level)

- `useButtonType`: Proper button type attributes
- `useKeyWithClickEvents`: Keyboard accessibility
- `useValidAnchor`: Proper anchor elements

### Complexity (Mixed Level)

- `noForEach`: Disabled (allowed for readability)
- `useLiteralKeys`: Error (prefer literal object keys)
- `useSimplifiedLogicExpression`: Error (simplify boolean expressions)

## Overrides

### Test Files (`**/*.test.ts`, `**/*.spec.ts`)

- `noExplicitAny`: Off (tests often need flexible types)
- `noNonNullAssertion`: Off (test assertions commonly use !)

### Config Scripts (`**/config/**`, `**/scripts/**`)

- `noExplicitAny`: Off (build scripts need flexibility)
- `noNonNullAssertion`: Off (configuration often requires !)

### Legacy Packages (`packages/goblins/forge-smithy/**`)

- `noNonNullAssertion`: Off (gradual migration from legacy code)

## Performance Optimizations

### Caching

- VCS-aware caching reduces redundant checks
- File watching for incremental updates
- Parallel processing for large file sets

### File Filtering

- Comprehensive ignore patterns for generated files
- Support for multiple file types (TS, JS, JSON, CSS, MD)
- Unknown file type handling

## Migration Guide

### From ESLint/Prettier

1. Remove ESLint and Prettier dependencies
2. Update package.json scripts to use Biome
3. Update CI/CD workflows
4. Update pre-commit hooks
5. Run `pnpm biome:fix` to migrate existing code

### Gradual Adoption

1. Start with formatting: `biome:format`
2. Add import organization: `biome:imports:fix`
3. Enable linting rules incrementally
4. Use overrides for legacy code sections

## Troubleshooting

### Common Issues

- **Slow checks**: Enable caching, use `--files-ignore-unknown`
- **False positives**: Use overrides for specific file patterns
- **Legacy code**: Start with warnings, gradually upgrade to errors

### Performance Tuning

- Use `--staged` for pre-commit hooks
- Enable VCS integration for better caching
- Use parallel execution in CI/CD

## Contributing

When adding new rules or configurations:

1. Test on representative codebase sections
2. Update this documentation
3. Consider override patterns for gradual adoption
4. Validate CI/CD pipeline still passes

## Version Compatibility

- **Biome**: ^1.9.4 (latest stable)
- **Node.js**: 20+ (ES2022+ features)
- **TypeScript**: 5.6+ (latest type system features)

---

**Last Updated**: October 2025
**Biome Version**: 1.9.4
**Configuration**: World-class enterprise setup
