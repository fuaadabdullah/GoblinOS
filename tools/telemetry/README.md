# Telemetry PoC - Integration Test

This folder contains a small PoC telemetry pipeline used for local integration testing. The integration test starts three local services (audit sink, LiteBrain, and Overmind) and verifies that Overmind emits a signed audit envelope which the audit sink stores.

## How to run

1. From the repository root run:

   ```bash
   cd GoblinOS/tools/telemetry
   ./integration_test.sh
   ```

2. The script will:

   - start a minimal audit service on port 19001
   - start LiteBrain (FastAPI) on port 18001
   - start Overmind (Node PoC) on port 17000
   - trigger a `/question` request to Overmind and assert the response contains a non-empty `audit_event.signature`
   - verify the last audit event with the Python verifier

## Required environment

The script exports defaults, but you can override:

- `SECRET_KEY_BASE64` - Ed25519 secret key (base64) used by Overmind to sign the audit envelope. The script exports a test key by default.
- `PUBKEY_BASE64` - Public key (base64) used by the audit verifier.
- `AUDIT_URL` - URL of the audit sink (default: `http://localhost:19001/audit`).
- `LITEBRAIN_URL` - URL of LiteBrain (default: `http://localhost:18001/process`).

## Notes

- The integration script is intentionally lightweight and for local PoC only. It spawns background processes and cleans them up on completion.
- If you hit races where Overmind cannot reach LiteBrain, increase the sleep in the script near the "Waiting for services to start" line.
- The repository may not allow the script to start services in constrained CI; run locally for reliable results.

If you'd like, I can prepare a PR that includes the updated test and this README — I can create a branch and commit locally, but pushing/creating a PR requires a working git remote from this environment.

## GoblinOS Telemetry & Audit System

A world-class unified telemetry and audit logging system for GoblinOS, featuring end-to-end tracing, non-repudiable audit logs, and comprehensive management tools.

## Features

### 🔐 Non-Repudiable Audit Logging
- Ed25519 digital signatures on all audit events
- Cross-language verification (Node.js ↔ Python)
- Deterministic JSON canonicalization
- Tamper detection with signature validation

### 📊 End-to-End Tracing
- OpenTelemetry SDK integration
- Multiple backend support (Tempo, Zipkin, Jaeger)
- Request tracing: Overmind → LiteBrain → Model API
- Cost/latency tracking in spans

### 🔑 Key Management & Rotation
- KMS integration (AWS KMS, Azure Key Vault)
- Automated key rotation
- Environment-only key loading (no repo secrets)

### 📁 Audit Log Management
- Configurable retention policies
- Automatic log compression
- Log rotation by size
- Cleanup of old entries

### 🔍 Audit Log Querying
- REST API for searching audit events
- Time range filtering
- Complex query support
- Pagination and sorting

## Quick Start

### 1. Full Stack with Docker Compose (Recommended)

```bash
# Start all services (OTEL collector, Tempo, Zipkin, Prometheus)
docker-compose up -d

# Set environment variables
export SECRET_KEY_BASE64="Vn25s4tnrbRBtOUxpCjvdSdCIkRcOHIAsS+4i0+YuI/9lyAJM4ED7L/M9/Dw7t3hYHrVT1uM9NlpH9jaR/CUvQ=="
export PUBKEY_BASE64="/ZcgCTOBA+y/zPfw8O7d4WB61U9bjPTZaR/Y2kfwlL0="

# Start GoblinOS services
./run_poc.sh
```

### 2. Manual Setup

```bash
# Install dependencies
cd overmind && npm install
cd ../litebrain && pip install -r requirements.txt

# Start individual services
PORT=19001 python3 audit/audit_service.py &          # Audit service
PORT=18002 python3 audit_query_api.py --port 18002 & # Query API
PORT=18001 uvicorn app:app --port 18001 &            # LiteBrain
PORT=17000 node server.js &                          # Overmind
```

## API Endpoints

### Overmind (Port 17000)
```bash
# Trigger audit event with tracing
curl 'http://localhost:17000/question?input=hello'
```

### Audit Query API (Port 18002)

#### Search Audit Events
```bash
# Get recent events
curl 'http://localhost:18002/query?limit=10'

# Filter by actor and action
curl 'http://localhost:18002/query?actor=user&action=login'

# Time range query
curl 'http://localhost:18002/query?from=2024-01-01T00:00:00&to=2024-12-31T23:59:59'

# Complex filters (JSON)
curl 'http://localhost:18002/query?context={"env":"prod"}'

# Pagination
curl 'http://localhost:18002/query?limit=50&offset=100&sort_by=timestamp&sort_order=desc'
```

#### Get Statistics
```bash
curl 'http://localhost:18002/stats'
```

## Configuration

### Environment Variables

#### Key Management
```bash
# Local development (PoC)
SECRET_KEY_BASE64="..."
PUBKEY_BASE64="..."

# Production KMS
KMS_PROVIDER="aws"  # or "azure"
KMS_KEY_ID="alias/goblinos-audit-key"
AWS_REGION="us-east-1"
AZURE_KEY_VAULT_NAME="goblinos-kv"
```

#### Audit Log Management
```bash
AUDIT_LOG_DIR="audit_logs"                    # Log directory
AUDIT_RETENTION_DAYS="90"                     # Keep logs for 90 days
AUDIT_COMPRESS_AFTER_DAYS="7"                 # Compress after 7 days
AUDIT_MAX_LOG_SIZE_MB="100"                   # Rotate at 100MB
```

#### Tracing
```bash
TEMPO_ENDPOINT="http://tempo:4318"            # Tempo OTLP endpoint
ZIPKIN_ENDPOINT="http://zipkin:9411/api/v2/spans"  # Zipkin endpoint
```

