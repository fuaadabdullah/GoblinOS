# GoblinOS Hub - API Documentation

Complete API reference for the GoblinOS Runtime Server.

## Base URL
```
http://localhost:3001
```

## WebSocket
```
ws://localhost:3001/ws
```

---

## 📡 REST Endpoints

### Health & Status

#### GET /api/health
Check server health and initialization status.

**Response:**
```json
{
  "status": "healthy",
  "initialized": true,
  "timestamp": "2025-11-07T08:52:54.252Z"
}
```

---

### Goblins

#### GET /api/goblins
List all available goblins with their configuration and current status.

**Response:**
```json
[
  {
    "id": "websmith",
    "title": "Socketwright",
    "brain": {
      "local": ["llama3.2:latest"],
      "routers": ["deepseek-r1:latest"]
    },
    "responsibilities": [
      "Frontend architecture",
      "API integration",
      "Performance optimization"
    ],
    "guild": "forge-guild",
    "status": "ready"
  }
]
```

---

### Task Execution

#### POST /api/execute
Execute a task for a specific goblin.

**Request Body:**
```json
{
  "goblin": "websmith",
  "task": "Explain async/await in JavaScript",
  "context": {
    "userPreference": "detailed"
  }
}
```

**Response:**
```json
{
  "goblin": "websmith",
  "task": "Explain async/await in JavaScript",
  "response": "Async/await is syntactic sugar...",
  "reasoning": "Used educational tone because...",
  "kpis": {
    "response_time_ms": 1234,
    "tokens_used": 450
  },
  "timestamp": "2025-11-07T09:00:00.000Z",
  "duration_ms": 1234,
  "success": true
}
```

---

### History

#### GET /api/history/:goblin
Get task execution history for a specific goblin.

**Parameters:**
- `goblin` (path): Goblin ID
- `limit` (query, optional): Number of entries (default: 10)

**Example:**
```bash
GET /api/history/websmith?limit=50
```

**Response:**
```json
[
  {
    "id": "uuid-123",
    "goblin": "websmith",
    "task": "Build authentication flow",
    "response": "Here's the implementation...",
    "reasoning": "Using JWT because...",
    "kpis": {
      "response_time_ms": 2100
    },
    "timestamp": "2025-11-07T08:45:00.000Z",
    "duration_ms": 2100,
    "success": true
  }
]
```

---

### Statistics

#### GET /api/stats/:goblin
Get performance statistics for a specific goblin.

**Parameters:**
- `goblin` (path): Goblin ID

**Example:**
```bash
GET /api/stats/websmith
```

**Response:**
```json
{
  "goblin": "websmith",
  "totalExecutions": 142,
  "successRate": 0.95,
  "averageDuration": 1850,
  "lastExecution": "2025-11-07T09:00:00.000Z",
  "kpis": {
    "avg_response_time_ms": 1850,
    "total_tokens": 125000
  }
}
```

---

## 🎭 Orchestration Endpoints

### Parse Orchestration

#### POST /api/orchestrate/parse
Parse orchestration syntax into an execution plan.

**Request Body:**
```json
{
  "text": "websmith: build project THEN test AND lint THEN deploy IF passing",
  "defaultGoblinId": "websmith"
}
```

**Response:**
```json
{
  "id": "orch-uuid-123",
  "steps": [
    {
      "id": "step-1",
      "goblinId": "websmith",
      "task": "build project",
      "dependencies": [],
      "condition": null,
      "status": "pending"
    },
    {
      "id": "step-2",
      "goblinId": "websmith",
      "task": "test",
      "dependencies": ["step-1"],
      "condition": null,
      "status": "pending"
    },
    {
      "id": "step-3",
      "goblinId": "websmith",
      "task": "lint",
      "dependencies": ["step-1"],
      "condition": null,
      "status": "pending"
    },
    {
      "id": "step-4",
      "goblinId": "websmith",
      "task": "deploy",
      "dependencies": ["step-2", "step-3"],
      "condition": "IF_SUCCESS",
      "status": "pending"
    }
  ],
  "status": "pending",
  "createdAt": "2025-11-07T09:00:00.000Z"
}
```

---

### Execute Orchestration

#### POST /api/orchestrate/execute
Execute a parsed orchestration plan.

**Request Body:**
```json
{
  "text": "build THEN test AND lint",
  "defaultGoblinId": "websmith"
}
```

