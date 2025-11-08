---
title: Testcontainers Testing Infrastructure
type: reference
project: GoblinOS
status: published
owner: GoblinOS
goblin_name: Testing Infrastructure
---

# @goblinos/testing

Testcontainers fixtures for Overmind integration testing with Postgres, Redis, and NATS JetStream.

## Installation

```bash
pnpm add -D @goblinos/testing
```

## Usage

### Node.js/TypeScript with Vitest

```typescript
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { PostgresContainer, RedisContainer, NatsContainer } from '@goblinos/testing/node';

describe('Memory Service Integration Tests', () => {
  let postgres: PostgresContainer;
  let redis: RedisContainer;

  beforeAll(async () => {
    // Start containers
    postgres = await PostgresContainer.start();
    redis = await RedisContainer.start();
  });

  afterAll(async () => {
    // Stop containers
    await postgres.stop();
    await redis.stop();
  });

  it('should store and retrieve memory from postgres', async () => {
    const client = postgres.getClient();

    await client.query(`
      CREATE TABLE memories (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(
      'INSERT INTO memories (content) VALUES ($1)',
      ['Test memory']
    );

    const result = await client.query('SELECT * FROM memories');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].content).toBe('Test memory');
  });

  it('should cache data in redis', async () => {
    const client = redis.getClient();

    await client.set('test:key', 'test value');
    const value = await client.get('test:key');

    expect(value).toBe('test value');
  });
});
```

### Python with pytest

```python
import pytest
from goblinos_testing import PostgresContainer, RedisContainer, NatsContainer

@pytest.fixture(scope="session")
async def postgres_container():
    """Postgres container for integration tests."""
    container = PostgresContainer()
    await container.start()
    yield container
    await container.stop()

@pytest.fixture(scope="session")
async def redis_container():
    """Redis container for integration tests."""
    container = RedisContainer()
    await container.start()
    yield container
    await container.stop()

