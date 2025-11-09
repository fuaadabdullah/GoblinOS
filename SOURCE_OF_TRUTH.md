# GoblinOS — Source of Truth

> Central reference for how GoblinOS is assembled, deployed, and operated across the ForgeMonorepo. Start here before diving into per-package docs.

## 1. Mission, Scope, and Non-Goals

- **Mission:** Provide a governed automation substrate for the ForgeMonorepo covering AI agent orchestration, workspace health, release automation, and desktop controls.
- **Primary Surfaces:** runtime services (`packages/goblin-runtime`), CLI (`packages/goblin-cli`), Overmind dashboards (`packages/goblins/overmind`), desktop control plane (`desktop`), and telemetry/audit stack (`tools/telemetry`).
- **Non-goals:** App-specific business logic (lives in `apps/`), infra provisioning (handled in `infra/`), and secrets storage inside the repo (only references/env var hooks live here).

## 2. System Map

```
GoblinOS
├── goblins.yaml             # Single source of configuration truth
├── packages/
│   ├── goblin-cli           # CLI entry point (dispatches goblins + toolchains)
│   ├── goblin-runtime       # HTTP/WebSocket runtime, orchestration parser, cost tracker
│   ├── goblins/overmind     # Dashboard + monitoring UI
│   └── tool-selector        # Trigger → tool routing used by every goblin
├── desktop/                 # Tauri front-end + Rust providers
├── tools/telemetry/         # Audit, tracing, retention, key rotation, integrations
├── scripts/                 # Role/docs generators, KPI validation, etc.
└── docs/                    # Deep-dives (roles, prompts, routing, tooling)
```

**Execution Surfaces**

| Surface | Location | Why it matters | Run command |
|---------|----------|----------------|-------------|
| Runtime API | `packages/goblin-runtime/src/server.ts` | Serves `/api/execute`, orchestration parsing/execution, cost tracking, history | `pnpm --filter @goblinos/runtime dev` |
| CLI | `packages/goblin-cli/src/cli.ts` | Entry point for scripted goblin runs and pipelines | `pnpm --filter @goblinos/cli start` |
| Overmind Dashboard | `packages/goblins/overmind/dashboard` | Visualizes goblin health, history, orchestration builder | `pnpm --filter @goblinos/overmind dev` |
| Desktop Control Plane | `desktop/` | Local orchestrator with Tauri + Rust providers + Ollama integration | `pnpm --filter goblinos-desktop tauri dev` |
| Telemetry/Audit Stack | `tools/telemetry/` | Non-repudiable audit logging, OTEL collector, retention + query APIs | `docker-compose up -d` from `tools/telemetry` |

## 3. Guilds & Goblins (from `goblins.yaml`)

Each guild defines a charter, KPI set, toolbelt, and member roster inside `goblins.yaml`. This section is auto-generated alongside `docs/ROLES.md` via `node scripts/generate-roles.js`—edit the YAML to make changes and rerun the generator.

<!-- GUILD_SUMMARY_START -->
### Forge ([full breakdown](./docs/ROLES.md#forge))
- **Charter:** Core logic, build graph, performance budgets, break-glass fixes.
- **Toolbelt owners:** `portfolio-dev` (vanta-lumin), `portfolio-build` (vanta-lumin), `forge-lite-build` (dregg-embercode), `forge-lite-release-build` (dregg-embercode), `forge-lite-release-submit` (dregg-embercode), `framework-migrator` (dregg-embercode)
- **Goblins:**
  - **Forge Master (`dregg-embercode`)** — Core logic and build graph management; Performance budgets and optimization. KPIs: `p95_build_time`, `hot_reload_time`, `failed_build_rate`. Tools: `forge-lite-build`, `forge-lite-release-build`, `forge-lite-release-submit`.

