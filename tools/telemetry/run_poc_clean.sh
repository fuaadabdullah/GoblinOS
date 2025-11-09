#!/usr/bin/env bash
echo "run_poc_clean.sh neutralized; use run_poc.sh instead"
exit 0

set -e
ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
#!/usr/bin/env bash
set -e
ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT_DIR"

echo "Starting OTEL Collector (you must have otelcol-contrib installed)..."
if command -v otelcol-contrib >/dev/null 2>&1; then
  otelcol-contrib --config collector-config.yaml &
  OTEL_PID=$!
  echo "Collector PID=$OTEL_PID"
else
  echo "otelcol-contrib not found; please install or run collector via Docker. Continuing without collector..."
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
python3 audit/audit_service.py &
AUDIT_PID=$!
echo "Audit service PID=$AUDIT_PID"

# Start LiteBrain
cd litebrain
python3 -m venv .venv || true
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --port 8001 &
LITE_PID=$!

# Start Overmind using the clean server file
cd ../overmind
# Use pnpm or npm to install if needed
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --silent || true
else
  npm install --silent || true
fi
node server.clean.js &
OVERMIND_PID=$!

echo "Started services. Overmind PID=$OVERMIND_PID, LiteBrain PID=$LITE_PID, Audit PID=$AUDIT_PID"

echo "Run: curl 'http://localhost:7000/question?input=hello' to trigger PoC"

echo "To stop: kill $OVERMIND_PID $LITE_PID $AUDIT_PID ${OTEL_PID:-}"