**Response:**
```json
{
  "id": "orch-uuid-123",
  "steps": [
    {
      "id": "step-1",
      "goblinId": "websmith",
      "task": "build",
      "status": "completed",
      "result": {
        "success": true,
        "duration": 1200,
        "response": "Build successful"
      }
    },
    {
      "id": "step-2",
      "goblinId": "websmith",
      "task": "test",
      "status": "completed",
      "result": {
        "success": true,
        "duration": 850
      }
    },
    {
      "id": "step-3",
      "goblinId": "websmith",
      "task": "lint",
      "status": "completed",
      "result": {
        "success": true,
        "duration": 450
      }
    }
  ],
  "status": "completed",
  "startedAt": "2025-11-07T09:00:00.000Z",
  "completedAt": "2025-11-07T09:00:02.500Z"
}
```

---

### List Orchestration Plans

#### GET /api/orchestrate/plans
List all orchestration plans.

**Query Parameters:**
- `status` (optional): Filter by status (`pending`, `running`, `completed`, `failed`, `cancelled`)

**Example:**
```bash
GET /api/orchestrate/plans?status=running
```

**Response:**
```json
[
  {
    "id": "orch-uuid-123",
    "steps": [...],
    "status": "running",
    "createdAt": "2025-11-07T09:00:00.000Z"
  }
]
```

---

### Get Orchestration Plan

#### GET /api/orchestrate/plans/:planId
Get a specific orchestration plan by ID.

**Parameters:**
- `planId` (path): Orchestration plan ID

**Response:**
```json
{
  "id": "orch-uuid-123",
  "steps": [...],
  "status": "completed",
  "createdAt": "2025-11-07T09:00:00.000Z",
  "completedAt": "2025-11-07T09:00:02.500Z"
}
```

---

### Cancel Orchestration

#### POST /api/orchestrate/cancel/:planId
Cancel a running orchestration plan.

**Parameters:**
- `planId` (path): Orchestration plan ID

**Response:**
```json
{
  "id": "orch-uuid-123",
  "status": "cancelled",
  "message": "Orchestration cancelled successfully"
}
```

---

## 💰 Cost Tracking Endpoints

### Get Cost Summary

#### GET /api/costs/summary
Get aggregated cost summary across all providers, goblins, and guilds.

**Query Parameters:**
- `goblinId` (optional): Filter by goblin
- `guildId` (optional): Filter by guild
- `limit` (optional): Number of recent entries to include (default: 20)

**Example:**
```bash
GET /api/costs/summary?limit=50
```

**Response:**
```json
{
  "totalCost": 12.45,
  "totalTasks": 1234,
  "byProvider": {
    "openai": {
      "cost": 8.50,
      "tasks": 450,
      "tokens": {
        "inputTokens": 125000,
        "outputTokens": 85000,
        "totalTokens": 210000
      }
    },
    "gemini": {
      "cost": 2.15,
      "tasks": 680,
      "tokens": {
        "inputTokens": 950000,
        "outputTokens": 450000,
        "totalTokens": 1400000
      }
    },
    "anthropic": {
      "cost": 1.80,
      "tasks": 104,
      "tokens": {
        "inputTokens": 75000,
        "outputTokens": 48000,
        "totalTokens": 123000
      }
    }
  },
  "byGoblin": {
    "websmith": {
      "cost": 5.60,
      "tasks": 567,
      "tokens": {...}
    },
    "vanta-lumin": {
      "cost": 4.20,
      "tasks": 450,
      "tokens": {...}
    }
  },
  "byGuild": {
    "forge-guild": {
      "cost": 9.80,
      "tasks": 1017,
      "tokens": {...}
    }
  },
  "recentEntries": [
    {
      "id": "cost-uuid-123",
      "goblinId": "websmith",
      "guild": "forge-guild",
      "provider": "openai",
      "model": "gpt-4-turbo",
      "task": "Build authentication flow",
      "cost": 0.045,
      "timestamp": "2025-11-07T09:00:00.000Z",
      "success": true
    }
  ]
}
```

---

### Get Goblin Costs

#### GET /api/costs/goblin/:goblinId
Get detailed cost breakdown for a specific goblin.

**Parameters:**
- `goblinId` (path): Goblin ID

**Response:**
```json
{
  "goblinId": "websmith",
  "summary": {
    "totalCost": 5.60,
    "totalTasks": 567,
    "byProvider": {...}
  }
}
```

