#!/bin/bash
# Test API Keys Configuration

echo "🔑 API Keys Status Check"
echo "========================"
echo

cd /Users/fuaadabdullah/ForgeMonorepo/GoblinOS

# Load .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Loaded .env file"
else
    echo "❌ .env file not found"
    exit 1
fi

# Check each key
echo
echo "📋 Configured Keys:"
echo

if [ -n "$GEMINI_API_KEY" ]; then
    echo "✅ GEMINI_API_KEY: ${GEMINI_API_KEY:0:20}..."
else
    echo "❌ GEMINI_API_KEY: Not set"
fi

if [ -n "$OPENAI_API_KEY" ]; then
    echo "✅ OPENAI_API_KEY: ${OPENAI_API_KEY:0:20}..."
else
    echo "❌ OPENAI_API_KEY: Not set"
fi

if [ -n "$DEEPSEEK_API_KEY" ]; then
    echo "✅ DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:0:20}..."
else
    echo "❌ DEEPSEEK_API_KEY: Not set"
fi

echo
echo "🧪 Testing API connectivity..."
echo

# Test OpenAI API
if [ -n "$OPENAI_API_KEY" ]; then
    echo -n "OpenAI API: "
    response=$(curl -s -w "%{http_code}" -o /dev/null \
        https://api.openai.com/v1/models \
        -H "Authorization: Bearer $OPENAI_API_KEY")

    if [ "$response" = "200" ]; then
        echo "✅ Connected (Status: $response)"
    else
        echo "⚠️  HTTP $response (Key may be invalid or rate limited)"
    fi
fi

# Test Gemini API
if [ -n "$GEMINI_API_KEY" ]; then
    echo -n "Gemini API: "
    response=$(curl -s -w "%{http_code}" -o /dev/null \
        "https://generativelanguage.googleapis.com/v1/models?key=$GEMINI_API_KEY")

    if [ "$response" = "200" ]; then
        echo "✅ Connected (Status: $response)"
    else
        echo "⚠️  HTTP $response (Key may be invalid)"
    fi
fi

echo
echo "📦 Starting Runtime Server with API Keys..."
echo

# Export keys for the server
export GEMINI_API_KEY
export OPENAI_API_KEY
export DEEPSEEK_API_KEY

# Start server in background
cd packages/goblin-runtime
node dist/server.js &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"
sleep 3

# Test server health
echo
echo -n "Server Health Check: "
health=$(curl -s http://localhost:3001/api/health)
if echo "$health" | grep -q "ok"; then
    echo "✅ Server is running"
    echo "$health" | jq '.'
else
    echo "❌ Server not responding"
fi

echo
echo "🎯 To test with a real AI call, try:"
echo "   curl -X POST http://localhost:3001/api/execute \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"goblinId\": \"test\", \"task\": \"Say hello\", \"provider\": \"gemini\"}'"
echo
echo "Press Ctrl+C to stop the server"

# Keep script running
wait $SERVER_PID
