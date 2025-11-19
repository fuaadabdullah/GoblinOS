/**
 * Core logic for repo-bootstrap goblin
 * Handles repository environment setup and validation
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { RepoBootstrapConfig, BootstrapResult, BootstrapError } from "./types.js";

export class RepoBootstrapLogic {
	private config: RepoBootstrapConfig;

	constructor(config: RepoBootstrapConfig = {}) {
		this.config = {
			ensurePnpm: true,
			requiredNode: "18",
			setupGitHooks: true,
			...config
		};
	}

	/**
	 * Verify pnpm is available
	 */
	verifyPnpm(): { success: boolean; error?: BootstrapError } {
		try {
			const result = execSync("pnpm -v", { encoding: "utf8", stdio: "pipe" });
			const version = result.trim();
			console.log(`[bootstrap] pnpm ${version} available`);
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: {
					type: "pnpm_missing",
					message: "pnpm not found",
					suggestion: "Install pnpm 9+ with: npm install -g pnpm"
				}
			};
		}
	}

	/**
	 * Check Node.js version requirement
	 */
	checkNodeVersion(): { success: boolean; version?: string; error?: BootstrapError } {
		const required = this.config.requiredNode;
		if (!required) return { success: true };

		try {
			const current = process.versions.node.split(".")[0];
			const requiredNum = Number(required);

			if (Number(current) >= requiredNum) {
				console.log(`[bootstrap] Node.js ${current} meets requirement ${required}`);
				return { success: true, version: current };
			} else {
				return {
					success: false,
					version: current,
					error: {
						type: "node_version",
						message: `Node.js ${required}+ required, found ${current}`,
						suggestion: `Upgrade Node.js to version ${required} or higher`
					}
				};
			}
		} catch (error) {
			return {
				success: false,
				error: {
					type: "unknown",
					message: "Failed to check Node.js version",
					suggestion: "Ensure Node.js is properly installed"
				}
			};
		}
	}

	/**
	 * Setup git hooks for the repository
	 */
	setupGitHooks(): { success: boolean; error?: BootstrapError } {
		try {
			const gitDir = path.resolve(process.cwd(), ".git");
			const hooksDir = path.join(gitDir, "hooks");

			if (!fs.existsSync(gitDir)) {
				console.log("[bootstrap] No .git directory found, skipping git hooks setup");
				return { success: true };
			}

			if (!fs.existsSync(hooksDir)) {
				console.log("[bootstrap] No hooks directory found, skipping git hooks setup");
				return { success: true };
			}

			const preCommitPath = path.join(hooksDir, "pre-commit");
			const hookContent = "#!/usr/bin/env bash\npnpm -C GoblinOS check || exit 1\n";

			fs.writeFileSync(preCommitPath, hookContent);
			fs.chmodSync(preCommitPath, 0o755);

			console.log("[bootstrap] pre-commit hook installed");
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: {
					type: "git_hooks_failed",
					message: "Failed to setup git hooks",
					suggestion: "Ensure you have write permissions in the .git/hooks directory"
				}
			};
		}
	}

	/**
	 * Perform complete bootstrap validation and setup
	 */
	async bootstrap(): Promise<{ success: boolean; result?: BootstrapResult; error?: BootstrapError }> {
		const result: BootstrapResult = {
			messages: []
		};

		// Verify pnpm if required
		if (this.config.ensurePnpm) {
			const pnpmCheck = this.verifyPnpm();
			if (!pnpmCheck.success) {
				return { success: false, error: pnpmCheck.error };
			}
			result.pnpmVerified = true;
			result.messages!.push("pnpm verified");
		}

		// Check Node.js version
		const nodeCheck = this.checkNodeVersion();
		if (!nodeCheck.success) {
			return { success: false, error: nodeCheck.error };
		}
		result.nodeVersion = nodeCheck.version;
		result.messages!.push(`Node.js ${nodeCheck.version} verified`);

		// Setup git hooks if required
		if (this.config.setupGitHooks) {
			const hooksCheck = this.setupGitHooks();
			if (!hooksCheck.success) {
				return { success: false, error: hooksCheck.error };
			}
			result.gitHooksSetup = true;
			result.messages!.push("git hooks setup");
		}

		return { success: true, result };
	}
}