---

### Get Guild Costs

#### GET /api/costs/guild/:guildId
Get detailed cost breakdown for a specific guild.

**Parameters:**
- `guildId` (path): Guild ID

**Response:**
```json
{
  "guildId": "forge-guild",
  "summary": {
    "totalCost": 9.80,
    "totalTasks": 1017,
    "byGoblin": {...}
  }
}
```

---

### Export Costs

#### GET /api/costs/export
Export all cost entries as CSV.

**Response:**
```csv
id,goblinId,guild,provider,model,task,inputTokens,outputTokens,totalTokens,cost,timestamp,duration,success
cost-123,websmith,forge-guild,openai,gpt-4-turbo,Build auth,1200,800,2000,0.045,2025-11-07T09:00:00.000Z,1234,true
```

---

## 🔌 WebSocket API

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3001/ws')
```

### Events

#### Task Start
```json
{
  "type": "start",
  "goblin": "websmith",
  "task": "Explain recursion"
}
```

#### Streaming Chunk
```json
{
  "type": "chunk",
  "content": "Recursion is a programming technique..."
}
```

#### Task Complete
```json
{
  "type": "complete",
  "response": "Full response text",
  "kpis": {
    "response_time_ms": 1234,
    "tokens_used": 450
  },
  "success": true
}
```

#### Error
```json
{
  "type": "error",
  "error": "Task execution failed: ..."
}
```

---

## 📝 Orchestration Syntax Guide

### Basic Syntax

**Sequential (THEN)**
```
step1 THEN step2 THEN step3
```
Execute steps one after another.

**Parallel (AND)**
```
step1 AND step2 AND step3
```
Execute steps simultaneously.

**Conditional (IF)**
```
step1 THEN step2 IF success
step1 THEN step2 IF failure
```
Execute step2 only if step1 meets the condition.

### Advanced Examples

**Mixed Workflow**
```
build project THEN test AND lint THEN deploy IF passing
```
1. Build project (sequential)
2. Run tests and linting in parallel
3. Deploy only if both tests and linting pass

**Multi-Goblin Orchestration**
```
websmith: build frontend THEN
crafter: design review AND
huntress: security scan THEN
deploy IF passing
```

**Complex Conditional**
```
websmith: implement feature THEN
huntress: test feature IF success THEN
crafter: document feature IF success THEN
deploy IF passing
```

---

## 🔐 Authentication

**Current Status:** No authentication (local development only)

**Production Recommendations:**
- Implement JWT authentication
- Add API key validation
- Enable rate limiting
- Use HTTPS/WSS

---

## 🚀 Rate Limits

**Current Status:** No rate limits

**Recommended for Production:**
- 100 requests/minute per IP
- 1000 requests/hour per IP
- 10 concurrent WebSocket connections

---

## 📊 Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (missing parameters) |
| 404 | Not Found (invalid goblin/plan ID) |
| 500 | Internal Server Error |

---

## 🧪 Testing Examples

### cURL Examples

**List Goblins:**
```bash
curl http://localhost:3001/api/goblins | jq '.'
```

**Execute Task:**
```bash
curl -X POST http://localhost:3001/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "goblin": "websmith",
    "task": "Explain promises"
  }' | jq '.'
```

**Parse Orchestration:**
```bash
curl -X POST http://localhost:3001/api/orchestrate/parse \
  -H "Content-Type: application/json" \
  -d '{
    "text": "build THEN test AND lint",
    "defaultGoblinId": "websmith"
  }' | jq '.'
```

**Get Cost Summary:**
```bash
curl http://localhost:3001/api/costs/summary?limit=10 | jq '.'
```

**Export Costs:**
```bash
curl http://localhost:3001/api/costs/export > costs.csv
```

### JavaScript Examples

**Execute Task with Streaming:**
```javascript
const ws = new WebSocket('ws://localhost:3001/ws')

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'execute',
    goblin: 'websmith',
    task: 'Explain async/await'
  }))
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)

  switch (data.type) {
    case 'start':
      console.log('Task started:', data.task)
      break
    case 'chunk':
      process.stdout.write(data.content)
      break
    case 'complete':
      console.log('\n✓ Complete')
      ws.close()
      break
    case 'error':
      console.error('Error:', data.error)
      ws.close()
      break
  }
}
```

---

**Version:** 0.1.0
**Last Updated:** November 7, 2025
**Server:** http://localhost:3001
