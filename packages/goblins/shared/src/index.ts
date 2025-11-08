/**
 * @goblinos/shared
 *
 * Shared utilities for GoblinOS goblins
 * - Structured logging with Pino
 * - Common types and helpers
 */

export { createLogger, log, type Logger } from "./logger.js";
export { runCommand, resolveRepoPath, type RunCommandOptions } from "./exec.js";
