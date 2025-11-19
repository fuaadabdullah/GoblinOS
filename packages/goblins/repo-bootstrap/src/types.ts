/**
 * TypeScript interfaces for repo-bootstrap goblin
 */

export interface RepoBootstrapConfig {
	/** Whether to ensure pnpm is available */
	ensurePnpm?: boolean;
	/** Minimum required Node.js version */
	requiredNode?: string;
	/** Whether to setup git hooks during bootstrap */
	setupGitHooks?: boolean;
}

export interface BootstrapResult {
	/** Whether pnpm was verified/available */
	pnpmVerified?: boolean;
	/** Node.js version that was verified */
	nodeVersion?: string;
	/** Whether git hooks were set up */
	gitHooksSetup?: boolean;
	/** Any setup messages */
	messages?: string[];
}

export interface BootstrapError {
	/** Type of bootstrap error */
	type: 'pnpm_missing' | 'node_version' | 'git_hooks_failed' | 'unknown';
	/** Human-readable error message */
	message: string;
	/** Suggested fix */
	suggestion?: string;
}
