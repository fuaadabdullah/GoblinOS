/**
 * @goblinos/shared
 *
 * Base interface for all GoblinOS goblins
 * Provides standardized lifecycle methods for modular goblin architecture
 */

export interface GoblinConfig {
	/** Unique identifier for this goblin instance */
	id: string;
	/** Configuration parameters specific to the goblin */
	config?: Record<string, any>;
	/** Logger instance for structured logging */
	logger?: Logger;
	/** Working directory for the goblin */
	workingDir?: string;
}

export interface GoblinContext {
	/** Input data for the goblin execution */
	input?: any;
	/** Additional context or metadata */
	metadata?: Record<string, any>;
	/** Cancellation token for async operations */
	cancelToken?: AbortSignal;
}

export interface GoblinResult {
	/** Whether the execution was successful */
	success: boolean;
	/** Output data from the goblin */
	output?: any;
	/** Error information if execution failed */
	error?: Error;
	/** Execution metadata (duration, etc.) */
	metadata?: Record<string, any>;
}

/**
 * Base interface that all goblins must implement
 * Provides standardized lifecycle management and execution
 */
export interface GoblinInterface {
	/**
	 * Initialize the goblin with configuration
	 * Called once when the goblin is first loaded
	 * @param config Configuration for the goblin
	 */
	initialize(config: GoblinConfig): Promise<void>;

	/**
	 * Execute the goblin's primary function
	 * Can be called multiple times with different inputs
	 * @param context Execution context including input data
	 * @returns Result of the execution
	 */
	execute(context: GoblinContext): Promise<GoblinResult>;

	/**
	 * Shutdown the goblin and clean up resources
	 * Called when the goblin is no longer needed
	 */
	shutdown(): Promise<void>;

	/**
	 * Get information about the goblin's capabilities
	 * Used for discovery and validation
	 */
	getCapabilities(): GoblinCapabilities;
}

export interface GoblinCapabilities {
	/** Human-readable name */
	name: string;
	/** Brief description of what the goblin does */
	description: string;
	/** Version of the goblin implementation */
	version: string;
	/** Input schema/types the goblin accepts */
	inputSchema?: any;
	/** Output schema/types the goblin produces */
	outputSchema?: any;
	/** Tags for categorization and discovery */
	tags?: string[];
}

/**
 * Abstract base class providing common goblin functionality
 * Goblins can extend this class instead of implementing the interface directly
 */
export abstract class BaseGoblin implements GoblinInterface {
	protected config: GoblinConfig | null = null;
	protected logger: Logger | null = null;

	async initialize(config: GoblinConfig): Promise<void> {
		this.config = config;
		this.logger = config.logger || null;

		// Log initialization
		if (this.logger) {
			this.logger.info(`Initializing goblin ${config.id}`);
		}

		// Call subclass initialization
		await this.onInitialize(config);
	}

	async execute(context: GoblinContext): Promise<GoblinResult> {
		try {
			if (this.logger) {
				this.logger.info(`Executing goblin ${this.config?.id}`, { input: context.input });
			}

			const result = await this.onExecute(context);

			if (this.logger) {
				this.logger.info(`Goblin ${this.config?.id} execution completed`, {
					success: result.success,
					hasOutput: !!result.output
				});
			}

			return result;
		} catch (error) {
			if (this.logger) {
				this.logger.error(`Goblin ${this.config?.id} execution failed`, { error });
			}

			return {
				success: false,
				error: error as Error,
				metadata: { executionTime: Date.now() }
			};
		}
	}

	async shutdown(): Promise<void> {
		if (this.logger) {
			this.logger.info(`Shutting down goblin ${this.config?.id}`);
		}

		await this.onShutdown();
		this.config = null;
		this.logger = null;
	}

	abstract getCapabilities(): GoblinCapabilities;

	/**
	 * Subclass-specific initialization logic
	 */
	protected abstract onInitialize(config: GoblinConfig): Promise<void>;

	/**
	 * Subclass-specific execution logic
	 */
	protected abstract onExecute(context: GoblinContext): Promise<GoblinResult>;

	/**
	 * Subclass-specific shutdown logic
	 */
	protected onShutdown(): Promise<void> {
		return Promise.resolve();
	}
}

// Re-export Logger type for convenience
export type { Logger } from "./logger.js";