### Crafters ([full breakdown](./docs/ROLES.md#crafters))
- **Charter:** UI systems, theme tokens, a11y, CLS/LCP budgets; APIs, schemas, queues, idempotency, error budgets.
- **Toolbelt owners:** `forge-lite-bootstrap` (vanta-lumin), `forge-lite-dev` (vanta-lumin), `forge-lite-api-dev` (volt-furnace), `forge-lite-db-migrate` (volt-furnace), `forge-lite-rls-check` (volt-furnace), `forge-lite-auth-login` (volt-furnace), `forge-lite-market-data-fetch` (volt-furnace), `forge-lite-telemetry-check` (vanta-lumin), `forge-lite-release-build` (dregg-embercode), `forge-lite-release-submit` (dregg-embercode), `forge-lite-export-data` (volt-furnace), `forge-lite-docs-update` (launcey-gauge)
- **Goblins:**
  - **Glyph Scribe (`vanta-lumin`)** — UI systems and component architecture; Theme tokens and design system management. KPIs: `cls`, `lcp`, `a11y_score`. Tools: `portfolio-dev`, `portfolio-build`, `forge-lite-bootstrap`, `forge-lite-dev`, `forge-lite-telemetry-check`, `forge-lite-docs-update`.
  - **Socketwright (`volt-furnace`)** — API design and implementation; Schema management and validation. KPIs: `p99_latency`, `error_rate`, `schema_drift`. Tools: `forge-lite-api-dev`, `forge-lite-db-migrate`, `forge-lite-rls-check`, `forge-lite-auth-login`, `forge-lite-market-data-fetch`, `forge-lite-export-data`.

### Huntress ([full breakdown](./docs/ROLES.md#huntress))
- **Charter:** Flaky test hunts, regression triage, incident tagging; early-signal scouting, log mining, trend surfacing.
- **Toolbelt owners:** `forge-lite-test` (magnolia-nightbloom), `forge-lite-e2e-test` (magnolia-nightbloom), `forge-lite-smoke-test` (magnolia-nightbloom), `forge-lite-feedback-export` (magnolia-nightbloom)
- **Goblins:**
  - **Vermin Huntress (`magnolia-nightbloom`)** — Flaky test identification and remediation; Regression triage and root cause analysis. KPIs: `flaky_rate`, `mttr_test_failures`. Tools: `forge-lite-test`, `forge-lite-e2e-test`, `forge-lite-smoke-test`, `forge-lite-feedback-export`.
  - **Omenfinder (`mags-charietto`)** — Early-signal detection and alerting; Log mining and pattern recognition. KPIs: `valid_early_signals`, `false_positive_rate`. Tools: Brain workflows only.

### Keepers ([full breakdown](./docs/ROLES.md#keepers))
- **Charter:** Secrets, licenses, SBOM, signatures, backups, attestations.
- **Toolbelt owners:** Brain-driven workflows only; see member tool ownership below.
- **Goblins:**
  - **Sealkeeper (`sentenial-ledgerwarden`)** — Secrets management and rotation; License compliance and tracking. KPIs: `secrets_rotated`, `sbom_drift`, `unsigned_artifacts`. Tools: Brain workflows only.

### Mages ([full breakdown](./docs/ROLES.md#mages))
- **Charter:** Forecasting, anomaly detection, and quality gates for releases.
- **Toolbelt owners:** `forge-lite-lint` (launcey-gauge), `forge-lite-docs-update` (launcey-gauge)
- **Goblins:**
  - **Forecasting Fiend (`hex-oracle`)** — Release risk scoring and prediction; Incident likelihood forecasting. KPIs: `forecast_mae`, `forecast_mape`, `release_risk_auc`. Tools: Brain workflows only.
  - **Glitch Whisperer (`grim-rune`)** — Anomaly detection on metrics, logs, and traces; Auto-ticket creation for detected issues. KPIs: `anomalies_preprod`, `alert_precision`, `alert_recall`. Tools: Brain workflows only.
  - **Fine Spellchecker (`launcey-gauge`)** — Lint and code quality enforcement; Test coverage and quality gates. KPIs: `pr_gate_pass_rate`, `violations_per_kloc`. Tools: `forge-lite-lint`, `forge-lite-docs-update`.
<!-- GUILD_SUMMARY_END -->

## 4. Goblin Lifecycle (End to End)

