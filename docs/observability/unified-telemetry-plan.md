---
description: "unified-telemetry-plan"
---

# GoblinOS Unified Telemetry & Audit Plan

Goal: trace every GoblinOS request end-to-end (Overmind → Goblin Runtime → LiteBrain → model providers) while emitting signed audit events for each decision. This plan consolidates the OpenTelemetry stack, collector topology, and tamper-evident logging so implementation can be split across teams without ambiguity.

---

## 1. Scope & Success Criteria

| Area | Needs | Success Signal |
| --- | --- | --- |
| Distributed tracing | Span continuity across HTTP, WS, background jobs, and model calls | Tempo shows complete traces with Goblin, task, model, cost attributes |
| Metrics | P90 latency + cost-per-goblin, per-provider error rates | Prometheus dashboards stay green, alerts wired via Alertmanager |
| Logs | Structured, trace-correlated logs with Goblin + request IDs | Loki queries jump from trace to logs |
| Audit trail | Signed, append-only log that records “Goblin X approved Y” | Daily Merkle root anchored externally; tamper diff detectable within 1h |

Non-goals: historical backfill, UI redesign for dashboards, or swapping providers.

---

## 1.1 Goals, Success Metrics & Acceptance Criteria

| Goal | Metric / Acceptance Criteria | Owner |
| --- | --- | --- |
| End-to-end trace coverage | ≥99 % of Overmind-originated user requests emit a single trace ID that spans Overmind → Goblin Runtime → LiteBrain → provider within 60 s of request completion; missing-trace alert fires if coverage drops below 97 % for 5 min. | Overmind, Runtime, LiteBrain |
| Trace ingestion latency | P95 OTLP ingestion-to-Tempo availability < 30 s; P99 < 60 s, measured via synthetic spans sent every minute. | Infra |
| Cost & latency enrichment | 100 % of model-call spans populate `llm.latency`, `llm.tokens.total`, and `llm.cost`; discrepancy >5 % vs CostTracker raises PagerDuty warning. | Providers squad |
| Metrics freshness | Prometheus scrape/remote-write lag < 20 s (P95) per service; `/metrics` endpoints expose `goblin_task_latency_seconds` histogram with samples in last 5 min. | Service owners |
| Audit immutability | Audit aggregator verifies signatures and stores events in S3 Object Lock with hourly Merkle roots anchored to OpenTimestamp; automatic job replays prior hour and fails pipeline if computed root mismatches anchored hash. | Security |
| SLO compliance | Quarterly SLO: ≥99.5 % of user requests have both trace + audit event available within 2 min; error budget policy triggers instrumentation freeze if breached. | Observability steering group |

Acceptance tests:
1. Synthetic request through staging verifies trace contains model span with latency/cost and shows in Grafana < 1 min.
2. Chaos test killing collector pod keeps SLO (due to buffering) and raises alert.
3. Tamper attempt (manual S3 object overwrite) is blocked; verification CLI detects mismatch against anchored Merkle root within 60 min.

---

## 2. Current State Assessment

- Overmind already wraps the bridge with an OTEL SDK helper (`initTracing`) but does not load it early in every entry point nor propagate baggage to downstream calls (`GoblinOS/packages/goblins/overmind/observability/tracing.ts:1`).
- Provider wrappers instrument individual LLM calls via `createLLMSpan` and `recordProviderMetrics`, yet spans are detached when the runtime server executes work because Express routes never start parent spans (`GoblinOS/packages/goblins/providers/src/client.ts:35` and `GoblinOS/packages/goblins/providers/src/telemetry.ts:1`).
- The Goblin Runtime API lacks any tracing or metrics hooks despite being the orchestration hub (`GoblinOS/packages/goblin-runtime/src/server.ts:1`).
- LiteBrain (FastAPI) exposes `/risk` and `/market` routers without instrumentation, so traces disappear once traffic leaves Node (`apps/forge-lite/api/main.py:1`).
- Cost tracking is in-memory only (`GoblinOS/packages/goblin-runtime/src/cost-tracker.ts:1`), which makes it hard to correlate spend with traces or persist audit evidence.

