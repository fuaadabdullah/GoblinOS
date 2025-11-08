// Re-export the Node-based testcontainer implementations and their option types.
// Use distinct runtime names and avoid exporting duplicate type/value identifiers
// which can cause TypeScript duplicate identifier errors when generating .d.ts files.
export { PostgresTestcontainer as PostgresContainer } from "./node/postgres.js";
export { RedisTestcontainer as RedisContainer } from "./node/redis.js";
export { NatsTestcontainer as NatsContainer } from "./node/nats.js";

export type { PostgresOptions } from "./node/postgres.js";
export type { RedisOptions } from "./node/redis.js";
export type { NatsOptions } from "./node/nats.js";
