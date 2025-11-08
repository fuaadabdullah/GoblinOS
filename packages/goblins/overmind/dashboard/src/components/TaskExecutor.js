/**
 * TaskExecutor - Execute tasks with streaming output
 *
 * Features:
 * - Textarea for task input
 * - Execute button with loading state
 * - Streaming output with typewriter effect
 * - Real-time chunk rendering
 * - Error handling
 */
import { useEffect, useRef, useState } from "react";
import {
	Fragment as _Fragment,
	jsx as _jsx,
	jsxs as _jsxs,
} from "react/jsx-runtime";
export function TaskExecutor({ client, selectedGoblin, onTaskComplete }) {
	const [task, setTask] = useState("");
	const [isExecuting, setIsExecuting] = useState(false);
	const [output, setOutput] = useState("");
	const [error, setError] = useState(null);
	const [orchestrationPlan, setOrchestrationPlan] = useState(null);
	const [showOrchestrationPreview, setShowOrchestrationPreview] =
		useState(false);
	const outputRef = useRef(null);
	// Detect orchestration keywords in task text
	const hasOrchestrationKeywords = (text) => {
		const keywords = /\b(THEN|AND|IF)\b/i;
		return keywords.test(text);
	};
	// Parse orchestration plan when task contains keywords
	useEffect(() => {
		const parseOrchestration = async () => {
			if (task.trim() && hasOrchestrationKeywords(task)) {
				try {
					const plan = await client.parseOrchestration(
						task.trim(),
						selectedGoblin?.id,
					);
					setOrchestrationPlan(plan);
					setShowOrchestrationPreview(true);
				} catch {
					setOrchestrationPlan(null);
					setShowOrchestrationPreview(false);
				}
			} else {
				setOrchestrationPlan(null);
				setShowOrchestrationPreview(false);
			}
		};
		const timeoutId = setTimeout(parseOrchestration, 500); // Debounce
		return () => clearTimeout(timeoutId);
	}, [task, selectedGoblin, client]);
	// Auto-scroll output to bottom
	useEffect(() => {
		if (outputRef.current) {
			outputRef.current.scrollTop = outputRef.current.scrollHeight;
		}
	}, [output]);
	const handleExecute = async () => {
		if (!selectedGoblin || !task.trim()) return;
		setIsExecuting(true);
		setOutput("");
		setError(null);
		try {
			// Check if this is an orchestration task
			if (orchestrationPlan && orchestrationPlan.steps.length > 1) {
				// Execute as orchestration
				setOutput("🎭 Executing orchestration plan...\n\n");
				const result = await client.executeOrchestration(
					task.trim(),
					selectedGoblin.id,
				);
				// Display results
				let resultOutput = `✅ Orchestration complete\n\n`;
				resultOutput += `Total steps: ${result.steps.length}\n`;
				resultOutput += `Status: ${result.status}\n\n`;
				for (const step of result.steps) {
					const icon =
						step.status === "completed"
							? "✅"
							: step.status === "failed"
								? "❌"
								: step.status === "skipped"
									? "⏭️"
									: "⏸️";
					resultOutput += `${icon} ${step.goblinId}: ${step.task}\n`;
					if (step.result) {
						resultOutput += `   Duration: ${step.result.duration}ms\n`;
						if (step.result.error) {
							resultOutput += `   Error: ${step.result.error}\n`;
						}
					}
					resultOutput += "\n";
				}
				setOutput(resultOutput);
				setIsExecuting(false);
				if (onTaskComplete) onTaskComplete();
			} else {
				// Execute as regular task with streaming
				if (!client.isConnected()) {
					await client.connect();
				}
				await client.executeTaskStreaming(
					{
						goblin: selectedGoblin.id,
						task: task.trim(),
					},
					(event) => {
						switch (event.type) {
							case "start":
								setOutput("🤖 " + selectedGoblin.title + " is thinking...\n\n");
								break;
							case "chunk":
								setOutput((prev) => prev + (event.data || ""));
								break;
							case "complete":
								setOutput((prev) => prev + "\n\n✅ Task complete");
								setIsExecuting(false);
								if (onTaskComplete) onTaskComplete();
								break;
							case "error":
								setError(event.error || "Unknown error");
								setIsExecuting(false);
								break;
						}
					},
				);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to execute task");
			setIsExecuting(false);
		}
	};
	const handleKeyDown = (e) => {
		// Cmd/Ctrl + Enter to execute
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			handleExecute();
		}
	};
	return _jsxs("div", {
		className: "task-executor",
		children: [
			_jsxs("div", {
				className: "executor-header",
				children: [
					_jsx("h2", { children: "Execute Task" }),
					selectedGoblin &&
						_jsxs("div", {
							className: "selected-goblin",
							children: [
								_jsx("span", {
									className: "text-muted",
									children: "Selected:",
								}),
								_jsx("span", {
									className: "text-accent",
									children: selectedGoblin.title,
								}),
							],
						}),
				],
			}),
			_jsxs("div", {
				className: "executor-input",
				children: [
					_jsx("label", {
						htmlFor: "task-input",
						className: "input-label",
						children: "Task Description",
					}),
					_jsx("textarea", {
						id: "task-input",
						className: "textarea",
						value: task,
						onChange: (e) => setTask(e.target.value),
						onKeyDown: handleKeyDown,
						placeholder: selectedGoblin
							? `Ask ${selectedGoblin.title} to do something...`
							: "Select a goblin first",
						disabled: !selectedGoblin || isExecuting,
						rows: 4,
					}),
					_jsx("div", {
						className: "input-hint text-muted",
						children: selectedGoblin
							? _jsxs(_Fragment, {
									children: [
										"Press ",
										_jsx("kbd", { children: "\u2318 Enter" }),
										" or click Execute",
										showOrchestrationPreview &&
											orchestrationPlan &&
											_jsxs("span", {
												className: "orchestration-hint",
												children: [
													" ",
													"\u2022 \uD83C\uDFAD Orchestration detected (",
													orchestrationPlan.steps.length,
													" ",
													"steps)",
												],
											}),
									],
								})
							: "Select a goblin from the left to start",
					}),
				],
			}),
			showOrchestrationPreview &&
				orchestrationPlan &&
				_jsxs("div", {
					className: "orchestration-preview",
					children: [
						_jsxs("div", {
							className: "preview-header",
							children: [
								_jsx("span", {
									className: "preview-icon",
									children: "\uD83C\uDFAD",
								}),
								_jsx("span", {
									className: "preview-title",
									children: "Orchestration Plan Preview",
								}),
								_jsxs("span", {
									className: "preview-badge",
									children: [
										orchestrationPlan.steps.length,
										" steps \u2022",
										" ",
										orchestrationPlan.metadata.parallelBatches,
										" batches",
									],
								}),
							],
						}),
						_jsx("div", {
							className: "preview-steps",
							children: orchestrationPlan.steps.map((step, idx) =>
								_jsxs(
									"div",
									{
										className: "preview-step",
										children: [
											_jsx("div", {
												className: "step-number",
												children: idx + 1,
											}),
											_jsxs("div", {
												className: "step-content",
												children: [
													_jsx("div", {
														className: "step-goblin",
														children: step.goblinId,
													}),
													_jsx("div", {
														className: "step-task",
														children: step.task,
													}),
													step.dependencies.length > 0 &&
														_jsxs("div", {
															className: "step-deps",
															children: [
																"Depends on: step ",
																orchestrationPlan.steps.findIndex(
																	(s) => s.id === step.dependencies[0],
																) + 1,
															],
														}),
													step.condition &&
														_jsxs("div", {
															className: "step-condition",
															children: [
																"Conditional: ",
																step.condition.operator,
															],
														}),
												],
											}),
										],
									},
									step.id,
								),
							),
						}),
					],
				}),
			_jsx("button", {
				className: "button button-primary execute-button",
				onClick: handleExecute,
				disabled: !selectedGoblin || !task.trim() || isExecuting,
				children: isExecuting
					? _jsxs(_Fragment, {
							children: [
								_jsx("span", { className: "spinner" }),
								"Executing...",
							],
						})
					: _jsxs(_Fragment, {
							children: [_jsx("span", { children: "\u25B6" }), "Execute"],
						}),
			}),
			(output || error) &&
				_jsxs("div", {
					className: "executor-output",
					children: [
						_jsxs("div", {
							className: "output-header",
							children: [
								_jsx("span", { children: "Output" }),
								isExecuting &&
									_jsx("span", {
										className: "animate-pulse text-accent",
										children: "\u25CF",
									}),
							],
						}),
						_jsx("div", {
							ref: outputRef,
							className: "output-content",
							children: error
								? _jsxs("div", {
										className: "output-error",
										children: [
											_jsx("span", {
												className: "error-icon",
												children: "\u274C",
											}),
											_jsx("span", { children: error }),
										],
									})
								: _jsx("pre", { className: "output-text", children: output }),
						}),
					],
				}),
			!output &&
				!error &&
				!selectedGoblin &&
				_jsxs("div", {
					className: "executor-empty",
					children: [
						_jsx("div", { className: "empty-icon", children: "\uD83D\uDC48" }),
						_jsx("p", { children: "Select a goblin to get started" }),
					],
				}),
		],
	});
}
/* ============================================================================
 * Styles
 * ========================================================================== */
