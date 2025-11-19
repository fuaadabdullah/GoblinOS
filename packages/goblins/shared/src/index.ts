/**
 * @goblinos/shared
 *
 * Shared utilities for GoblinOS goblins
 * - Structured logging with Pino
 * - Common types and helpers
 * - Base goblin interfaces and classes
 */

export { createLogger, log, type Logger } from "./logger.js";
export { runCommand, resolveRepoPath, type RunCommandOptions } from "./exec.js";
export {
	type GoblinInterface,
	type GoblinConfig,
	type GoblinContext,
	type GoblinResult,
	type GoblinCapabilities,
	BaseGoblin
} from "./goblin-interface.js";