@pytest.mark.asyncio
async def test_memory_persistence(postgres_container):
    """Test memory storage in Postgres."""
    conn = await postgres_container.get_connection()

    await conn.execute("""
        CREATE TABLE memories (
            id SERIAL PRIMARY KEY,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)

    await conn.execute(
        "INSERT INTO memories (content) VALUES ($1)",
        "Test memory"
    )

    rows = await conn.fetch("SELECT * FROM memories")
    assert len(rows) == 1
    assert rows[0]['content'] == "Test memory"

    await conn.close()

@pytest.mark.asyncio
async def test_redis_caching(redis_container):
    """Test caching with Redis."""
    client = await redis_container.get_client()

    await client.set("test:key", "test value")
    value = await client.get("test:key")

    assert value == b"test value"

    await client.close()
```

## API Reference

### PostgresContainer

```typescript
class PostgresContainer {
  static async start(options?: PostgresOptions): Promise<PostgresContainer>
  async stop(): Promise<void>
  getClient(): pg.Client
  getConnectionString(): string
  getHost(): string
  getPort(): number
}

interface PostgresOptions {
  image?: string;        // Default: postgres:16-alpine
  database?: string;     // Default: test_db
  username?: string;     // Default: test_user
  password?: string;     // Default: test_password
  initScripts?: string[]; // SQL files to run on startup
}
```

### RedisContainer

```typescript
class RedisContainer {
  static async start(options?: RedisOptions): Promise<RedisContainer>
  async stop(): Promise<void>
  getClient(): RedisClientType
  getConnectionString(): string
  getHost(): string
  getPort(): number
}

interface RedisOptions {
  image?: string;  // Default: redis:7-alpine
  password?: string;
}
```

### NatsContainer

```typescript
class NatsContainer {
  static async start(options?: NatsOptions): Promise<NatsContainer>
  async stop(): Promise<void>
  getClient(): NatsConnection
  getConnectionString(): string
  getHost(): string
  getPort(): number
  async createStream(config: StreamConfig): Promise<void>
}

interface NatsOptions {
  image?: string;  // Default: nats:2.10-alpine
  enableJetStream?: boolean;  // Default: true
  username?: string;
  password?: string;
}
```

## Advanced Usage

### Shared Containers (Session Scope)

```typescript
import { beforeAll, afterAll } from 'vitest';
import { PostgresContainer } from '@goblinos/testing/node';

let sharedPostgres: PostgresContainer;

beforeAll(async () => {
  // Start once for entire test suite
  sharedPostgres = await PostgresContainer.start();
}, 30000); // 30s timeout for container startup

afterAll(async () => {
  await sharedPostgres.stop();
});

export { sharedPostgres };
```

### Custom Init Scripts

```typescript
const postgres = await PostgresContainer.start({
  initScripts: [
    './migrations/001_create_tables.sql',
    './seeds/dev_data.sql'
  ]
});
```

### Network Isolation

```typescript
import { Network } from 'testcontainers';

const network = await new Network().start();

const postgres = await PostgresContainer.start({ network });
const redis = await RedisContainer.start({ network });
const nats = await NatsContainer.start({ network });

// Services can communicate using container names
// e.g., redis://redis:6379
```

## Configuration

### Environment Variables

```bash
# Testcontainers configuration
TESTCONTAINERS_RYUK_DISABLED=false  # Enable cleanup
TESTCONTAINERS_REUSE_ENABLE=true    # Reuse containers across runs

# Docker host (for remote Docker)
DOCKER_HOST=tcp://docker.example.com:2375
```

### Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: './test/global-setup.ts',
    testTimeout: 30000,  // 30s for container startup
    hookTimeout: 30000
  }
});
```

### pytest Config

```ini
# pytest.ini
[pytest]
asyncio_mode = auto
markers =
    integration: marks tests as integration (require containers)
    slow: marks tests as slow running

# Increase timeout for container startup
timeout = 300
```

## Best Practices

1. **Use session-scoped fixtures** to start containers once per test suite
2. **Clean up data** between tests with transactions or TRUNCATE
3. **Set timeouts** high enough for container startup (30-60s)
4. **Reuse containers** in CI with `TESTCONTAINERS_REUSE_ENABLE=true`
5. **Use Docker cache** to speed up image pulls
6. **Run cleanup** with Ryuk (Testcontainers' cleanup container)

## CI/CD Integration

### GitHub Actions

```yaml
jobs:
  test:
    runs-on: ubuntu-latest

    services:
      docker:
        image: docker:dind
        options: --privileged

    steps:
      - uses: actions/checkout@v4

      - name: Run integration tests
        run: pnpm test:integration
        env:
          TESTCONTAINERS_RYUK_DISABLED: false
          TESTCONTAINERS_REUSE_ENABLE: true
```

### Docker Compose (Alternative)

For faster local development without Testcontainers overhead:

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: test_db
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  nats:
    image: nats:2.10-alpine
    command: ["-js"]
    ports:
      - "4222:4222"
```

## Troubleshooting

### "Cannot connect to Docker daemon"

```bash
# Ensure Docker is running
docker ps

# Check DOCKER_HOST env var
echo $DOCKER_HOST

# For Docker Desktop on macOS
export DOCKER_HOST=unix:///Users/<user>/.docker/run/docker.sock
```

### "Container startup timeout"

Increase timeout in test configuration:

```typescript
beforeAll(async () => {
  postgres = await PostgresContainer.start();
}, 60000); // 60s timeout
```

### "Port already in use"

Testcontainers auto-assigns random ports. If using fixed ports:

```typescript
const postgres = await PostgresContainer.start({
  port: 0  // Use random port
});

const port = postgres.getPort();
console.log(`Postgres running on port ${port}`);
```

## References

- [Testcontainers](https://testcontainers.com/)
- [Testcontainers Node.js](https://node.testcontainers.org/)
- [Testcontainers Python](https://testcontainers-python.readthedocs.io/)
- [Vitest](https://vitest.dev/)
- [pytest](https://docs.pytest.org/)

## License

MIT
