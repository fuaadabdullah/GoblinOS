# 🌉 Overmind Node.js Bridge Service

Simple Express.js service that wraps the TypeScript Overmind for the Python FastAPI backend.

## Why This Bridge?

The Overmind core is written in TypeScript (for type safety and npm ecosystem access). The FastAPI backend provides production-grade features (auth, rate limiting, metrics) but needs to communicate with the TypeScript service. This bridge provides that HTTP interface.

## Quick Start

```bash
cd bridge
pnpm install
pnpm dev  # Development with hot reload
pnpm start  # Production
```

## Endpoints

- `POST /chat` - Send message to Overmind
- `GET /chat/history` - Get conversation history
- `DELETE /chat/history` - Clear conversation
- `POST /crews` - Create and run crew
- `GET /crews/:id` - Get crew status
- `GET /health` - Health check
- `GET /providers` - List available providers

## Configuration

Set in `.env`:

```bash
PORT=3030
NODE_ENV=development
```

## Architecture

```
Client → FastAPI (Port 8001) → Node Bridge (Port 3030) → Overmind (TypeScript)
         [Auth, Rate Limit]        [HTTP Wrapper]          [Core Logic]
```

This separation allows:
- Python expertise for backend services
- TypeScript for AI orchestration logic
- Easy horizontal scaling of either component

## KPI testing (test helpers)

The bridge contains a lightweight in-memory KPI store used by tests to assert that KPI events and tool invocations are recorded correctly. When running the test suite (the test harness enables the mock Overmind with `OVERMIND_MOCK=1`), the mock store exposes a few helpers that tests can use:

- `kpiStore.getRecordedEvents()` — returns an array of recorded KPI event objects (each event includes a `timestamp` field added by the mock).
- `kpiStore.getRecordedToolInvocations()` — returns an array of recorded tool invocation objects (each includes a `timestamp`).
- `kpiStore.clear()` — clears any recorded events/invocations (useful in `beforeEach` hooks to isolate tests).

Example usage in tests:

1. Import the test server and kpiStore from the bridge test entry (the project's tests import the running app and `kpiStore`).
2. Call `kpiStore.clear()` in a `beforeEach` to isolate state.
3. POST to `/kpi/event` or `/kpi/tool-invocation` and then assert against `kpiStore.getRecordedEvents()` or `kpiStore.getRecordedToolInvocations()`.

Run the bridge tests locally from the package directory:

```bash
cd GoblinOS/packages/goblins/overmind/bridge
OVERMIND_MOCK=1 NODE_ENV=test npm test
```

Or with pnpm from the repo root (recommended in monorepo):

```bash
pnpm --filter @goblinos/overmind-bridge test
```

### Example test snippet

Here's a minimal Vitest example (lifted from the project's `test/app.test.ts`) that shows how to post a KPI event and assert it was recorded by the mock `kpiStore`:

```ts
import { expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import fetch from 'node-fetch';
import { app, kpiStore } from '../src/index';

let server: any;
let baseUrl = '';

beforeAll(() => {
    // Start the app on an ephemeral port for the test snippet
    server = app.listen(0);
    // @ts-ignore - runtime port available on the server object
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
});

beforeEach(() => {
    kpiStore.clear();
});

afterAll(() => {
    server?.close();
});

it('records KPI event in kpiStore', async () => {
    const payload = { guild: 'forge', goblin: 'orchestrator', kpi: 'chat_requests', value: 2 };
    const res = await fetch(`${baseUrl}/kpi/event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);

    const events = kpiStore.getRecordedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject(payload);
    expect(events[0]).toHaveProperty('timestamp');
});
```