1. **Configuration (`goblins.yaml`):** Defines guilds, members, owned tools, selection rules, API key expectations, and KPI charters. Every automation uses this file directly or via `@goblinos/tool-selector`.
2. **Tool Selection (`packages/tool-selector`):** `getToolSelector()` reads config, matches triggers (`run tests`, `build release bundle`, etc.), validates ownership, and returns the exact command to fulfill the task. Demo in `examples/tool-selection-demo.js`.
3. **Execution (`packages/goblin-runtime`):**
   - `GoblinRuntime` loads goblins, tracks history/stats, and calls providers (local Ollama, OpenAI, Gemini, DeepSeek, etc.).
   - `OrchestrationParser` turns DSL like `THEN`, `IF_SUCCESS`, `AND` into an executable plan; `OrchestrationExecutor` runs it, emitting durations and outputs for each step.
   - `CostTracker` captures LLM usage metrics per goblin and streams them over WebSocket `/ws`.
4. **Surfaces:**
   - **CLI** delegates to runtime or tool commands for headless flows.
   - **Desktop** (Rust + React) exposes goblin selectors, memory store (`desktop/src-tauri/src/memory.rs`), and provider bindings (`providers/*.rs`).
   - **Overmind dashboard** consumes runtime APIs (`/api/goblins`, `/api/history/:id`, `/api/orchestrate/plans`) for operator visibility.
5. **Telemetry + Audit:** All key paths emit OTEL spans and signed audit events (`tools/telemetry/overmind`, `litebrain`, `audit_service.py`). Events are signed (Ed25519), canonicalized, stored via retention policies, and queried via `audit_query_api.py`.

## 5. Tooling, Automation, and Scripts

- **Role + Tool Docs:** `scripts/generate-roles.js` regenerates `docs/ROLES.md` pulling tool ownership/selection info.
- **Guild Doc Sync Guardrail:** Run `pnpm run generate:roles:check` (or `node scripts/generate-roles.js` followed by a linted commit) to update `docs/ROLES.md`, this Source of Truth, and `.github/copilot-instructions.md`. CI (`.github/workflows/validate-guild-docs.yml`) reruns this command on every PR touching guild data and fails if the repo is dirty.
- **KPI Drift Detection:** `scripts/validate-kpi-drift.js` ensures KPI definitions in `docs/KPI.md` stay aligned with `goblins.yaml`.
- **Telemetry smoke:** `tools/telemetry/run_poc.sh` boots Overmind, LiteBrain, audit services, OTEL collector, Tempo/Zipkin/Prometheus.
- **API key validation:** `test-api-keys.sh` + `API_KEYS_STATUS.md` provide quick health checks of required secrets.
- **Desktop orchestration:** `desktop/TEST_FEATURES.sh` runs battery of IPC + provider tests.
- **Runtime maintenance:** `packages/goblin-runtime/fix-tests.sh`, `fix-tokens.sh`, etc., unblock stubborn CI failures highlighted in `TEST_FIXES_NEEDED.md`.

## 6. Observability, Audit, and Safety

- **Tracing:** OTEL SDK embedded in Overmind (Node) and LiteBrain (Python) pushes spans to the collector defined in `tools/telemetry/collector-config.yaml`, with Tempo/Zipkin/Prometheus as downstreams (see `docker-compose.yml`).
- **Audit Guarantees:** `audit/audit_service.py` signs events with Ed25519; `audit/verify_event.py` validates across languages. Key rotation + retention scripts (`key_rotation.py`, `audit_retention.py`) run standalone or via cron/k8s jobs.
- **Querying:** `audit_query_api.py` exposes `/query`, `/stats` for audit analysis; tests in `audit/tests/test_verification.py`.
- **Dashboards:** Tempo (`:3200`), Zipkin (`:9411`), Prometheus (`:9090`) URLs captured in `tools/telemetry/README.md`.
- **Integration Tests:** `tools/telemetry/integration_test.sh` covers Node ↔ Python tracing, signature verification, and log retention behavior end to end.

## 7. Security, Secrets, and Compliance

- **API Keys:** Refer to `API_KEYS_MANAGEMENT.md` (policy) and `API_KEYS_STATUS.md` (current posture). All keys must be provided via env vars or approved secret stores; `goblins.yaml` documents every required `env_var`.
- **Setup Scripts:** `setup_api_keys.sh` and `api_keys_setup.sh` bootstrap local `.env` files without committing secrets. `api_keys_setup.sh.example` and `.env.example` act as templates.
- **Desktop Secret Isolation:** Keys never ship in the Tauri bundle; runtime fetches them via env at launch.
- **Audit Retention Policies:** Default 90 days, 7-day compression, 100MB rotation (`tools/telemetry/audit_retention.py`); override via env variables listed in the telemetry README.
- **Release Governance:** Semantic releases enforced through Changesets; provenance enabled (`package.json` `"publishConfig": { "provenance": true }`) and CI verifies lint/tests/build before publish.

