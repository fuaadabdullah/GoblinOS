# GoblinOS Roles — Overview

Last updated: 2025-11-06
Source of truth: `GoblinOS/goblins.yaml`

This document is generated from the YAML and summarizes the Overmind, guilds, members, brains, and KPIs.

## Overmind

- Name: Overmind — Overseer
- Brain
  - Local: ollama, ollama-coder
  - Routers: openai, gemini, deepseek-r1
  - Embeddings: nomic-embed-text

## Guilds

### Forge
- Charter: Core logic, build graph, performance budgets, break-glass fixes.
- Toolbelt:
  - **portfolio-dev** — Portfolio Dev Server
    - Summary: Run the portfolio locally with NEXT_PUBLIC_SITE_URL managed by the guild.
    - Owner: vanta-lumin
    - Command: `NEXT_PUBLIC_SITE_URL="http://localhost:3000" PORTFOLIO_DIR="/Users/fuaadabdullah/Downloads/fuaad-portfolio-starter" bash tools/portfolio_env.sh dev`
  - **portfolio-build** — Portfolio Build
    - Summary: Build the portfolio with NEXT_PUBLIC_SITE_URL managed by the guild.
    - Owner: vanta-lumin
    - Command: `NEXT_PUBLIC_SITE_URL="http://localhost:3000" PORTFOLIO_DIR="/Users/fuaadabdullah/Downloads/fuaad-portfolio-starter" bash tools/portfolio_env.sh build`
  - **forge-lite-build** — Forge Lite Build
    - Summary: Build production bundle for all platforms.
    - Owner: dregg-embercode
    - Command: `cd apps/forge-lite && pnpm build`
- Members
  - dregg-embercode — Forge Master
    - Brain: local=[ollama], routers=[deepseek-r1], embeddings=[nomic-embed-text]
    - Responsibilities:
      - Core logic and build graph management
      - Performance budgets and optimization
      - Break-glass fixes for critical issues
      - Hot-reload time and build reliability
    - Tools:
      - Owned: forge-lite-build
      - Selection Rules:
        - "build production bundle" → forge-lite-build
        - "optimize build performance" → forge-lite-build
        - "check build time" → forge-lite-build
    - KPIs: p95_build_time, hot_reload_time, failed_build_rate

### Crafters
- Charter: UI systems, theme tokens, a11y, CLS/LCP budgets; APIs, schemas, queues, idempotency, error budgets.
- Toolbelt:
  - **forge-lite-dev** — Forge Lite Dev Server
    - Summary: Run Expo dev server for ForgeTM Lite mobile app.
    - Owner: vanta-lumin
    - Command: `cd apps/forge-lite && pnpm dev`
  - **forge-lite-api-dev** — Forge Lite API Server
    - Summary: Run FastAPI backend for risk calculations and analytics.
    - Owner: volt-furnace
    - Command: `cd apps/forge-lite/api && uvicorn main:app --reload --port 8000`
- Members
  - vanta-lumin — Glyph Scribe
    - Brain: local=[ollama], routers=[deepseek-r1]
    - Responsibilities:
      - UI systems and component architecture
      - Theme tokens and design system management
      - Accessibility (a11y) compliance
      - CLS/LCP performance budgets and design QA
    - Tools:
      - Owned: portfolio-dev, portfolio-build, forge-lite-dev
      - Selection Rules:
        - "start portfolio dev server" → portfolio-dev
        - "build portfolio" → portfolio-build
        - "start forge lite UI development" → forge-lite-dev
        - "test UI components" → forge-lite-dev
    - KPIs: cls, lcp, a11y_score
  - volt-furnace — Socketwright
    - Brain: local=[ollama-coder], routers=[deepseek-r1]
    - Responsibilities:
      - API design and implementation
      - Schema management and validation
      - Message queues and async processing
      - Idempotency and error budget enforcement
    - Tools:
      - Owned: forge-lite-api-dev
      - Selection Rules:
        - "start API server" → forge-lite-api-dev
        - "test API endpoints" → forge-lite-api-dev
        - "debug backend logic" → forge-lite-api-dev
    - KPIs: p99_latency, error_rate, schema_drift

