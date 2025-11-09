# GoblinOS Grand Plan — AI-Native Automation Platform

## Executive Summary
GoblinOS is evolving from a tooling bundle into the automation nervous system for ForgeMonorepo. The platform now centers on three pillars:
1. **Unified Observability & Auditability** so every agent action is traceable, priced, and provable.
2. **Adaptive Runtime Intelligence** so Overmind/LiteBrain/LiteLLM cooperate autonomously while staying within policy and budget.
3. **Governed Scale & Ecosystem** so Goblin “guilds” can extend the system safely via plugins, workflows, and marketplace assets.

This plan replaces the legacy “weeks 1–40” roadmap with an outcome-driven view grounded in what already shipped (P0/P1) and what is in-flight for the next two quarters.

## Execution Phases & Status

| Phase | Focus | Key Deliverables | Owner | Status |
| --- | --- | --- | --- | --- |
| **P0 – Platform Baseline** | CLI stability, package health, repo hygiene | `goblin doctor`, pnpm/vitest CI green, dependency governance | GoblinOS Core | ✅ Completed (Oct 2024) |
| **P1 – Observability & Audit Spine** | OTEL instrumentation, collector stack, tamper-evident logs | SDK instrumentation, Helm chart (`infra/charts/otel-collector`), audit anchor service | Platform + Infra + Security | ⏳ In flight (Target: Jan 2025) |
| **P2 – Runtime Intelligence** | Cost-aware orchestration, memory, model governance | Goblin Runtime spans & metrics, LiteBrain tracing, provider cost enforcement | Overmind + Runtime squads | 🔜 Next |
| **P3 – Governance & Fleet Scale** | Policy engine, workload isolation, GitOps delivery | Policy-as-code, multi-cluster rollout playbooks, resilience drills | Platform + SRE | 🗓 Planned |
| **P4 – Ecosystem & Launch** | Marketplace, plugin SDK, customer onboarding | Plugin registry, adoption playbook, billing hooks, telemetry-backed KPIs | Product & DX | 🗓 Planned |

Detailed acceptance tests live in `Obsidian/📋 Projects/GoblinOS/Smithy_Revamp.md`.

---

## Current State (Dec 2024)

### Strengths
- TypeScript monorepo with pnpm workspaces, Vitest, Biome, Ruff, and automated dependency updates.
- Overmind & LiteBrain already expose OTEL helpers (`packages/goblins/overmind/observability`) and cost tracking primitives.
- Security posture: signed npm releases, CodeQL, Scorecard, SBOM, Renovate, guardrail docs.
- Agents (CLI + runtime) already integrate with LiteLLM, Supabase, and local Ollama.

### Gaps
- OTEL SDKs are not loaded early in entry points; Goblin Runtime + LiteBrain lack parent spans/metrics.
- No production-grade collector or storage—telemetry proof-of-concept lives in `tools/telemetry`.
- Audit service scripts exist but are not anchored to public chains nor wired to runtime events.
- Runtime intelligence (routing, cost governance, memory privacy) is semi-manual.
- Fleet-level governance (policy enforcement, drift detection, multi-cluster rollout) undefined.
- Marketplace/plugins not yet defined; adoption blocked by missing telemetry guarantees.

---

## Phase 1 — Observability & Audit Spine
**Goal:** Trace any request from Overmind → Goblin Runtime → LiteBrain → model API, attach cost, and emit signed audit events in <60 s.

### 1. Instrumentation Coverage
- **Overmind & CLI:** Ensure `initTracing` loads before Express/WS, propagate baggage (`goblin.id`, `task.id`). Extend `@goblinos/providers` to pass `traceparent` to LiteLLM/LiteBrain (`packages/goblins/providers/src/client.ts`).
- **Goblin Runtime:** Wrap REST/WebSocket routes and `OrchestrationExecutor` spans; expose `/metrics` (Prometheus). Emit `goblin_task_latency_seconds`, `goblin_cost_usd_total`.
- **LiteBrain (FastAPI):** Add OTEL FastAPI instrumentation; record Supabase/market-data calls. Expose `/metrics` with FastAPIInstrumentator.
- **Model Clients:** Keep existing `createLLMSpan`; ensure fallback spans link to parent and record `llm.cost`, `llm.tokens.total`.