---

## 3. Proposed Architecture

### 3.1 Instrumentation Layers

| Layer | Tactic | Notes |
| --- | --- | --- |
| Overmind bridge & orchestrator (Node) | Load `initTracing` before Express app creation; add middleware to inject trace IDs into Goblin tasks; wrap `GoblinRuntime.executeTask` with spans containing goblinId, guild, task hash | Wire baggage keys (`goblin.id`, `request.id`) so downstream services can enrich logs |
| Goblin Runtime | Add OTEL SDK bootstrap similar to Overmind; instrument REST routes, WebSocket lifecycle, and orchestration executor spans (plan parse, step execution, provider call) | Export Prometheus metrics (latency histograms, task counts) via OTEL metric SDK or `prom-client` scraped by Collector |
| LiteBrain FastAPI | Use `opentelemetry-instrumentation-fastapi` + manual spans in `market.py` for each upstream data fetch; emit metrics via OTEL SDK or Prometheus `FastAPIInstrumentator` | Baggage from headers persists so Tempo shows Python spans |
| Provider clients | Keep existing spans but attach traceparent header to LiteLLM/LLM calls; ensure fallback chain spans are nested | Add span links when retries occur to keep timeline comprehensible |
| Model gateways / external APIs | If they support OTLP, forward; otherwise record attributes (HTTP status, latency) in spans |

### 3.2 Collector & Backend

```
Services  →  OTLP/HTTP  →  OTel Collector  ─┬─ Tempo (traces)
                                             ├─ Loki (logs)
                                             ├─ Prometheus remote_write (metrics) / Thanos
                                             └─ Audit Anchor Service (signed logs)
```

- **Collector**: deploy as DaemonSet (k8s) or sidecar on bare metal. Receivers: OTLP/gRPC + OTLP/HTTP. Processors: batch, resource detection (k8s), tail-sampling (keep error traces, sample 10% success). Exporters:
  - Tempo HTTP (traces)
  - Loki via `loki` exporter for structured JSON logs (each log carries `trace_id` and `span_id`)
  - Prometheus OTLP → Prometheus remote write (metrics)
  - Azure/AWS immutable bucket exporter for audit envelopes (see §3.4)

- **Backends strategy**:
  - **Phase 0–1 (PoC/Staging)**: self-hosted Grafana stack (Tempo + Loki + Prometheus + Grafana) in `forge-staging`/`forge-prod` clusters to keep data residency and cost control while validating retention + performance. This is the default path described in the remainder of this plan.
  - **Optional Phase 2**: dual-stream traces/logs/metrics to Grafana Cloud (or Honeycomb) using OTEL Collector exporters once we need higher-cardinality queries or longer retention without managing storage. Keep self-hosted stack authoritative for compliance/audit evidence and failover capability. Decision checkpoint after 2 sprints of production load.

### 3.3 Dashboards & Alerts

1. **Service Overview** – request rate, error %, latency (Prometheus).
2. **Trace Dependency Map** – Tempo + Grafana node graph showing Overmind → Runtime → LiteBrain → Provider.
3. **Model Cost Breakdown** – uses CostTracker metrics (per provider/model/goblin) and `llm.cost` span attributes.
4. **Goblin Activity** – Loki dashboard keyed by goblinId, includes audit outcome and link to associated trace.

Alert hooks:
- Tempo tail-sampling triggers webhook for missing spans >90s.
- Prometheus alerts for `llm_cost_per_minute` spikes, latency p95, and audit signer failures.

### 3.4 Tamper-Evident Audit Log

