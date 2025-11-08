/**
 * @module @goblinos/providers
 * @description Universal LLM provider abstraction with intelligent routing and fallbacks
 *
 * Features:
 * - Single SDK (OpenAI-compatible) for all models
 * - Automatic fallbacks (cloud -> local)
 * - OpenTelemetry instrumentation
 * - Cost and latency tracking
 * - Type-safe configuration
 *
 * @example
 * ```typescript
 * import { ProviderClient, createProvider } from '@goblinos/providers';
 *
 * const client = createProvider({
 *   baseURL: process.env.LITELLM_BASE_URL || 'http://litellm:4000',
 *   apiKey: 'dummy',
 *   defaultModel: 'gpt-4-turbo',
 *   fallbackModels: ['gemini-pro', 'ollama-local']
 * });
 *
 * const response = await client.chat({
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * ```
 */

export * from "./client.js";
export * from "./config.js";
export * from "./types.js";
export * from "./telemetry.js";
export * from "./fallback.js";
