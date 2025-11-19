/**
 * Core logic for workspace-health goblin
 * Handles running comprehensive health checks on the workspace
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import type { WorkspaceHealthConfig, HealthCheckResult, HealthCheckSummary, HealthCheckError } from "./types.js";

export class WorkspaceHealthLogic {
	private config: WorkspaceHealthConfig;

	constructor(config: WorkspaceHealthConfig = {}) {
		this.config = {
			runEslint: true,
			runTypecheck: true,
			runTests: true,
			runSmoke: true,
			smokeUrl: "http://localhost:3000",
			timeout: 30000,
			...config
		};
	}

	/**
	 * Run ESLint checks
	 */
	async runEslintCheck(): Promise<HealthCheckResult> {
		const startTime = Date.now();
		console.log(`[workspace-health] Starting ESLint check`);

		try {
			// Find monorepo root
			const monorepoRoot = this.findMonorepoRoot();
			console.log(`[workspace-health] Running ESLint from: ${monorepoRoot}`);
			const exitCode = await this.runCommand("pnpm", ["-C", "GoblinOS", "lint"], { cwd: monorepoRoot });
			const duration = Date.now() - startTime;
			console.log(`[workspace-health] ESLint check completed with exit code: ${exitCode}`);

			return {
				exitCode,
				checkName: "eslint",
				passed: exitCode === 0,
				duration
			};
		} catch (error) {
			console.log(`[workspace-health] ESLint check failed:`, error);
			return {
				exitCode: 1,
				checkName: "eslint",
				passed: false,
				duration: Date.now() - startTime
			};
		}
	}

	/**
	 * Run TypeScript type checking
	 */
	async runTypecheckCheck(): Promise<HealthCheckResult> {
		const startTime = Date.now();

		try {
			// Find monorepo root
			const monorepoRoot = this.findMonorepoRoot();
			const exitCode = await this.runCommand("pnpm", ["-C", "GoblinOS", "check:ts"], { cwd: monorepoRoot });
			const duration = Date.now() - startTime;

			return {
				exitCode,
				checkName: "typecheck",
				passed: exitCode === 0,
				duration
			};
		} catch (error) {
			return {
				exitCode: 1,
				checkName: "typecheck",
				passed: false,
				duration: Date.now() - startTime
			};
		}
	}

	/**
	 * Run test suite
	 */
	async runTestsCheck(): Promise<HealthCheckResult> {
		const startTime = Date.now();

		try {
			// Find monorepo root
			const monorepoRoot = this.findMonorepoRoot();
			const exitCode = await this.runCommand("pnpm", ["-C", "GoblinOS", "test"], { cwd: monorepoRoot });
			const duration = Date.now() - startTime;

			return {
				exitCode,
				checkName: "tests",
				passed: exitCode === 0,
				duration
			};
		} catch (error) {
			return {
				exitCode: 1,
				checkName: "tests",
				passed: false,
				duration: Date.now() - startTime
			};
		}
	}

	/**
	 * Run smoke tests
	 */
	async runSmokeCheck(): Promise<HealthCheckResult> {
		const startTime = Date.now();

		try {
			// Simple HTTP check to the smoke URL
			const exitCode = await this.runCommand("curl", ["-f", "-s", "--max-time", "10", this.config.smokeUrl!]);
			const duration = Date.now() - startTime;

			return {
				exitCode,
				checkName: "smoke",
				passed: exitCode === 0,
				duration
			};
		} catch (error) {
			return {
				exitCode: 1,
				checkName: "smoke",
				passed: false,
				duration: Date.now() - startTime
			};
		}
	}

	/**
	 * Run all configured health checks
	 */
	async runAllChecks(): Promise<{ success: boolean; summary: HealthCheckSummary; error?: HealthCheckError }> {
		const startTime = Date.now();
		const results: HealthCheckResult[] = [];

		try {
			// Run checks based on configuration
			const checkPromises: Promise<HealthCheckResult>[] = [];

			if (this.config.runEslint) {
				checkPromises.push(this.runEslintCheck());
			}

			if (this.config.runTypecheck) {
				checkPromises.push(this.runTypecheckCheck());
			}

			if (this.config.runTests) {
				checkPromises.push(this.runTestsCheck());
			}

			if (this.config.runSmoke) {
				checkPromises.push(this.runSmokeCheck());
			}

			// Wait for all checks to complete
			results.push(...await Promise.all(checkPromises));

			// Determine overall success
			const overallSuccess = results.every(result => result.passed);
			const totalDuration = Date.now() - startTime;

			const summary: HealthCheckSummary = {
				results,
				overallSuccess,
				message: overallSuccess ? "All health checks passed" : "Some health checks failed",
				totalDuration
			};

			return { success: true, summary };
		} catch (error) {
			return {
				success: false,
				summary: {
					results,
					overallSuccess: false,
					message: "Health check execution failed",
					totalDuration: Date.now() - startTime
				},
				error: {
					type: "execution_failed",
					message: `Failed to run health checks: ${(error as Error).message}`,
					suggestion: "Check that all required tools are installed and accessible"
				}
			};
		}
	}

	/**
	 * Find the monorepo root directory by looking for package.json
	 */
	private findMonorepoRoot(): string {
		// Start from the current directory and go up until we find a package.json with "forgemonorepo" name
		let currentDir = process.cwd();

		console.log(`[workspace-health] Looking for monorepo root starting from: ${currentDir}`);

		while (currentDir !== dirname(currentDir)) { // Stop at root
			const packageJsonPath = join(currentDir, 'package.json');
			if (existsSync(packageJsonPath)) {
				try {
					const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
					console.log(`[workspace-health] Found package.json in ${currentDir}, name: ${packageJson.name}`);
					if (packageJson.name === 'forgemonorepo') {
						console.log(`[workspace-health] Found monorepo root: ${currentDir}`);
						return currentDir;
					}
				} catch (error) {
					console.log(`[workspace-health] Error reading package.json in ${currentDir}:`, error);
				}
			}
			currentDir = dirname(currentDir);
		}

		// Fallback: assume we're in GoblinOS/packages/goblins/workspace-health
		// Go up 4 levels: workspace-health -> goblins -> packages -> GoblinOS -> monorepo root
		const fallback = resolve(__dirname, '../../../../../');
		console.log(`[workspace-health] Using fallback monorepo root: ${fallback}`);
		return fallback;
	}

	/**
	 * Helper method to run shell commands
	 */
	private async runCommand(command: string, args: string[], options: { cwd?: string } = {}): Promise<number> {
		return new Promise((resolve) => {
			const child = spawn(command, args, {
				stdio: "inherit",
				shell: true,
				timeout: this.config.timeout,
				cwd: options.cwd
			});

			child.on("exit", (code: number | null) => {
				resolve(code ?? 1);
			});

			child.on("error", () => {
				resolve(1);
			});
		});
	}
}
