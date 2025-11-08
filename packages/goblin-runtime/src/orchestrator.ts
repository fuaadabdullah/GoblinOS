/**
 * Orchestrator Service - Multi-goblin task coordination
 *
 * Parses natural language orchestration syntax:
 * - Sequential: "build THEN test THEN deploy"
 * - Parallel: "lint AND format AND type-check"
 * - Conditional: "test IF passing THEN deploy"
 *
 * Features:
 * - Dependency resolution
 * - Parallel execution batching
 * - Conditional branching
 * - Execution plan generation
 * - Progress tracking
 */

export interface OrchestrationStep {
	id: string;
	goblinId: string;
	task: string;
	dependencies: string[]; // IDs of steps that must complete first
	condition?: {
		stepId: string; // Step whose result to check
		operator: "IF_SUCCESS" | "IF_FAILURE" | "IF_CONTAINS";
		value?: string; // For IF_CONTAINS checks
	};
	status: "pending" | "running" | "completed" | "failed" | "skipped";
	result?: {
		output: string;
		error?: string;
		duration: number;
		startedAt: Date;
		completedAt: Date;
	};
}

export interface OrchestrationPlan {
	id: string;
	description: string;
	steps: OrchestrationStep[];
	createdAt: Date;
	status: "pending" | "running" | "completed" | "failed" | "cancelled";
	text?: string; // Original text for reference
	metadata: {
		totalSteps: number;
		parallelBatches: number;
		estimatedDuration?: string; // e.g., "4s" or "2m"
		originalText?: string;
	};
}

export interface OrchestrationProgress {
	planId: string;
	currentStep: number;
	totalSteps: number;
	completedSteps: number;
	failedSteps: number;
	skippedSteps: number;
	status: OrchestrationPlan["status"];
	currentBatch?: {
		stepIds: string[];
		progress: Record<string, number>; // stepId -> progress %
	};
}

/**
 * Parse orchestration syntax into execution plan
 *
 * Syntax patterns:
 * - "goblin1: task1 THEN goblin2: task2" - Sequential
 * - "goblin1: task1 AND goblin2: task2" - Parallel
 * - "goblin1: task1 IF success THEN goblin2: task2" - Conditional
 * - Mixed: "build AND test THEN deploy IF passing"
 */
export class OrchestrationParser {
	private static OPERATORS = {
		THEN: /\s+THEN\s+/gi,
		AND: /\s+AND\s+/gi,
		IF: /\s+IF\s+/gi,
	};

