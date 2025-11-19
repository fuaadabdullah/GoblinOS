/**
 * Workspace Health Goblin
 *
 * Runs comprehensive health checks on the workspace including linting, testing, and smoke tests
 */

import { WorkspaceHealthLogic } from "./logic.js";
import type { WorkspaceHealthConfig } from "./types.js";

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
	initialize(): Promise<void>;
	execute(context: GoblinContext): Promise<GoblinResult>;
	shutdown(): Promise<void>;
	getCapabilities(): GoblinCapabilities;
}

export class WorkspaceHealthGoblin implements GoblinInterface {
	private logic: WorkspaceHealthLogic | null = null;

	constructor(config: GoblinConfig) {
		// Load configuration from default.json and merge with provided config
		const defaultConfig: WorkspaceHealthConfig = {
			runEslint: true,
			runTypecheck: true,
			runTests: true,
			runSmoke: true,
			smokeUrl: "http://localhost:3000",
			timeout: 30000
		};

		const goblinConfig: WorkspaceHealthConfig = {
			...defaultConfig,
			...(config.config as WorkspaceHealthConfig || {})
		};

		this.logic = new WorkspaceHealthLogic(goblinConfig);
		console.log(`[workspace-health] Initialized with config:`, goblinConfig);
	}

	async initialize(): Promise<void> {
		// Initialization is done in constructor
	}

	async execute(_context: GoblinContext): Promise<GoblinResult> {
		try {
			if (!this.logic) {
				throw new Error("Goblin not initialized");
			}

			const checkResult = await this.logic.runAllChecks();

			if (checkResult.success) {
				return {
					success: true,
					output: checkResult.summary,
					metadata: {
						completed: true,
						timestamp: new Date().toISOString(),
						checkCount: checkResult.summary.results.length
					}
				};
			} else {
				return {
					success: false,
					error: new Error(checkResult.error?.message || "Health checks failed"),
					metadata: {
						errorType: checkResult.error?.type,
						failedCheck: checkResult.error?.failedCheck,
						suggestion: checkResult.error?.suggestion,
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
		console.log("[workspace-health] Shutdown complete");
	}

	getCapabilities(): GoblinCapabilities {
		return {
			name: "Workspace Health Checker",
			description: "Run comprehensive health checks on the workspace including linting, testing, and smoke tests",
			version: "1.0.0",
			tags: ["health", "testing", "quality", "workspace"]
		};
	}
}

// Default export for backward compatibility
export default WorkspaceHealthGoblin;
