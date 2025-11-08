---
title: Temporal Workflow Orchestration for Overmind
type: reference
project: GoblinOS/Overmind
status: published
owner: GoblinOS
goblin_name: Overmind Temporal Workflows
---

# Temporal Workflow Orchestration

Durable workflow orchestration for Overmind memory consolidation using [Temporal](https://temporal.io/).

## Overview

Temporal provides:

- ✅ **Durable execution** - Workflows survive worker crashes
- ✅ **Automatic retries** - Configurable retry policies
- ✅ **Observability** - Built-in UI for workflow monitoring
- ✅ **Versioning** - Safe workflow updates
- ✅ **Scheduling** - Cron-based workflow triggers
- ✅ **State management** - Persistent workflow state

## Architecture

```
Memory Consolidation Workflow
├── Scheduled (every 5 minutes)
├── Activities
│   ├── IdentifyConsolidationCandidates
│   ├── ConsolidateToWorking
│   ├── ConsolidateToLongTerm
│   └── CleanupExpiredMemories
└── Error Handling
    ├── Retry policies
    └── Compensation logic
```

## Quick Start

### Prerequisites

```bash
# Install Temporal CLI
brew install temporal

# Or via script
curl -sSf https://temporal.download/cli.sh | sh

# Start Temporal server (local development)
temporal server start-dev
```

### Install Dependencies

```bash
# Worker dependencies
pnpm add @temporalio/worker @temporalio/client @temporalio/activity

# Workflow dependencies
pnpm add @temporalio/workflow
```

### Run Worker

```bash
# Development
pnpm temporal:worker

# Production
pnpm temporal:worker:prod
```

### Trigger Workflow

```bash
# Via CLI
temporal workflow execute \
  --task-queue overmind-memory \
  --type memoryConsolidation \
  --workflow-id memory-consolidation-$(date +%s)

# Via code
pnpm temporal:trigger
```

## Workflows

### Memory Consolidation Workflow

Orchestrates the 3-tier memory consolidation process.

**File**: `src/workflows/memoryConsolidation.ts`

```typescript
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const {
  identifyConsolidationCandidates,
  consolidateToWorking,
  consolidateToLongTerm,
  cleanupExpiredMemories
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    maximumInterval: '30s',
    backoffCoefficient: 2,
    maximumAttempts: 3
  }
});

export async function memoryConsolidation(): Promise<ConsolidationResult> {
  // Step 1: Identify candidates for consolidation
  const candidates = await identifyConsolidationCandidates();

  // Step 2: Consolidate short-term → working memory
  const workingResults = await consolidateToWorking({
    candidates: candidates.shortTermToWorking
  });

  // Step 3: Consolidate working → long-term memory
  const longTermResults = await consolidateToLongTerm({
    candidates: candidates.workingToLongTerm
  });

  // Step 4: Cleanup expired memories
  await cleanupExpiredMemories({
    maxAge: '30d'
  });

  return {
    shortTermConsolidated: workingResults.count,
    longTermConsolidated: longTermResults.count,
    timestamp: new Date().toISOString()
  };
}
```

## Activities

Activities encapsulate external service calls and business logic.

### IdentifyConsolidationCandidates

Queries memory stores to find consolidation candidates.

```typescript
// src/activities/consolidation.ts
import { Context } from '@temporalio/activity';

export async function identifyConsolidationCandidates(): Promise<Candidates> {
  const logger = Context.current().log;

  logger.info('Identifying consolidation candidates');

  // Query short-term memory
  const shortTerm = await memoryClient.getShortTermMemories();
  const shortTermCandidates = shortTerm.filter(m =>
    m.importance >= 0.7 && m.accessCount >= 3
  );

  // Query working memory
  const working = await memoryClient.getWorkingMemories();
  const workingCandidates = working.filter(m =>
    m.importance >= 0.9 && m.accessCount >= 10
  );

  return {
    shortTermToWorking: shortTermCandidates,
    workingToLongTerm: workingCandidates
  };
}
```

### ConsolidateToWorking

Moves memories from short-term to working tier.

```typescript
export async function consolidateToWorking(
  params: ConsolidationParams
): Promise<ConsolidationResult> {
  const logger = Context.current().log;
  let consolidated = 0;

  for (const memory of params.candidates) {
    try {
      // Add to working memory
      await memoryClient.addToWorking({
        content: memory.content,
        importance: memory.importance,
        tags: memory.tags,
        metadata: {
          ...memory.metadata,
          promotedAt: new Date().toISOString(),
          originalTier: 'short-term'
        }
      });

      // Remove from short-term
      await memoryClient.removeFromShortTerm(memory.id);

      consolidated++;
      logger.info(`Consolidated memory ${memory.id} to working`);
    } catch (error) {
      logger.error(`Failed to consolidate ${memory.id}`, { error });
      // Continue with other memories
    }
  }

  return { count: consolidated };
}
```

## Worker Configuration

### Development Worker

```typescript
// src/worker.ts
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';

async function run() {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
  });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: 'overmind-memory',
    workflowsPath: require.resolve('./workflows'),
    activities,
    maxConcurrentActivityTaskExecutions: 10,
    maxConcurrentWorkflowTaskExecutions: 100
  });

  await worker.run();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
```

### Production Worker (with observability)

```typescript
// src/worker.prod.ts
import { NativeConnection, Worker, Runtime } from '@temporalio/worker';
import { DefaultLogger } from '@temporalio/worker';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

async function run() {
  // Configure OpenTelemetry
  Runtime.install({
    logger: new DefaultLogger('INFO'),
    telemetryOptions: {
      tracingFilter: 'temporal_*',
      metrics: {
        prometheus: {
          bindAddress: '0.0.0.0:9090'
        }
      }
    }
  });

  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'temporal:7233',
    tls: process.env.TEMPORAL_TLS_ENABLED === 'true' ? {
      clientCertPair: {
        crt: Buffer.from(process.env.TEMPORAL_TLS_CERT!, 'base64'),
        key: Buffer.from(process.env.TEMPORAL_TLS_KEY!, 'base64')
      }
    } : undefined
  });

  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'overmind',
    taskQueue: 'overmind-memory',
    workflowsPath: require.resolve('./workflows'),
    activities,
    maxConcurrentActivityTaskExecutions: 50,
    maxConcurrentWorkflowTaskExecutions: 200
  });

  await worker.run();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
```

## Scheduling

### Cron-based Consolidation

```typescript
// src/schedules/memoryConsolidation.ts
import { Client } from '@temporalio/client';

export async function setupConsolidationSchedule() {
  const client = new Client({
    connection: await NativeConnection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
    })
  });

  await client.schedule.create({
    scheduleId: 'memory-consolidation',
    spec: {
      // Every 5 minutes
      cronExpressions: ['*/5 * * * *']
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'memoryConsolidation',
      taskQueue: 'overmind-memory',
      args: []
    },
    policies: {
      overlap: 'SKIP', // Don't start if previous run is still executing
      catchupWindow: '1 hour'
    }
  });

  console.log('Memory consolidation schedule created');
}
```

## Kubernetes Deployment

### Deployment Manifest

```yaml
# k8s/temporal-worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: overmind-temporal-worker
  namespace: overmind
spec:
  replicas: 2
  selector:
    matchLabels:
      app: overmind-temporal-worker
  template:
    metadata:
      labels:
        app: overmind-temporal-worker
    spec:
      containers:
      - name: worker
        image: overmind-temporal-worker:latest
        env:
        - name: TEMPORAL_ADDRESS
          value: temporal:7233
        - name: TEMPORAL_NAMESPACE
          value: overmind
        - name: MEMORY_API_URL
          value: http://overmind-api:8000
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
          limits:
            cpu: 1000m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 9090
          initialDelaySeconds: 30
          periodSeconds: 10
```

### Helm Chart

```yaml
# infra/charts/temporal-worker/values.yaml
replicaCount: 2

image:
  repository: overmind-temporal-worker
  tag: latest
  pullPolicy: IfNotPresent

temporal:
  address: temporal:7233
  namespace: overmind
  taskQueue: overmind-memory

resources:
  requests:
    cpu: 200m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

## Monitoring

### Temporal UI

Access at `http://localhost:8233` (local dev)

### Prometheus Metrics

Worker exposes metrics on port 9090:

- `temporal_worker_task_slots_available`
- `temporal_activity_execution_latency`
- `temporal_workflow_execution_latency`
- `temporal_activity_execution_failed`

### OpenTelemetry Traces

Workflows and activities emit traces viewable in Jaeger.

## Best Practices

1. **Idempotent Activities** - Activities should be safe to retry
2. **Deterministic Workflows** - No side effects in workflow code
3. **Versioning** - Use `patched()` for workflow updates
4. **Timeouts** - Set appropriate timeouts for all activities
5. **Error Handling** - Use try/catch and compensation logic
6. **Testing** - Use `@temporalio/testing` for workflow tests

## Testing

```typescript
// test/workflows/memoryConsolidation.test.ts
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { memoryConsolidation } from '../src/workflows';
import * as activities from '../src/activities';

describe('Memory Consolidation Workflow', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('should consolidate memories successfully', async () => {
    const { client, nativeConnection } = testEnv;

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test',
      workflowsPath: require.resolve('../src/workflows'),
      activities
    });

    await worker.runUntil(async () => {
      const result = await client.workflow.execute(memoryConsolidation, {
        taskQueue: 'test',
        workflowId: 'test-consolidation'
      });

      expect(result.shortTermConsolidated).toBeGreaterThan(0);
      expect(result.longTermConsolidated).toBeGreaterThan(0);
    });
  });
});
```

## Troubleshooting

### "Workflow execution timed out"

Increase workflow timeout:

```typescript
await client.workflow.execute(memoryConsolidation, {
  taskQueue: 'overmind-memory',
  workflowId: 'consolidation-1',
  workflowExecutionTimeout: '30 minutes' // Increase from default
});
```

### "Activity execution failed"

Check activity retry policy:

```typescript
const activities = proxyActivities({
  startToCloseTimeout: '10 minutes',
  retry: {
    initialInterval: '1s',
    maximumInterval: '1m',
    backoffCoefficient: 2,
    maximumAttempts: 5 // Increase retries
  }
});
```

### "Worker not processing tasks"

Check worker logs and ensure task queue matches:

```bash
temporal workflow describe --workflow-id <id>
```

## References

- [Temporal Documentation](https://docs.temporal.io/)
- [TypeScript SDK](https://typescript.temporal.io/)
- [Workflow Development Patterns](https://docs.temporal.io/dev-guide/)

## License

MIT