const styles = `
.task-executor {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100%;
  padding: var(--space-6);
  overflow-y: auto;
}

/* Header */

.executor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.executor-header h2 {
  font-size: var(--text-2xl);
  margin: 0;
}

.selected-goblin {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

/* Input */

.executor-input {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.input-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.input-hint {
  font-size: var(--text-xs);
  line-height: var(--leading-relaxed);
}

.input-hint kbd {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

/* Execute Button */

.execute-button {
  align-self: flex-start;
  min-width: 150px;
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-base);
  font-weight: 600;
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid var(--bg-primary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Output */

.executor-output {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
  min-height: 300px;
  animation: fadeIn var(--transition-base) ease-in;
}

.output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.output-content {
  flex: 1;
  padding: var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-top: none;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  overflow-y: auto;
}

.output-text {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
}

.output-error {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--error-bg);
  border: 1px solid var(--error);
  border-radius: var(--radius-md);
  color: var(--error);
  font-size: var(--text-sm);
}

.error-icon {
  flex-shrink: 0;
}

/* Empty State */

.executor-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: var(--space-4);
  padding: var(--space-8);
  text-align: center;
}

.executor-empty .empty-icon {
  font-size: 4rem;
  opacity: 0.5;
}

.executor-empty p {
  font-size: var(--text-lg);
  color: var(--text-secondary);
}
`;
// Inject styles
if (typeof document !== "undefined") {
	const styleSheet = document.createElement("style");
	styleSheet.textContent = styles;
	document.head.appendChild(styleSheet);
}
