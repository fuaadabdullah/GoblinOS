#!/usr/bin/env bash
set -e
ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT_DIR"

echo "=== Integration Test: Full PoC End-to-End ==="

# Clean up any existing processes on test ports
echo "Cleaning up existing processes..."
for port in 19001 18001 17000; do
  EXISTING_PID=$(lsof -i :$port -t 2>/dev/null || true)
  if [ -n "$EXISTING_PID" ]; then
    echo "Killing process on port $port: $EXISTING_PID"
    kill -9 $EXISTING_PID 2>/dev/null || true
  fi
done

# Set test environment with different ports
export SECRET_KEY_BASE64="Vn25s4tnrbRBtOUxpCjvdSdCIkRcOHIAsS+4i0+YuI/9lyAJM4ED7L/M9/Dw7t3hYHrVT1uM9NlpH9jaR/CUvQ=="
export PUBKEY_BASE64="/ZcgCTOBA+y/zPfw8O7d4WB61U9bjPTZaR/Y2kfwlL0="
export NODE_ENV="test"
export AUDIT_URL="http://localhost:19001/audit"
export LITEBRAIN_URL="http://localhost:18001"

# Start services in background with different ports
echo "Starting audit service on port 19001..."
PORT=19001 python3 audit/audit_service.py &
AUDIT_PID=$!
echo "Audit service PID=$AUDIT_PID"

echo "Starting LiteBrain on port 18001..."
cd litebrain
python3 -m venv .venv 2>/dev/null || true
source .venv/bin/activate
pip install -r requirements.txt >/dev/null 2>&1
uvicorn app:app --port 18001 &
LITE_PID=$!
cd ..

echo "Starting Overmind on port 17000..."
cd overmind
npm install >/dev/null 2>&1 || true
PORT=17000 node server.js &
OVERMIND_PID=$!
cd ..

# Wait for services to start
echo "Waiting for services to start..."
sleep 5

# Test 1: Trigger audit event via Overmind
echo "Test 1: Triggering audit event via Overmind..."
RESPONSE=$(curl -s 'http://localhost:17000/question?input=integration_test')
if [[ "$RESPONSE" == *"signature OK"* ]]; then
    echo "✓ Overmind audit event triggered and verified"
else
    echo "✗ Overmind audit event failed: $RESPONSE"
    exit 1
fi

# Test 2: Check audit events were logged
echo "Test 2: Checking audit events were logged..."
EVENT_COUNT=$(wc -l < audit/audit_events.jsonl)
if [ "$EVENT_COUNT" -gt 0 ]; then
    echo "✓ $EVENT_COUNT audit events logged"
else
    echo "✗ No audit events logged"
    exit 1
fi

# Test 3: Verify last event with Python verifier
echo "Test 3: Verifying last audit event..."
LAST_EVENT=$(tail -1 audit/audit_events.jsonl)
echo "$LAST_EVENT" | python3 audit/verify_event.py --stdin
if [ $? -eq 0 ]; then
    echo "✓ Last audit event verified successfully"
else
    echo "✗ Last audit event verification failed"
    exit 1
fi

# Test 4: Test tamper detection
echo "Test 4: Testing tamper detection..."
TAMPERED_EVENT=$(echo "$LAST_EVENT" | sed 's/"action":"question"/"action":"tampered"/')
echo "$TAMPERED_EVENT" | python3 audit/verify_event.py --stdin 2>/dev/null && {
    echo "✗ Tampered event was incorrectly accepted"
    exit 1
} || echo "✓ Tampered event correctly rejected"

# Cleanup
echo "Cleaning up..."
kill $OVERMIND_PID $LITE_PID $AUDIT_PID 2>/dev/null || true
rm -f audit/audit_events.jsonl

echo "=== Integration Test PASSED ==="