	/**
	 * Parse orchestration text into execution plan
	 */
	static parse(text: string, defaultGoblinId?: string): OrchestrationPlan {
		// Validate input
		if (!text || text.trim().length === 0) {
			throw new Error("Orchestration text cannot be empty");
		}

		// Validate syntax - check for invalid patterns
		if (
			/^(THEN|AND|IF)\s+/i.test(text.trim()) ||
			/\s+(THEN|AND)\s+(THEN|AND)\s+/i.test(text)
		) {
			throw new Error("Invalid orchestration syntax");
		}

		const planId = `orch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Split by THEN for sequential phases
		const phases = this.splitByOperator(text, this.OPERATORS.THEN);

		const steps: OrchestrationStep[] = [];
		let previousPhaseStepIds: string[] = [];

		for (const phase of phases) {
			// Split phase by AND for parallel tasks
			const parallelTasks = this.splitByOperator(phase, this.OPERATORS.AND);
			const currentPhaseStepIds: string[] = [];
			let lastGoblinId = defaultGoblinId; // Track goblin ID within parallel group

			for (const taskText of parallelTasks) {
				const step = this.parseTask(taskText, lastGoblinId);

				// Update lastGoblinId if this task had an explicit goblin ID
				if (taskText.includes(":") && taskText.indexOf(":") < 30) {
					const potentialGoblinId = taskText
						.substring(0, taskText.indexOf(":"))
						.trim();
					if (
						!potentialGoblinId.includes(" ") &&
						potentialGoblinId.length < 30
					) {
						lastGoblinId = potentialGoblinId;
					}
				}

				// Add dependencies on previous phase
				step.dependencies = [...previousPhaseStepIds];

				steps.push(step);
				currentPhaseStepIds.push(step.id);
			}

			previousPhaseStepIds = currentPhaseStepIds;
		}

		// Calculate parallel batches
		const batches = this.calculateBatches(steps);

		// Calculate estimated duration (rough estimate: 2 seconds per step per batch)
		const estimatedDurationMs = batches * 2000;
		const estimatedDuration =
			estimatedDurationMs < 60000
				? `${Math.ceil(estimatedDurationMs / 1000)}s`
				: `${Math.ceil(estimatedDurationMs / 60000)}m`;

		return {
			id: planId,
			description: text.substring(0, 100),
			steps,
			createdAt: new Date(),
			status: "pending",
			text, // Add original text at top level
			metadata: {
				totalSteps: steps.length,
				parallelBatches: batches,
				estimatedDuration,
				originalText: text,
			},
		};
	}

	/**
	 * Split text by operator while preserving order
	 */
	private static splitByOperator(text: string, operator: RegExp): string[] {
		const parts = text.split(operator);
		return parts.map((p) => p.trim()).filter((p) => p.length > 0);
	}

	/**
	 * Parse individual task: "goblinId: task description"
	 * If no goblinId specified, uses default
	 */
	private static parseTask(
		taskText: string,
		defaultGoblinId?: string,
	): OrchestrationStep {
		const stepId = `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Check for explicit conditional syntax: "task IF_SUCCESS", "task IF_FAILURE", "task IF_CONTAINS("value")"
		let condition: OrchestrationStep["condition"] | undefined;
		let cleanTaskText = taskText;

		// Match IF_SUCCESS or IF_FAILURE
		const explicitIfMatch = taskText.match(/(.+?)\s+IF_(SUCCESS|FAILURE)\s*$/i);
		if (explicitIfMatch) {
			cleanTaskText = explicitIfMatch[1].trim();
			condition = {
				stepId: "previous",
				operator: `IF_${explicitIfMatch[2].toUpperCase()}` as
					| "IF_SUCCESS"
					| "IF_FAILURE",
			};
		}

		// Match IF_CONTAINS("value")
		const containsMatch = taskText.match(
			/(.+?)\s+IF_CONTAINS\s*\(\s*["']([^"']+)["']\s*\)\s*$/i,
		);
		if (containsMatch) {
			cleanTaskText = containsMatch[1].trim();
			condition = {
				stepId: "previous",
				operator: "IF_CONTAINS",
				value: containsMatch[2],
			};
		}

		// Also check for natural language conditional syntax: "task IF success/failure/passing"
		if (!condition) {
			const ifMatch = taskText.match(
				/(.+?)\s+IF\s+(success|failure|passing|failing)/i,
			);
			if (ifMatch) {
				cleanTaskText = ifMatch[1].trim();
				const conditionType = ifMatch[2].toLowerCase();

				condition = {
					stepId: "previous", // Will be resolved during execution
					operator:
						conditionType === "success" || conditionType === "passing"
							? "IF_SUCCESS"
							: "IF_FAILURE",
				};
			}
		}

		// Parse goblinId: task format
		const colonIndex = cleanTaskText.indexOf(":");
		let goblinId = defaultGoblinId || "unknown";
		let task = cleanTaskText;

		if (colonIndex > 0 && colonIndex < 30) {
			// Reasonable goblin ID length
			const potentialGoblinId = cleanTaskText.substring(0, colonIndex).trim();
			// Simple validation: no spaces, reasonable length
			if (!potentialGoblinId.includes(" ") && potentialGoblinId.length < 30) {
				goblinId = potentialGoblinId;
				task = cleanTaskText.substring(colonIndex + 1).trim();
			}
		}

		return {
			id: stepId,
			goblinId,
			task,
			dependencies: [],
			condition,
			status: "pending",
		};
	}

	/**
	 * Calculate number of parallel execution batches
	 */
	private static calculateBatches(steps: OrchestrationStep[]): number {
		const maxDepth = steps.reduce((max, step) => {
			const depth = this.getStepDepth(step, steps);
			return Math.max(max, depth);
		}, 0);

		return maxDepth + 1;
	}