## Management Tools

### Key Rotation
```bash
# Check if rotation is needed
python3 key_rotation.py --check

# Rotate key
python3 key_rotation.py --rotate

# Show current key status
python3 key_rotation.py --status
```

### Audit Log Maintenance
```bash
# Run full maintenance
python3 audit_retention.py --maintenance

# Show statistics
python3 audit_retention.py --stats

# Manual operations
python3 audit_retention.py --cleanup-entries  # Remove old entries
python3 audit_retention.py --compress         # Compress old files
python3 audit_retention.py --rotate           # Rotate large files
```

### Verify Audit Events
```bash
# Verify single event
cat audit_event.json | python3 audit/verify_event.py --stdin

# Debug verification
DEBUG_AUDIT_BYTES=1 cat audit_event.json | python3 audit/verify_event.py --stdin --dump
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Overmind     │───▶│    LiteBrain    │───▶│   Model API     │
│   (Node.js)     │    │   (Python)      │    │                 │
│                 │    │                 │    │                 │
│ • OTEL tracing  │    │ • OTEL tracing  │    │ • Cost tracking │
│ • Audit events  │    │ • Audit events  │    │ • Latency       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────────┐
                    │  OTEL Collector │
                    │                 │
                    │ • Tempo         │
                    │ • Zipkin        │
                    │ • Prometheus    │
                    └─────────────────┘
                                  │
                    ┌─────────────────┐
                    │  Audit Service  │
                    │                 │
                    │ • Signed logs   │
                    │ • Verification  │
                    │ • Retention     │
                    └─────────────────┘
                                  │
                    ┌─────────────────┐
                    │ Query API       │
                    │                 │
                    │ • Search        │
                    │ • Filter        │
                    │ • Statistics    │
                    └─────────────────┘
```

## Security Features

### Audit Trail Integrity
- All audit events are cryptographically signed
- Signatures verified across language boundaries
- Deterministic JSON formatting prevents tampering
- Non-repudiable event chain

### Key Security
- Keys never stored in repository
- KMS integration for production
- Automated rotation policies
- Environment-only loading

### Data Protection
- Configurable retention policies
- Automatic compression of old logs
- Secure deletion of expired data
- Size-based log rotation

## Monitoring & Observability

### Tracing Backends
- **Tempo**: Jaeger-compatible distributed tracing
- **Zipkin**: Classic distributed tracing system
- **Prometheus**: Metrics collection and alerting

### Access UIs
- Tempo: http://localhost:3200
- Zipkin: http://localhost:9411
- Prometheus: http://localhost:9090

## Development

### Testing
```bash
# Node.js tests
cd overmind && npm test

# Python tests
cd audit && python -m pytest tests/ -v

# Integration test
./integration_test.sh
```

### Debugging
```bash
# Enable audit debug output
DEBUG_AUDIT_BYTES=1 ./run_poc.sh

# View collector logs
docker-compose logs otel-collector

# Check audit logs
tail -f audit_logs/audit_events.jsonl
```

## Production Deployment

1. **Configure KMS**
   ```bash
   export KMS_PROVIDER="aws"
   export KMS_KEY_ID="alias/goblinos-audit-key"
   ```

2. **Set retention policies**
   ```bash
   export AUDIT_RETENTION_DAYS="365"
   export AUDIT_COMPRESS_AFTER_DAYS="30"
   ```

3. **Deploy with Docker Compose**
   ```bash
   docker-compose -f docker-compose.yml up -d
   ```

4. **Set up monitoring**
   - Configure alerting on audit verification failures
   - Monitor key rotation events
   - Track log retention metrics

## Troubleshooting

### Common Issues

**"signature OK" not shown**
- Check that keys are properly set in environment
- Verify canonicalization matches between Node and Python

**No traces in Tempo/Zipkin**
- Ensure OTEL collector is running
- Check endpoint configuration
- Verify Docker networking

**Query API returns empty results**
- Check AUDIT_LOG_DIR environment variable
- Verify log files exist and are readable
- Check time range filters

**Key rotation fails**
- Verify KMS permissions
- Check KMS provider configuration
- Ensure key exists in KMS

## Contributing

1. Follow the existing code patterns
2. Add tests for new features
3. Update documentation
4. Ensure cross-language compatibility

## License

This project is part of GoblinOS and follows its licensing terms.
- `audit/` - Simple audit service and signer (Ed25519 PoC); verification CLI
- `run_poc.sh` - Simple script to start services locally (uses venv/npm as needed)

Quickstart (macOS, zsh):

1. Start the collector (in a terminal):

```bash
# run collector binary if you have it, or run with Docker / docker-compose
otelcol-contrib --config collector-config.yaml
```

2. Start LiteBrain (Python) in a virtualenv:

```bash
cd GoblinOS/tools/telemetry/litebrain
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --port 8001
```

3. Start Overmind (Node):

```bash
cd GoblinOS/tools/telemetry/overmind
pnpm install || npm install
node server.js
```

4. Trigger a request (from another terminal):

```bash
curl -sS "http://localhost:7000/question?input=hello" | jq
```

5. Check Collector logs (console exporter) to view spans and span attributes including `model.cost_usd`.
6. Check `audit/audit_events.jsonl` for signed audit events and use `audit/verify_event.py` to verify signature.

Notes:
- This is a minimal PoC for local development and testing. For production use follow the full plan (OTEL Collector DaemonSet, secure OTLP, Tempo/Loki/Prometheus, KMS for keys, Merkle anchoring for audit roots).

If you want, I can now start implementing the Node and Python services and the collector config in the repo. After that I'll run the local PoC here and report results.