### Huntress
- Charter: Flaky test hunts, regression triage, incident tagging; early-signal scouting, log mining, trend surfacing.
- Toolbelt:
  - **forge-lite-test** — Forge Lite Tests
    - Summary: Run all tests for ForgeTM Lite (frontend + backend).
    - Owner: magnolia-nightbloom
    - Command: `cd apps/forge-lite && pnpm test && cd api && pytest`
- Members
  - magnolia-nightbloom — Vermin Huntress
    - Brain: local=[ollama-coder], routers=[openai]
    - Responsibilities:
      - Flaky test identification and remediation
      - Regression triage and root cause analysis
      - Incident tagging and categorization
      - MTTR reduction for test failures
    - Tools:
      - Owned: forge-lite-test
      - Selection Rules:
        - "run tests" → forge-lite-test
        - "identify flaky tests" → forge-lite-test
        - "regression check" → forge-lite-test
    - KPIs: flaky_rate, mttr_test_failures
  - mags-charietto — Omenfinder
    - Brain: local=[ollama-coder], routers=[gemini]
    - Responsibilities:
      - Early-signal detection and alerting
      - Log mining and pattern recognition
      - Trend surfacing and prediction
      - False-positive rate optimization
    - Tools:
      - Owned: None
      - Selection Rules:
        - "analyze logs" → Brain only (Uses brain for log analysis, no external tools)
    - KPIs: valid_early_signals, false_positive_rate

### Keepers
- Charter: Secrets, licenses, SBOM, signatures, backups, attestations.
- Members
  - sentenial-ledgerwarden — Sealkeeper
    - Brain: local=[ollama], routers=[deepseek-r1], embeddings=[nomic-embed-text]
    - Responsibilities:
      - Secrets management and rotation
      - License compliance and tracking
      - SBOM generation and validation
      - Code signatures and attestations
      - Backup integrity and recovery
    - Tools:
      - Owned: None
      - Selection Rules:
        - "rotate secrets" → Brain only (Uses brain + secrets_manage.sh script)
        - "validate SBOM" → Brain only (Uses brain for analysis)
    - KPIs: secrets_rotated, sbom_drift, unsigned_artifacts

### Mages
- Charter: Forecasting, anomaly detection, and quality gates for releases.
- Toolbelt:
  - **forge-lite-lint** — Forge Lite Lint
    - Summary: Run linters for TypeScript and Python code.
    - Owner: launcey-gauge
    - Command: `cd apps/forge-lite && pnpm lint && cd api && ruff check .`
- Members
  - hex-oracle — Forecasting Fiend
    - Brain: local=[ollama], routers=[deepseek-r1]
    - Responsibilities:
      - Release risk scoring and prediction
      - Incident likelihood forecasting
      - Capacity planning and forecasting
      - Forecast accuracy optimization (MAE/MAPE)
    - Tools:
      - Owned: None
      - Selection Rules:
        - "forecast release risk" → Brain only (Uses brain for predictive modeling)
    - KPIs: forecast_mae, forecast_mape, release_risk_auc
  - grim-rune — Glitch Whisperer
    - Brain: local=[ollama-coder], routers=[deepseek-r1]
    - Responsibilities:
      - Anomaly detection on metrics, logs, and traces
      - Auto-ticket creation for detected issues
      - Pre-production anomaly catching
      - Alert precision and recall optimization
    - Tools:
      - Owned: None
      - Selection Rules:
        - "detect anomalies" → Brain only (Uses brain for anomaly detection)
    - KPIs: anomalies_preprod, alert_precision, alert_recall
  - launcey-gauge — Fine Spellchecker
    - Brain: local=[ollama], routers=[deepseek-r1]
    - Responsibilities:
      - Lint and code quality enforcement
      - Test coverage and quality gates
      - Schema and API conformance validation
      - Diátaxis documentation standards
      - PR gate pass rate optimization
    - Tools:
      - Owned: forge-lite-lint
      - Selection Rules:
        - "run linters" → forge-lite-lint
        - "check code quality" → forge-lite-lint
        - "validate PR" → forge-lite-lint
    - KPIs: pr_gate_pass_rate, violations_per_kloc

---

Notes
- The YAML is the single source of truth; update it to reflect org/role changes. Re-generate this file after edits.
- KPIs are named metrics; thresholds/targets are tracked in telemetry systems and PR gates.
