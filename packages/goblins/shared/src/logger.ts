import pino from "pino";

/**
 * Create a structured logger for GoblinOS
 *
 * Development: Pretty-printed logs
 * Production: JSON logs for parsing/aggregation
 *
 * @example
 * ```ts
 * import { createLogger } from '@goblinos/shared';
 *
 * const log = createLogger({ name: 'my-goblin' });
 * log.info({ userId: '123' }, 'User logged in');
 * log.error({ err }, 'Failed to process');
 * ```
 */
export function createLogger(options?: { name?: string; level?: string }) {
	const isDev = process.env.NODE_ENV !== "production";

	return pino({
		name: options?.name || "goblinos",
		level: options?.level || process.env.LOG_LEVEL || "info",

		// Pretty print in dev, JSON in production
		transport: isDev
			? {
					target: "pino-pretty",
					options: {
						colorize: true,
						translateTime: "HH:MM:ss",
						ignore: "pid,hostname",
					},
				}
			: undefined,

		// Add common context to all logs
		base: {
			env: process.env.NODE_ENV || "development",
		},

		// Redact sensitive fields
		redact: {
			paths: [
				"password",
				"apiKey",
				"token",
				"*.password",
				"*.apiKey",
				"*.token",
			],
			censor: "[REDACTED]",
		},
	});
}

/**
 * Default logger instance
 * Use this for quick access, or create custom loggers with createLogger
 */
export const log = createLogger();

/**
 * Child logger with additional context
 *
 * @example
 * ```ts
 * const reqLog = log.child({ requestId: req.id });
 * reqLog.info('Processing request');
 * ```
 */
export type Logger = ReturnType<typeof createLogger>;