Architecture:
1. **Audit Emitter** library (Node + Python) signs each decision event with the Goblin’s private key (ed25519). Event schema: `{event_id, goblin_id, role, action, target, decision, trace_id, timestamp, signature}`.
2. **Audit Aggregator** (new service) receives OTLP log records from Collector, verifies signatures, appends to an immutable object store (S3 + Object Lock or Azure Blob immutable container).
3. Every 15 minutes the aggregator computes a Merkle tree root over new events, writes the root to:
   - A lightweight Cosmos DB / DynamoDB table storing `{root_hash, time_range, prev_hash}`
   - An external anchor (e.g., OpenTimestamp or Ethereum calldata via inexpensive rollup) for non-repudiation.
4. Metadata about the anchor transaction is written back to Loki/Grafana for operator visibility.

Implementation detail: reuse Collector `filelog` exporter to tee audit events to disk for local dev; production uses S3 Object Lock in compliance mode.

---

## 4. Actionable Implementation Plan

| Phase | Owner | Tasks |
| --- | --- | --- |
| 0. Bootstrap | Platform (Infra + SRE) | **Decision**: target the existing EKS cluster (`forge-prod`) so Collector/Grafana run as Helm releases. a) Add `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `TELEMETRY_ENABLED` to `.env.example` and deployment charts. b) Publish Helm values + kustomize overlays for Collector + Grafana namespace (`observability`). c) Provide port-forward scripts for local testing. |
| 1. Overmind & Runtime | Overmind squad (owner: Priya) | a) Import `initTracing` at the top of every bridge/server entry point and ensure Express + WS servers call it before middleware (`GoblinOS/packages/goblin-runtime/src/server.ts`). b) Create middleware that starts a parent span per REST request, attaches goblin + request IDs to `res.locals`, and emits structured logs to Winston/pino with `trace_id`. c) Instrument `OrchestrationExecutor` to create spans for parse/execute/step. |
| 2. Provider & Cost instrumentation | Providers & Runtime tools squad (owner: Malik) | a) Ensure `createLLMSpan` attaches `traceparent` header when calling LiteLLM/OpenAI (`GoblinOS/packages/goblins/providers/src/client.ts`). b) Emit Prometheus gauges from `CostTracker` (`GoblinOS/packages/goblin-runtime/src/cost-tracker.ts`) and expose `/metrics`. c) Add OTEL metric exporter inside provider spans (tokens, cost, retries). |
| 3. LiteBrain (FastAPI) | LiteBrain team (owner: Aditi) | a) Add OTEL FastAPI middleware (`apps/forge-lite/api/main.py`) and instrument `market.py` external calls with span attributes for upstream API latency. b) Expose `/metrics` via Prometheus FastAPI instrumentator; configure Collector scrape. |
| 4. Collector & Grafana | Infra Observability guild (owner: Tanner) | a) Create `infra/observability` Helm chart (Tempo, Loki, Prometheus, Grafana, OTEL Collector). b) Provide Terraform module for immutable bucket + KMS-managed keys. c) Configure Grafana dashboards + alerts committed to `infra/grafana/dashboards/*.json`. |
| 5. Audit service | Security & Compliance (owner: Farah) | a) Ship `@goblinos/audit-emitter` (Node) and `goblin_audit` (Python) packages with key management & signing. b) Build aggregator microservice (FastAPI or Node) that receives signed OTLP log records, verifies, writes to WORM storage, and publishes Merkle root anchors. c) Provide verification CLI to recalc proofs. |
| 6. Rollout | Program leads (Priya + Malik + Aditi + Farah) | a) Enable in staging with aggressive sampling + debug logging. b) Run failure drills (broken collector, invalid signature). c) Flip production flags, lower sampling to 20%, monitor costs, and document operational runbooks. |

Dependencies: Collector infra (Phase 4) must exist before phases 1–3 enable OTLP export; audit storage requires infra bucket + KMS keys.

---

## 5. Configuration & Deployment Checklist

- **Env vars** (per service)
  - `OTEL_EXPORTER_OTLP_ENDPOINT`
  - `OTEL_RESOURCE_ATTRIBUTES=service.name=...,deployment.environment=...`
  - `TELEMETRY_ENABLED=true`
  - `AUDIT_SIGNING_KEY_PATH` (Node) / `AUDIT_SIGNING_KEY_ID` (Python)
- **Ports**
  - 4317 gRPC / 4318 HTTP for OTLP
  - 9464/9465 for Prometheus scrapes (Node vs Python)
- **Security**
  - Rotate signing keys quarterly; store in Vault or AWS KMS (asymmetric). Goblins receive short-lived signing certs minted via Vault role tied to goblin identity.
  - Collector authenticates exporters via mTLS (SPIFFE IDs) once services move out of trusted cluster.
- **CI/CD**
  - Add telemetry smoke test (`pnpm telemetry:check` analog) verifying spans reach a local collector in CI.
  - Include audit verification in nightly job: download last Merkle root, replay events, confirm anchor hash.

---

## 6. Open Questions / Next Steps

1. **Trace context in Goblin CLI invocations** – confirm CLI → runtime handoff can inject `traceparent`. If not, add CLI flag to emit new root spans.
2. **Data retention** – define Tempo/Loki retention (e.g., 7d hot, 30d warm) and archive policy for audit logs (WORM 1 year).
3. **Cost of Merkle anchors** – choose anchoring cadence & chain (OpenTimestamp vs Ethereum Sepolia). Estimate cost in infra budget doc.
4. **High-cardinality tags** – watch cardinality explosion from `goblin_id` and `task_hash`; may need attribute whitelists or exemplars-only export to SaaS backend.

---

Deliverable owners can now pick up respective tasks; once the Collector chart merges we can start instrumenting services incrementally without blocking on the audit path.

---

## 7. Phase 0 Decisions & Provisioning Checklist

**Environment decision:** We will deploy the initial Collector + Grafana stack to the existing `forge-prod` Amazon EKS cluster rather than bare metal. Rationale: shared VPC networking already whitelists outbound traffic to Grafana Cloud, IAM roles for service accounts are in place, and DaemonSets allow us to scrape node metrics without extra agents. Bare metal would require separate automation and secrets distribution, so EKS keeps day-2 ops consistent.

**Provisioning steps (Infra/SRE):**
1. Stand up the same stack in `forge-staging` first for PoC burn-in; once telemetry sampling + storage sizing are validated, replicate to `forge-prod`.
2. Create namespace `observability` in each cluster and grant IRSA roles `otel-collector-role`, `tempo-role`, `loki-role`, `prom-role`.
2. Ship Helm umbrella chart under `infra/observability` with subcharts:
   - `otel-collector` (Receivers: OTLP gRPC/HTTP, Prometheus; Exporters: Tempo, Loki, Prometheus remote_write, file exporter for local dev.)
   - `tempo-distributed`, `loki-distributed`, `kube-prometheus-stack`, `grafana`.
3. Configure `OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-collector.observability.svc:4318` and corresponding gRPC endpoint; include this in `.env.example` + deployment templates (Overmind, Runtime, LiteBrain).
4. Enable `NetworkPolicy` so only cluster workloads can reach the collector; expose Grafana via existing ingress with Okta auth.
5. Leave OTEL Collector exporters for Grafana Cloud commented but templated; flip them on via values file if/when SaaS dual-export is approved.

**Audit anchor choice:** Use **OpenTimestamp** for primary anchoring (low cost, automatic Bitcoin anchoring) with a weekly secondary anchor on **Ethereum Sepolia** executed by the audit aggregator. This provides cheap daily attestations and a redundant public-chain proof.

**Immutable storage + KMS:**
1. AWS S3 bucket `goblinos-audit-prod` with Object Lock in Compliance mode (retention 400 days). Versioning + default encryption (SSE-KMS).
2. KMS CMK alias `alias/goblinos/audit` (asymmetric signing + decrypt for key-wrapping). Grant IAM role `audit-aggregator-role` permissions to sign and encrypt.
3. Terraform module (Phase 4b) outputs bucket ARN, KMS ARN, and necessary IAM policies for collector → aggregator and aggregator → storage flows.
4. Document bucket/KMS IDs inside `infra/observability/README.md` and wire them into the audit aggregator deployment manifests.

---

## 8. Phase 1 — Core Infra & Collector TODOs

> Objective: stand up OpenTelemetry Collector on Kubernetes with node-level DaemonSet for scraping/emitting and a central deployment for batching/exporting, secured via mTLS (SPIFFE) and optional API key fallback.

### 8.1 Deliverables Checklist

1. **Manifests & Helm values**
   - [ ] `infra/observability/helm/otel-collector/templates/daemonset.yaml` for node agents (receivers: hostmetrics, kubeletstats, OTLP; exporters: OTLP to central service).
   - [ ] `infra/observability/helm/otel-collector/templates/deployment.yaml` for central collector (receivers: OTLP gRPC/HTTP, Prometheus remote write queue; exporters: Tempo, Loki, Prometheus, S3 audit).
   - [ ] `values.staging.yaml` + `values.prod.yaml` capturing resource requests, sampling, and exporter endpoints.

2. **Security hardening**
   - [ ] Generate SPIFFE-compatible certificates via cert-manager `Issuer` and mount through projected volume; configure collectors to require TLS + client cert auth on OTLP listeners.
   - [ ] Provide fallback API key auth by enabling `basicauth` extension with keys stored in Kubernetes secrets (`otel-collector-api-key`).
   - [ ] Lock down DaemonSet ServiceAccount with least-privilege RBAC (read nodes/pods, write to ConfigMaps if needed) and enable `seccompProfile: RuntimeDefault`.

3. **Networking**
   - [ ] Add `NetworkPolicy` that permits OTLP ingress only from namespaces labeled `telemetry-enabled=true`.
   - [ ] Configure `Service` objects: `otel-collector-daemon` (ClusterIP for node agents) and `otel-collector` (LoadBalancer/NLB for cross-cluster export, TLS termination on pod).

4. **Config snippets**
   - [ ] DaemonSet `otel-config-daemon.yaml`:
     ```yaml
     receivers:
       otlp:
         protocols:
           grpc: { endpoint: 0.0.0.0:4317, tls: { cert_file: /certs/tls.crt, key_file: /certs/tls.key, ca_file: /certs/ca.crt, require_client_cert: true } }
           http: { endpoint: 0.0.0.0:4318, tls: { ... } }
     exporters:
       otlp:
         endpoint: otel-collector.observability.svc:55680
         headers: { "x-api-key": ${OTEL_API_KEY} }
     service:
       pipelines:
         traces:
           receivers: [otlp]
           exporters: [otlp]
     ```
   - [ ] Central collector `otel-config-central.yaml` enabling batch + tail_sampling processors, exporters to Tempo/Loki/Prometheus/S3.

5. **Automation**
   - [ ] GitHub Actions workflow `infra/observability/.github/workflows/otel-collector-ci.yml` that template-renders manifests, runs `kubeconform`, and executes `helm lint`.
   - [ ] `make deploy-otel STAGE=staging|prod` wrapper invoking `helm upgrade --install`.

6. **Verification**
   - [ ] Synthetic trace job (`kubectl run otel-probe --env OTEL_EXPORTER_OTLP_ENDPOINT=...`) validates ingestion + TLS handshake.
   - [ ] Observability runbook updated with `kubectl port-forward svc/otel-collector 4318` instructions and troubleshooting steps (certificate rotation, API key rotation).
   - [ ] Alert in Prometheus: `otel_collector_accepted_spans` absence >5m triggers warning.
