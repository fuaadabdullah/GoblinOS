#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT_DIR"

echo "Triggering Overmind /question..."
resp=$(curl -sS -w "\nHTTP_STATUS:%{http_code}\n" "http://localhost:7000/question?input=hello" ) || true
echo "$resp"

echo "Waiting briefly for audit service to flush..."
sleep 0.5

if [ -f litebrain/.venv/bin/activate ]; then
  source litebrain/.venv/bin/activate
fi

python audit/verify_event.py audit/audit_events.jsonl && echo "E2E: signature OK" || (echo "E2E: signature FAILED" && exit 2)
