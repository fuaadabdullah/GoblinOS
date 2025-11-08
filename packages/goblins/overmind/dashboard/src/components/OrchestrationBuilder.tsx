/**
 * OrchestrationBuilder - Visual drag-and-drop workflow editor
 *
 * Features:
 * - Add/remove steps visually
 * - Configure step type (THEN/AND/IF)
 * - Assign goblins to steps
 * - Preview generated orchestration syntax
 * - Export to TaskExecutor
 */

import { useState } from "react";
import type { Goblin } from "../api/runtime-client";

interface WorkflowStep {
	id: string;
	goblinId: string;
	task: string;
	type: "sequential" | "parallel" | "conditional";
	condition?: "success" | "failure" | "contains";
	conditionValue?: string;
}

interface OrchestrationBuilderProps {
	goblins: Goblin[];
	onGenerate: (syntax: string) => void;
	onClose: () => void;
}

export function OrchestrationBuilder({
	goblins,
	onGenerate,
	onClose,
}: OrchestrationBuilderProps) {
	const [steps, setSteps] = useState<WorkflowStep[]>([
		{
			id: crypto.randomUUID(),
			goblinId: goblins[0]?.id || "",
			task: "",
			type: "sequential",
		},
	]);
	const [syntax, setSyntax] = useState("");

	// Add a new step
	const addStep = (type: WorkflowStep["type"]) => {
		const newStep: WorkflowStep = {
			id: crypto.randomUUID(),
			goblinId: goblins[0]?.id || "",
			task: "",
			type,
		};
		setSteps([...steps, newStep]);
	};

	// Remove a step
	const removeStep = (id: string) => {
		if (steps.length === 1) return; // Keep at least one step
		setSteps(steps.filter((s) => s.id !== id));
	};

	// Update step properties
	const updateStep = (id: string, updates: Partial<WorkflowStep>) => {
		setSteps(steps.map((s) => (s.id === id ? { ...s, ...updates } : s)));
	};

	// Move step up
	const moveStepUp = (index: number) => {
		if (index === 0) return;
		const newSteps = [...steps];
		[newSteps[index - 1], newSteps[index]] = [
			newSteps[index],
			newSteps[index - 1],
		];
		setSteps(newSteps);
	};

	// Move step down
	const moveStepDown = (index: number) => {
		if (index === steps.length - 1) return;
		const newSteps = [...steps];
		[newSteps[index], newSteps[index + 1]] = [
			newSteps[index + 1],
			newSteps[index],
		];
		setSteps(newSteps);
	};

	// Generate orchestration syntax
	const generateSyntax = () => {
		if (steps.length === 0) {
			setSyntax("");
			return;
		}

		const parts: string[] = [];
		let parallelGroup: string[] = [];

		steps.forEach((step, index) => {
			const goblin = goblins.find((g) => g.id === step.goblinId);
			const goblinPrefix = goblin ? `${goblin.id}: ` : "";
			const taskText = step.task || "[task]";

			if (step.type === "parallel") {
				// Collect parallel steps
				parallelGroup.push(`${goblinPrefix}${taskText}`);

				// If next step is not parallel or this is last step, flush parallel group
				if (
					index === steps.length - 1 ||
					steps[index + 1].type !== "parallel"
				) {
					parts.push(parallelGroup.join(" AND "));
					parallelGroup = [];
				}
			} else if (step.type === "conditional") {
				// Conditional step
				const conditionMap = {
					success: "IF_SUCCESS",
					failure: "IF_FAILURE",
					contains: `IF_CONTAINS("${step.conditionValue || ""}")`,
				};
				const condition = conditionMap[step.condition || "success"];
				parts.push(`${goblinPrefix}${taskText} ${condition}`);
			} else {
				// Sequential step
				parts.push(`${goblinPrefix}${taskText}`);
			}
		});

		const generatedSyntax = parts.join(" THEN ");
		setSyntax(generatedSyntax);
	};

	// Handle generate button click
	const handleGenerate = () => {
		generateSyntax();
	};

	// Handle use syntax button
	const handleUseSyntax = () => {
		if (syntax) {
			onGenerate(syntax);
			onClose();
		}
	};

	// Get goblin name
	const getGoblinName = (goblinId: string) => {
		return goblins.find((g) => g.id === goblinId)?.name || goblinId;
	};

	return (
		<div className="orchestration-builder-overlay" onClick={onClose}>
			<div
				className="orchestration-builder-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="builder-header">
					<h2>Orchestration Builder</h2>
					<button className="close-btn" onClick={onClose}>
						×
					</button>
				</div>

				<div className="builder-content">
					{/* Steps List */}
					<div className="steps-section">
						<div className="section-header">
							<h3>Workflow Steps</h3>
							<div className="add-step-buttons">
								<button
									className="add-step-btn sequential"
									onClick={() => addStep("sequential")}
									title="Add sequential step (THEN)"
								>
									+ Sequential
								</button>
								<button
									className="add-step-btn parallel"
									onClick={() => addStep("parallel")}
									title="Add parallel step (AND)"
								>
									+ Parallel
								</button>
								<button
									className="add-step-btn conditional"
									onClick={() => addStep("conditional")}
									title="Add conditional step (IF)"
								>
									+ Conditional
								</button>
							</div>
						</div>

						<div className="steps-list">
							{steps.map((step, index) => (
								<div key={step.id} className={`step-card ${step.type}`}>
									<div className="step-header">
										<span className="step-number">#{index + 1}</span>
										<span className="step-type-badge">{step.type}</span>
										<div className="step-controls">
											<button
												className="icon-btn"
												onClick={() => moveStepUp(index)}
												disabled={index === 0}
												title="Move up"
											>
												↑
											</button>
											<button
												className="icon-btn"
												onClick={() => moveStepDown(index)}
												disabled={index === steps.length - 1}
												title="Move down"
											>
												↓
											</button>
											<button
												className="icon-btn delete"
												onClick={() => removeStep(step.id)}
												disabled={steps.length === 1}
												title="Delete step"
											>
												🗑
											</button>
										</div>
									</div>

									<div className="step-body">
										{/* Goblin selection */}
										<div className="form-group">
											<label>Goblin:</label>
											<select
												value={step.goblinId}
												onChange={(e) =>
													updateStep(step.id, { goblinId: e.target.value })
												}
											>
												{goblins.map((g) => (
													<option key={g.id} value={g.id}>
														{g.name}
													</option>
												))}
											</select>
										</div>

										{/* Task input */}
										<div className="form-group">
											<label>Task:</label>
											<input
												type="text"
												value={step.task}
												onChange={(e) =>
													updateStep(step.id, { task: e.target.value })
												}
												placeholder="Enter task description..."
											/>
										</div>

										{/* Conditional settings */}
										{step.type === "conditional" && (
											<>
												<div className="form-group">
													<label>Condition:</label>
													<select
														value={step.condition || "success"}
														onChange={(e) =>
															updateStep(step.id, {
																condition: e.target.value as any,
															})
														}
													>
														<option value="success">If Success</option>
														<option value="failure">If Failure</option>
														<option value="contains">If Contains</option>
													</select>
												</div>

												{step.condition === "contains" && (
													<div className="form-group">
														<label>Contains Value:</label>
														<input
															type="text"
															value={step.conditionValue || ""}
															onChange={(e) =>
																updateStep(step.id, {
																	conditionValue: e.target.value,
																})
															}
															placeholder="Text to check for..."
														/>
													</div>
												)}
											</>
										)}

										{/* Step type info */}
										<div className="step-info">
											{step.type === "sequential" && (
												<span>Will execute after previous step completes</span>
											)}
											{step.type === "parallel" && (
												<span>
													Will execute in parallel with adjacent parallel steps
												</span>
											)}
											{step.type === "conditional" && (
												<span>Will execute only if condition is met</span>
											)}
										</div>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Preview Section */}
					<div className="preview-section">
						<div className="section-header">
							<h3>Generated Syntax</h3>
							<button className="generate-btn" onClick={handleGenerate}>
								Generate
							</button>
						</div>

						{syntax ? (
							<div className="syntax-preview">
								<code>{syntax}</code>
							</div>
						) : (
							<div className="empty-preview">
								Click "Generate" to preview orchestration syntax
							</div>
						)}

						{/* Visual Flow Preview */}
						{syntax && (
							<div className="flow-preview">
								<h4>Execution Flow</h4>
								<div className="flow-diagram">
									{steps.map((step, index) => (
										<div key={step.id} className="flow-item">
											<div className="flow-node">
												<div className="flow-node-header">
													<span className="flow-goblin">
														{getGoblinName(step.goblinId)}
													</span>
												</div>
												<div className="flow-node-body">
													{step.task || "[task]"}
												</div>
												{step.type === "conditional" && (
													<div className="flow-node-condition">
														{step.condition === "success" && "✓ If Success"}
														{step.condition === "failure" && "✗ If Failure"}
														{step.condition === "contains" &&
															`⊃ Contains "${step.conditionValue}"`}
													</div>
												)}
											</div>
											{index < steps.length - 1 && (
												<div
													className={`flow-connector ${
														steps[index + 1].type === "parallel"
															? "parallel"
															: "sequential"
													}`}
												>
													{steps[index + 1].type === "parallel" ? "⋮" : "↓"}
												</div>
											)}
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>

				<div className="builder-footer">
					<button className="cancel-btn" onClick={onClose}>
						Cancel
					</button>
					<button
						className="use-syntax-btn"
						onClick={handleUseSyntax}
						disabled={!syntax}
					>
						Use This Workflow
					</button>
				</div>
			</div>
		</div>
	);
}
