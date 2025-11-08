// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
/* biome-disable */
// Short-term, permissive shims to reduce TypeScript noise while we triage
// and implement proper types/adapters. Replace with precise declarations
// or adapters as part of the follow-up work.

declare module "@goblinos/*" {
	const anything: any;
	export default anything;
}

declare module "@goblinos/overmind/*" {
	const anything: any;
	export default anything;
}

// package-level '@goblinos/overmind' declarations were removed to avoid
// conflicts with the package's real `src/types.ts` enums and interfaces.
// Keep third-party shims below only.

// Allow imports that end with 'types' to resolve tolerantly
declare module "*types" {
	const t: any;
	export default t;
}

// Minimal third-party shims
declare module "pg" {
	export type Client = any;
	export type Statement = any;
}
declare module "nats" {
	// Many code paths call `connect(...)` or import the top-level `nats` and use
	// `connect`. Provide a permissive signature to reduce TS noise until we add
	// a proper adapter/typed wrapper.
	export function connect(opts?: any): any;
	export type NatsConnection = any;
	export type ConnectionOptions = any;
	const __goblinos_nats_default: { connect: typeof connect };
	export default __goblinos_nats_default;
}

declare module "redis" {
	// Permissive runtime surface: createClient and a client type. Replace with
	// a precise adapter later.
	export class RedisClientType {
		connect?: () => Promise<void>;
		disconnect?: () => Promise<void>;
		[x: string]: any;
	}
	export function createClient(opts?: any): RedisClientType;
	const __goblinos_redis_default: { createClient: typeof createClient };
	export default __goblinos_redis_default;
}

declare module "openai" {
	// Minimal shim that allows `new OpenAI({ ... })` and `OpenAI.Chat` usages.
	export class OpenAI {
		constructor(opts?: any);
		// instance methods are permissive
		[x: string]: any;
	}
	export namespace OpenAI {
		export namespace Chat {
			export type ChatCompletionMessageParam = any;
			export type ChatCompletion = any;
		}
	}
	export default OpenAI;
}

declare module "ollama" {
	// Permissive but unified shim for the various runtime shapes we observe:
	// - default export that's an object with methods (pull, list, show, etc.)
	// - named `Ollama` constructor/function (new Ollama({...}))
	// - factory `createClient(opts)`
	// Tests may also replace these with Jest/Vitest mocks so keep everything `any`.

	export type ChatRequest = any;
	export type ChatResponse = any;
	export type EmbeddingsResponse = any;

	export interface OllamaConstructor {
		new (opts?: any): any;
		(opts?: any): any;
		mock?: any;
		[k: string]: any;
	}

	export interface OllamaModuleShape {
		// common top-level helpers
		pull?: (opts?: any) => Promise<any> | any;
		list?: (opts?: any) => Promise<any> | any;
		show?: (opts?: any) => Promise<any> | any;
		delete?: (opts?: any) => Promise<any> | any;
		createClient?: (opts?: any) => any;
		Ollama?: OllamaConstructor;
		default?: any;
		[key: string]: any;
	}

	const _ollama: OllamaModuleShape;
	export default _ollama;
	export const Ollama: OllamaConstructor;
	export function createClient(opts?: any): any;
}

declare module "@opentelemetry/api" {
	export const trace: any;
	export const context: any;
	export const propagation: any;
}

declare module "@opentelemetry/resources" {
	export const ResourceAttributes: any;
	export function resourceFromAttributes(...args: any[]): any;
}

// Project-local client module shims for `.js`-suffixed imports used in source files.
// These are permissive and only supply named exports to avoid default/export collisions.