## 8. Developer Workflow

| Stage | Commands | Notes |
|-------|----------|-------|
| Install | `cd GoblinOS && pnpm install && pnpm build` | Builds all TS packages with project refs |
| Local LLMs | `brew install ollama && ollama serve && ollama pull qwen2.5:3b` | Required for desktop + default goblin runtime |
| Runtime dev | `pnpm --filter @goblinos/runtime dev` | Provides REST + WS endpoints |
| CLI dev | `pnpm --filter @goblinos/cli dev` | Hot reload for command testing |
| Dashboard dev | `pnpm --filter @goblinos/overmind dev` | Feeds off runtime API |
| Desktop dev | `cd desktop && pnpm tauri dev` | Requires Rust toolchain + Ollama |
| Telemetry stack | `cd tools/telemetry && docker-compose up -d && ./run_poc.sh` | Boots OTEL collector + services |
| Pre-PR gate | `pnpm lint:fix && pnpm test:coverage && pnpm build` | Mirrors README instructions |
| Release | `pnpm changeset && git push` → merge `Version Packages` PR | Publishes with npm provenance |

## 9. Key References (Use These First)

| Topic | File | Why |
|-------|------|-----|
| Overall setup | `README.md` (this folder) | Install, architecture, tooling summary |
| Goblin definitions & tools | `goblins.yaml` | Source for guilds, KPIs, toolbelts |
| Roles, prompts, routing | `docs/ROLES.md`, `docs/PROMPTS.md`, `docs/ROUTING.md` | AI governance + messaging |
| Tool selection deep dive | `docs/TOOL_SELECTION.md` | Trigger matching rules + demo |
| KPI definitions | `docs/KPI.md` | KPI schema + enforcement expectations |
| Telemetry/audit runbook | `tools/telemetry/README.md` | Non-repudiable logging, tracing, endpoints |
| Desktop milestones | `desktop/COMPLETION_REPORT.md`, `desktop/PHASE1_COMPLETE.md` | Status + next steps |
| Runtime testing gaps | `packages/goblin-runtime/TEST_FIXES_NEEDED.md` | Known failing cases + owners |

## 10. Roadmap Signals (Current Focus)

1. **Desktop Phase 2** – Load `goblins.yaml` dynamically, add OpenAI/Gemini/Anthropic providers, streaming + token tracking (`desktop/README.md` outlines weekly plan).
2. **Runtime Test Fixes** – Close items in `packages/goblin-runtime/TEST_FIXES_NEEDED.md`; scripts `fix-tests.sh` and `fix-tokens.sh` exist but still require manual follow-through.
3. **Telemetry Hardening** – Promote PoC stack to production by wiring OTEL collector into infra, enabling KMS-backed keys, and configuring alerting (tracked in `tools/telemetry/README.md` “Production Deployment”).
4. **Tooling CI Hooks** – Add automated validation ensuring every `owned` tool has a matching implementation and selection rule (see “Next Steps” in `docs/TOOL_SELECTION.md`).
5. **API Key Automation** – Extend `API_KEYS_STATUS.md` automation to integrate with `setup_api_keys.sh` output → Slack alerting for missing secrets.

## 11. How to Contribute Safely

1. Read `CONTRIBUTING.md` at the repo root for workspace-wide expectations.
2. For GoblinOS-specific work:
   - Mirror lint/test/build locally (`pnpm lint:fix && pnpm test:coverage && pnpm build`).
   - Keep guild docs in sync: run `pnpm run generate:roles` (or `pnpm run generate:roles:check` to assert cleanliness) whenever `goblins.yaml` or `scripts/generate-roles.js` changes—CI will reject PRs if these files drift.
   - Update this Source of Truth if you introduce new surfaces, env contracts, or operational runbooks.
   - Attach telemetry/audit notes for anything that touches `tools/telemetry`.
3. Add or update Changesets for any published package impact.
4. Keep secrets out of commits; rely on the scripts/templates listed above.

---

This document is the canonical index; link to it from PRs/issues when you add new components so the mental model stays current.