	/**
	 * Get execution depth of step (based on dependencies)
	 */
	private static getStepDepth(
		step: OrchestrationStep,
		allSteps: OrchestrationStep[],
	): number {
		if (step.dependencies.length === 0) return 0;

		const depthsOfDeps = step.dependencies.map((depId) => {
			const depStep = allSteps.find((s) => s.id === depId);
			return depStep ? this.getStepDepth(depStep, allSteps) + 1 : 0;
		});

		return Math.max(...depthsOfDeps);
	}
}

/**
 * Execute orchestration plans
 */
export class OrchestrationExecutor {
	private activePlans = new Map<string, OrchestrationPlan>();
	private progressCallbacks = new Map<
		string,
		(progress: OrchestrationProgress) => void
	>();

	/**
	 * Execute orchestration plan
	 *
	 * @param plan - Orchestration plan to execute
	 * @param executeTask - Function to execute a single task
	 * @param onProgress - Progress callback (optional)
	 */
	async execute(
		plan: OrchestrationPlan,
		executeTask: (
			goblinId: string,
			task: string,
		) => Promise<{ output: string; duration: number }>,
		onProgress?: (progress: OrchestrationProgress) => void,
	): Promise<OrchestrationPlan> {
		this.activePlans.set(plan.id, plan);
		if (onProgress) {
			this.progressCallbacks.set(plan.id, onProgress);
		}

		plan.status = "running";
		this.notifyProgress(plan);

		try {
			// Execute in batches (steps with same depth run in parallel)
			const batches = this.groupIntoBatches(plan.steps);

			for (const batch of batches) {
				await this.executeBatch(batch, executeTask, plan);

				// Check if any step failed and should stop execution
				const hasFailedCriticalStep = batch.some(
					(step) => step.status === "failed" && !step.condition,
				);

				if (hasFailedCriticalStep) {
					plan.status = "failed";
					break;
				}
			}

			// Mark plan as completed if no failures
			if (plan.status === "running") {
				plan.status = "completed";
			}
		} catch (error) {
			plan.status = "failed";
			console.error("Orchestration execution failed:", error);
		} finally {
			this.notifyProgress(plan);
			this.progressCallbacks.delete(plan.id);
		}

		return plan;
	}

	/**
	 * Group steps into parallel batches
	 */
	private groupIntoBatches(steps: OrchestrationStep[]): OrchestrationStep[][] {
		const batches: OrchestrationStep[][] = [];
		const processed = new Set<string>();

		while (processed.size < steps.length) {
			const batch = steps.filter((step) => {
				// Skip already processed
				if (processed.has(step.id)) return false;

				// Check if all dependencies are completed
				const depsCompleted = step.dependencies.every((depId) =>
					processed.has(depId),
				);

				return depsCompleted;
			});

			if (batch.length === 0) break; // Circular dependency or error

			batches.push(batch);
			batch.forEach((step) => processed.add(step.id));
		}

		return batches;
	}

	/**
	 * Execute a batch of steps in parallel
	 */
	private async executeBatch(
		batch: OrchestrationStep[],
		executeTask: (
			goblinId: string,
			task: string,
		) => Promise<{ output: string; duration: number }>,
		plan: OrchestrationPlan,
	): Promise<void> {
		const executions = batch.map((step) =>
			this.executeStep(step, executeTask, plan),
		);
		await Promise.allSettled(executions);
	}

	/**
	 * Execute a single step
	 */
	private async executeStep(
		step: OrchestrationStep,
		executeTask: (
			goblinId: string,
			task: string,
		) => Promise<{ output: string; duration: number }>,
		plan: OrchestrationPlan,
	): Promise<void> {
		// Check condition if present
		if (step.condition) {
			const conditionMet = this.evaluateCondition(step, plan);
			if (!conditionMet) {
				step.status = "skipped";
				this.notifyProgress(plan);
				return;
			}
		}

		step.status = "running";
		const startedAt = new Date();
		this.notifyProgress(plan);

		try {
			const result = await executeTask(step.goblinId, step.task);

			step.status = "completed";
			step.result = {
				output: result.output,
				duration: result.duration,
				startedAt,
				completedAt: new Date(),
			};
		} catch (error) {
			step.status = "failed";
			step.result = {
				output: "",
				error: error instanceof Error ? error.message : String(error),
				duration: Date.now() - startedAt.getTime(),
				startedAt,
				completedAt: new Date(),
			};
		}

		this.notifyProgress(plan);
	}

