# forge-smithy

World-class environment goblin for Forge Guild. Bootstraps, validates, and automates dev/runtime environments, repo hygiene, and CI/CD flows. CLI via Typer, optional FastAPI service, CrewAI/LangGraph agent ready.

## Features

- **Multi-language code quality**: Biome v1.9.4+ for JavaScript/TypeScript linting, formatting, and import organization
- Python env + deps via uv
- Repo hygiene: pre-commit, ruff, pytest, Biome
- Typer CLI: doctor, bootstrap, sync_config, check, biome-check, biome-fix, biome-format, biome-imports
- FastAPI HTTP service for Overmind
- CrewAI/LangGraph agent registration

## Usage

```bash
# Environment management
uv run python -m smithy doctor
uv run python -m smithy bootstrap
uv run python -m smithy sync_config
uv run python -m smithy check

# Biome operations (JavaScript/TypeScript)
uv run python -m smithy biome-check
uv run python -m smithy biome-fix
uv run python -m smithy biome-format
uv run python -m smithy biome-imports
uv run python -m smithy biome-init-config
uv run python -m smithy biome-diagnostics
```

## Biome Integration

Smithy now includes comprehensive Biome support for enterprise-grade JavaScript/TypeScript code quality:

- **biome-check**: Lint and check code quality with enterprise rules
- **biome-fix**: Auto-fix linting issues safely
- **biome-format**: Format code consistently with Biome's opinionated formatter
- **biome-imports**: Organize and sort imports automatically
- **biome-init-config**: Initialize Biome configuration with world-class defaults
- **biome-diagnostics**: Show detailed Biome diagnostics and performance metrics

### Biome Configuration

Smithy provides a world-class Biome configuration with:

- Enterprise-grade linting rules for large codebases
- Performance optimizations for fast execution
- Gradual adoption overrides for legacy code
- TypeScript and JavaScript support
- Import organization and sorting
- Consistent formatting standards

### Usage Examples

```bash
# Check all JavaScript/TypeScript files
uv run python -m smithy biome-check

# Auto-fix issues in place
uv run python -m smithy biome-fix

# Format code consistently
uv run python -m smithy biome-format

# Organize imports
uv run python -m smithy biome-imports

# Initialize Biome config in current directory
uv run python -m smithy biome-init-config

# Show detailed diagnostics
uv run python -m smithy biome-diagnostics
```

### Integration with Repo Hygiene

Biome checks are integrated into the unified repo hygiene system:

```bash
# Run all checks (Biome + Python + pre-commit)
uv run python -m smithy check
```

This ensures consistent code quality across the entire monorepo.

## HTTP API (optional)

POST /smithy/doctor
POST /smithy/bootstrap
POST /smithy/check
POST /smithy/biome-check
POST /smithy/biome-fix

## Integration

- Overmind bridge: HTTP or CLI
- CrewAI/LangGraph: agent registration
- Unified repo hygiene: `smithy check` runs all linters (Biome + Python)

## Docs

- [Biome](https://biomejs.dev/)
- [uv](https://docs.astral.sh/uv/)
- [pre-commit](https://pre-commit.com/)
- [Typer](https://typer.tiangolo.com/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [CrewAI](https://docs.crewai.com/)
