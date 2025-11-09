---
title: GoblinOS
type: reference
project: GoblinOS
status: reviewed
owner: GoblinOS
goblin_name: GoblinOS Platform
---

**AI Agents & Automation System** - Monorepo tooling, agents, and workspace health automation for the ForgeMonorepo.

## 🚀 Quick Start

```bash
cd ForgeMonorepo/GoblinOS
pnpm install
pnpm build
```

## Goblin CLI (quick run)

GoblinOS exposes a declarative set of "goblins" in `GoblinOS/goblins.yaml`. A small helper script will be provided to list and safely run these goblins. Example usage (placeholder until `goblin-cli` is added):

```bash
# List available goblins
bash GoblinOS/goblin-cli.sh list

# Dry-run a goblin (safe)
bash GoblinOS/goblin-cli.sh run --dry <goblin-id>

# Execute (owners only for destructive tasks)
bash GoblinOS/goblin-cli.sh run <goblin-id>
```

Note: A lightweight `goblin-cli` scaffold will be added soon to validate and safely execute entries in `GoblinOS/goblins.yaml`.

**Before opening a PR:**

```bash
pnpm lint:fix && pnpm test:coverage && pnpm build
```

## 🐳 Ollama Setup (Required for AI Features)

GoblinOS uses Ollama for local LLM inference. To activate Ollama:

### Option 1: Docker (Recommended)

```bash
# In the overmind package directory
cd packages/goblins/overmind
docker-compose up -d ollama
```

This starts Ollama on port 11435 (to avoid conflicts).

### Option 2: Local Installation

```bash
# Install Ollama (macOS)
brew install ollama

# Start Ollama service
ollama serve

# Pull a model (in another terminal)
ollama pull qwen2.5:3b
```

### Verify Ollama is Running

```bash
curl http://localhost:11434/api/tags
# Should return JSON with available models
```

### Environment Configuration

Copy and configure your environment:

```bash
cp .env.example .env
# Edit .env with your API keys and Ollama settings
```

For Overmind development, set a local LLM endpoint via env vars. Choose one:

```bash
# Option A: Direct connection to Ollama (OpenAI-compatible path appended automatically)
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_DEFAULT_MODEL=llama3.2

# Optional: override fallbacks (comma-separated)
# export FALLBACK_MODELS=llama3.2
```

```bash
# Option B: Direct connection to DeepSeek (OpenAI-compatible)
export DEEPSEEK_API_KEY=sk-your-key
# Optional override (defaults to https://api.deepseek.com)
# export DEEPSEEK_BASE_URL=https://api.deepseek.com
export DEEPSEEK_DEFAULT_MODEL=deepseek-r1
```

```bash
# Option C: Direct connection to OpenAI
export OPENAI_API_KEY=sk-your-key
# Optional override (defaults to https://api.openai.com)
# export OPENAI_BASE_URL=https://api.openai.com
export OPENAI_DEFAULT_MODEL=gpt-4-turbo
```

Then verify connectivity:

```bash
node GoblinOS/examples/ollama-connection-test.js "Say hello from Ollama."
# or
node GoblinOS/examples/deepseek-connection-test.js "Say hello from DeepSeek."
# or (via OpenAI)
# use goblin ask or the providers directly since OpenAI uses the standard /v1 API
```

If `OLLAMA_BASE_URL` is not set, GoblinOS falls back to a LiteLLM gateway
via `LITELLM_BASE_URL`.

## 🏗️ Architecture

```text
GoblinOS/
├── 📦 packages/
│   ├── 🖥️ cli/                    # Goblin CLI entry point
│   └── 🤖 goblins/
│       ├── 📝 quillwarden/         # Obsidian vault automation
│       ├── 🏗️ repo-bootstrap/      # Repository scaffolding
│       └── 🏥 workspace-health/    # Health checks and smoke tests
├── 📋 .changeset/              # Release changesets
├── ⚙️ tsconfig.build.json      # TypeScript project references
├── 🧪 vitest.config.ts         # Test configuration
└── 🔧 biome.json               # Lint/format configuration
```

## 🛡️ Production Tooling

GoblinOS is hardened with:

- ✅ **TypeScript Project References** - Fast incremental builds
- ✅ **Vitest + v8 Coverage** - 90% code coverage enforced
- ✅ **Biome** - Fast linting & formatting
- ✅ **Changesets** - Semantic versioning & changelogs
- ✅ **npm Provenance** - Signed, verifiable releases
- ✅ **CI Matrix** - Node 20 & 22
- ✅ **Security Scanning** - CodeQL, OpenSSF Scorecard, SBOM
- ✅ **Dependency Updates** - Automated via Renovate
- ✅ **Architecture Guardrails** - dependency-cruiser

## 📚 Documentation

- **[🧭 SOURCE_OF_TRUTH.md](./SOURCE_OF_TRUTH.md)** - Canonical map of mission, architecture, workflows, and runbooks
- **[📋 COMMANDS.md](./docs/COMMANDS.md)** - Quick command reference
- **[⚙️ SETUP.md](./docs/SETUP.md)** - Installation & troubleshooting
- **[🛡️ PRODUCTION_HARDENING.md](./docs/PRODUCTION_HARDENING.md)** - Deep dive on tooling
- **[📊 HARDENING_SUMMARY.md](./docs/HARDENING_SUMMARY.md)** - What was implemented

## 🛠️ Development

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | 🏃 Run CLI in dev mode |
| `pnpm check` | 🔍 Type check (no emit) |
| `pnpm build` | 🏗️ Incremental build |
| `pnpm test` | 🧪 Run tests |
| `pnpm test:coverage` | 📊 Tests + coverage |
| `pnpm lint` | 🔍 Check for errors |
| `pnpm lint:fix` | 🔧 Auto-fix errors |
| `pnpm changeset` | 📝 Create release changeset |

### CI/CD

**On PR:**

- 🔍 Type check (Node 20 & 22)
- 🧹 Lint (Biome)
- 🧪 Test with coverage
- 🏗️ Build
- 🔒 Security scans

**On main:**

- ✅ All PR checks
- 🛡️ OpenSSF Scorecard
- 📦 SBOM generation
- 🚀 Automated releases (via Changesets)

## 📦 Releasing

Releases are automated:

1. 📝 Create changeset: `pnpm changeset`
2. 💾 Commit and push
3. 🔀 Merge the "Version Packages" PR
4. 📤 Packages are published to npm with provenance

## 📄 License

See workspace root LICENSE.