	/**
	 * Evaluate conditional step
	 */
	private evaluateCondition(
		step: OrchestrationStep,
		plan: OrchestrationPlan,
	): boolean {
		if (!step.condition) return true;

		// Find the dependency step to check
		let checkStepId = step.condition.stepId;
		if (checkStepId === "previous" && step.dependencies.length > 0) {
			checkStepId = step.dependencies[step.dependencies.length - 1];
		}

		const checkStep = plan.steps.find((s) => s.id === checkStepId);
		if (!checkStep || !checkStep.result) return false;

		switch (step.condition.operator) {
			case "IF_SUCCESS":
				return checkStep.status === "completed";
			case "IF_FAILURE":
				return checkStep.status === "failed";
			case "IF_CONTAINS":
				return step.condition.value
					? checkStep.result.output.includes(step.condition.value)
					: false;
			default:
				return false;
		}
	}

	/**
	 * Notify progress callback
	 */
	private notifyProgress(plan: OrchestrationPlan): void {
		const callback = this.progressCallbacks.get(plan.id);
		if (!callback) return;

		const progress: OrchestrationProgress = {
			planId: plan.id,
			currentStep: plan.steps.findIndex((s) => s.status === "running") + 1,
			totalSteps: plan.steps.length,
			completedSteps: plan.steps.filter((s) => s.status === "completed").length,
			failedSteps: plan.steps.filter((s) => s.status === "failed").length,
			skippedSteps: plan.steps.filter((s) => s.status === "skipped").length,
			status: plan.status,
		};

		callback(progress);
	}

	/**
	 * Cancel running orchestration
	 */
	cancel(planId: string): void {
		const plan = this.activePlans.get(planId);
		if (plan && plan.status === "running") {
			plan.status = "cancelled";
			this.notifyProgress(plan);
		}
	}

	/**
	 * Get plan by ID
	 */
	getPlan(planId: string): OrchestrationPlan | undefined {
		return this.activePlans.get(planId);
	}

	/**
	 * Get all active plans
	 */
	getActivePlans(): OrchestrationPlan[] {
		return Array.from(this.activePlans.values());
	}
}

/**
 * In-memory orchestration store
 */
export class OrchestrationStore {
	private plans = new Map<string, OrchestrationPlan>();
	private maxStoredPlans = 100;

	/**
	 * Save orchestration plan
	 */
	save(plan: OrchestrationPlan): void {
		this.plans.set(plan.id, plan);

		// Prune old plans if over limit
		if (this.plans.size > this.maxStoredPlans) {
			const sortedPlans = Array.from(this.plans.values()).sort(
				(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
			);

			// Keep only the most recent plans
			this.plans.clear();
			sortedPlans.slice(0, this.maxStoredPlans).forEach((p) => {
				this.plans.set(p.id, p);
			});
		}
	}

	/**
	 * Get plan by ID
	 */
	get(planId: string): OrchestrationPlan | undefined {
		return this.plans.get(planId);
	}

	/**
	 * Get all plans (most recent first)
	 */
	getAll(): OrchestrationPlan[] {
		return Array.from(this.plans.values()).sort(
			(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
		);
	}

	/**
	 * Get plans by status
	 */
	getByStatus(status: OrchestrationPlan["status"]): OrchestrationPlan[] {
		return this.getAll().filter((p) => p.status === status);
	}

	/**
	 * Delete plan
	 */
	delete(planId: string): boolean {
		return this.plans.delete(planId);
	}

	/**
	 * Clear all plans
	 */
	clear(): void {
		this.plans.clear();
	}
}
