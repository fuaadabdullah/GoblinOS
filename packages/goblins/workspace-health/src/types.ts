/**
 * TypeScript interfaces for workspace-health goblin
 */

export interface WorkspaceHealthConfig {
	/** Whether to run ESLint checks */
	runEslint?: boolean;
	/** Whether to run TypeScript type checking */
	runTypecheck?: boolean;
	/** Whether to run test suites */
	runTests?: boolean;
	/** Whether to run smoke tests */
	runSmoke?: boolean;
	/** URL to test for smoke tests */
	smokeUrl?: string;
	/** Timeout in milliseconds for health checks */
	timeout?: number;
}

export interface HealthCheckResult {
	/** Exit code from the health check (0 = success) */
	exitCode: number;
	/** Name of the check that was run */
	checkName: string;
	/** Whether this check passed */
	passed: boolean;
	/** Duration in milliseconds */
	duration?: number;
}

export interface HealthCheckSummary {
	/** Individual check results */
	results: HealthCheckResult[];
	/** Overall success status */
	overallSuccess: boolean;
	/** Summary message */
	message: string;
	/** Total duration in milliseconds */
	totalDuration?: number;
}

export interface HealthCheckError {
	/** Type of health check error */
	type: 'timeout' | 'execution_failed' | 'configuration_error' | 'unknown';
	/** Human-readable error message */
	message: string;
	/** Which check failed */
	failedCheck?: string;
	/** Suggested fix */
	suggestion?: string;
}
