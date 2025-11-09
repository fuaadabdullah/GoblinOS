#!/usr/bin/env bash
set -e
ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT_DIR"

echo "Starting OTEL Collector..."
if command -v docker >/dev/null 2>&1 && [ -f "docker-compose.yml" ]; then
  echo "Using Docker Compose for full tracing stack (Tempo + Zipkin + Prometheus)..."
  export TEMPO_ENDPOINT="http://tempo:4318"
  export ZIPKIN_ENDPOINT="http://zipkin:9411/api/v2/spans"
  docker-compose up -d otel-collector tempo zipkin prometheus
  echo "Tracing backends started:"
  echo "  - Tempo UI: http://localhost:3200"
  echo "  - Zipkin UI: http://localhost:9411"
  echo "  - Prometheus: http://localhost:9090"
elif command -v docker >/dev/null 2>&1; then
  echo "Using Docker for OTEL collector only..."
  docker run -d --name otel-collector-poc \
    -p 4317:4317 -p 4318:4318 -p 8888:8888 \
    -v "$ROOT_DIR/collector-config.yaml:/etc/otelcol-contrib/config.yaml" \
    otel/opentelemetry-collector-contrib:latest \
    --config /etc/otelcol-contrib/config.yaml
  OTEL_PID=$!
  echo "Collector container started"
else
  echo "Docker not found; please install Docker or otelcol-contrib. Continuing without collector..."
fi

# Free up audit port if a previous run left it bound
if command -v lsof >/dev/null 2>&1; then
  EXISTING_PID=$(lsof -i :9001 -t || true)
  if [ -n "$EXISTING_PID" ]; then
    echo "Killing existing process on port 9001: $EXISTING_PID"
    kill -9 $EXISTING_PID || true
  fi
fi

# Start audit service (python)
PORT=19001 python3 audit/audit_service.py &
AUDIT_PID=$!
echo "Audit service PID=$AUDIT_PID"

# Start audit query API (python)
PORT=18002 python3 audit_query_api.py --port 18002 &
QUERY_API_PID=$!
echo "Audit Query API PID=$QUERY_API_PID"

# Start LiteBrain
cd litebrain
python3 -m venv .venv || true
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --port 8001 &
LITE_PID=$!

# Set audit signing keys from env (PoC values)
export SECRET_KEY_BASE64="Vn25s4tnrbRBtOUxpCjvdSdCIkRcOHIAsS+4i0+YuI/9lyAJM4ED7L/M9/Dw7t3hYHrVT1uM9NlpH9jaR/CUvQ=="
export PUBKEY_BASE64="/ZcgCTOBA+y/zPfw8O7d4WB61U9bjPTZaR/Y2kfwlL0="

# Start Overmind
cd ../overmind
# Use pnpm or npm to install if needed
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --silent || true
else
  npm install --silent || true
fi
node server.js &
OVERMIND_PID=$!

echo "Started services. Overmind PID=$OVERMIND_PID, LiteBrain PID=$LITE_PID, Audit PID=$AUDIT_PID, Query API PID=$QUERY_API_PID"

echo "Run: curl 'http://localhost:17000/question?input=hello' to trigger PoC"

echo "Query audit logs: curl 'http://localhost:18002/query?actor=user&limit=5'"
echo "Get audit stats: curl 'http://localhost:18002/stats'"

echo "To stop: kill $OVERMIND_PID $LITE_PID $AUDIT_PID $QUERY_API_PID && docker-compose down 2>/dev/null || docker stop otel-collector-poc 2>/dev/null || true"