### 2. Collector & Storage
- **Helm chart (`infra/charts/otel-collector`):** Deploy DaemonSet agents + central deployment with mTLS + optional API key. Exporters: Tempo (traces), Loki (logs), Prometheus remote write (metrics), S3/file for audit envelopes.
- **Kubernetes Rollout:** `observability` namespace in `forge-staging` first, then `forge-prod`. NetworkPolicy restricts OTLP ingress to telemetry-enabled namespaces. Provide `make deploy-otel STAGE=...`.
- **Grafana Stack:** Tempo/Loki/Prometheus dashboards: service map, model cost breakdown, goblin activity, audit anchor health.

### 3. Tamper-Evident Audit
- **Audit Emitter Libraries:** `@goblinos/audit-emitter` (Node) + `goblin_audit` (Python) sign `{goblin_id, action, decision, trace_id}` using ed25519 keys from Vault/KMS.
- **Aggregator Service:** Receives OTLP logs, verifies signatures, appends to S3 Object Lock bucket `goblinos-audit-prod`, writes hourly Merkle root anchored via OpenTimestamp (daily) + Ethereum Sepolia (weekly). Includes verification CLI + nightly job.
- **Key Management:** Key rotation scripts (`tools/telemetry/key_rotation.py`), IRSA roles for signer pods, Vault policies.

### 4. Success Metrics
- ≥99 % of user requests traced end-to-end with model latency + cost attributes (P95 ingestion <30 s).
- Audit verification job detects tampering within 60 min; anchor hash published to Grafana.
- Telemetry sampling ≥20 % for prod steady state; error traces always kept.

---

## Phase 2 — Runtime Intelligence (Q1 → Q2 2025)

**Objective:** Convert telemetry into autonomous behavior and enforce resource/cost policies.

1. **Adaptive Orchestration**
   - Span-aware task graphs; propagate cost ceilings per goblin/task.
   - Feedback loop: `CostTracker` streams metrics to Prometheus; policy engine throttles expensive models.
2. **Memory & Privacy**
   - Encrypt working/long-term memory stores; add privacy filters before persistence.
   - Observability hooks to flag PII leaks.
3. **Model Governance**
   - Routing policies keyed by latency/cost/perf SLOs.
   - Automatic rollback/fallback if provider error rate > threshold.
4. **Acceptance Criteria**
   - 95 % of tasks respect per-goblin cost envelopes; policy violations alert within 2 min.
   - Memory writes include audit events referencing approval trace.

---

## Phase 3 — Governance & Fleet Scale

- **Policy-as-Code:** Declarative guardrails (OPA/TypeScript) enforced in runtime + CLI.
- **Multi-Cluster Rollout:** GitOps playbooks for staging/prod clusters, DR simulation, chaos drills.
- **Reliability:** SLO dashboards + alerting, failover tests for collector/audit stack, automated key rotation.
- **Compliance:** SOC2-ready evidence via Grafana/Loki dashboards and audit anchors.

_Exit criteria:_ zero-trust posture (mTLS everywhere, SPIFFE IDs), weekly chaos exercises, on-call runbook coverage.

---

## Phase 4 — Ecosystem & Launch

- **Plugin SDK:** Stable APIs, sandboxing, test harness, publishing workflow.
- **Marketplace:** Registry + UI inside GoblinHub to discover/install plugins/workflows.
- **Adoption Toolkit:** Customer onboarding docs, telemetry-backed KPIs, billing integration, case studies.
- **DX Enhancements:** Conversational UI for Overmind, RAG-powered knowledge center, accessibility pass.

_Exit criteria:_ 3 lighthouse customers running production automations, ≥10 marketplace plugins, telemetry SLOs met for 2 consecutive quarters.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Collector or audit stack under-provisioned | Trace drops, compliance risk | Capacity tests in staging, autoscaling, dual-export to Grafana Cloud |
| Key management mistakes | Signed audit gaps | Enforce KMS/Vault issuance, automate rotation tests |
| Agent regressions during instrumentation | Runtime instability | Feature flags per service, golden signal dashboards, incremental rollout |
| Scope creep in Phase 2+ | Delayed launch | Gate every phase behind SLO/SLA reviews; freeze scope once instrumentation meets targets |

---

## Call to Action
1. **Platform/Infra:** Finish deploying the OTEL Helm chart in staging, wire Grafana dashboards, and publish runbook.
2. **Service Owners:** Adopt OTEL SDK bootstrap + `/metrics` endpoints; emit cost attributes this sprint.
3. **Security:** Finalize audit aggregator design and kick off key provisioning.

Once Phase 1 exits, we’ll revisit this plan, lock Phase 2 scope, and publish the launch readiness scorecard. Stay ruthless about observable, auditable automation.***
