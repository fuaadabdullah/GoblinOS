// Short-term shims for node SDK types used by packages/goblins/testing
// These convert problematic namespace-as-type errors into simple types (any).
// Replace with precise types or update SDK versions in a follow-up.

declare module "pg" {
	// Client is used as a value and type in the code; make a permissive type.
	export type Client = any;
}

declare module "redis" {
	export type RedisClientType = any;
	export function createClient(...args: any[]): any;
}

declare module "nats" {
	export type NatsConnection = any;
	export type ConnectionOptions = any;
	export type StreamConfig = any;
}
