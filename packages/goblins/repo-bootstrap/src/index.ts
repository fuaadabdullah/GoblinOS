/**
 * Repo Bootstrap Goblin
 *
 * Bootstraps a new repository with necessary tools and environment setup
 */

import { RepoBootstrapLogic } from "./logic.js";
import type { RepoBootstrapConfig } from "./types.js";

// Temporary local interfaces until @goblinos/shared exports them
interface GoblinConfig {
	id: string;
	config?: Record<string, any>;
	logger?: any;
	workingDir?: string;
}

interface GoblinContext {
	input?: any;
	metadata?: Record<string, any>;
	cancelToken?: AbortSignal;
}

interface GoblinResult {
	success: boolean;
	output?: any;
	error?: Error;
	metadata?: Record<string, any>;
}

interface GoblinCapabilities {
	name: string;
	description: string;
	version: string;
	inputSchema?: any;
	outputSchema?: any;
	tags?: string[];
}

interface GoblinInterface {
	initialize(config: GoblinConfig): Promise<void>;
	execute(context: GoblinContext): Promise<GoblinResult>;
	shutdown(): Promise<void>;
	getCapabilities(): GoblinCapabilities;
}

export class RepoBootstrapGoblin implements GoblinInterface {
	private logic: RepoBootstrapLogic | null = null;

	constructor(config: GoblinConfig) {
		// Load configuration from default.json and merge with provided config
		const defaultConfig: RepoBootstrapConfig = {
			ensurePnpm: true,
			requiredNode: "18",
			setupGitHooks: true
		};

		const goblinConfig: RepoBootstrapConfig = {
			...defaultConfig,
			...(config.config as RepoBootstrapConfig || {})
		};

		this.logic = new RepoBootstrapLogic(goblinConfig);
		console.log(`[repo-bootstrap] Initialized with config:`, goblinConfig);
	}

	async initialize(): Promise<void> {
		// Initialization is done in constructor
	}

	async execute(_context: GoblinContext): Promise<GoblinResult> {
		try {
			if (!this.logic) {
				throw new Error("Goblin not initialized");
			}

			const bootstrapResult = await this.logic.bootstrap();

			if (bootstrapResult.success) {
				return {
					success: true,
					output: bootstrapResult.result,
					metadata: {
						completed: true,
						timestamp: new Date().toISOString()
					}
				};
			} else {
				return {
					success: false,
					error: new Error(bootstrapResult.error?.message || "Bootstrap failed"),
					metadata: {
						errorType: bootstrapResult.error?.type,
						suggestion: bootstrapResult.error?.suggestion,
						timestamp: new Date().toISOString()
					}
				};
			}
		} catch (error) {
			return {
				success: false,
				error: error as Error,
				metadata: {
					timestamp: new Date().toISOString()
				}
			};
		}
	}

	async shutdown(): Promise<void> {
		this.logic = null;
		console.log("[repo-bootstrap] Shutdown complete");
	}

	getCapabilities(): GoblinCapabilities {
		return {
			name: "Repository Bootstrap",
			description: "Bootstrap a new repository with necessary tools and environment setup",
			version: "1.0.0",
			tags: ["bootstrap", "setup", "environment", "repository"]
		};
	}
}

// Default export for backward compatibility
export default RepoBootstrapGoblin;
