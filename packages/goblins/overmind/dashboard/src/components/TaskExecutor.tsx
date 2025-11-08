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
import type {
	Goblin,
	OrchestrationPlan,
	RuntimeClient,
	StreamEvent,
} from "../api/runtime-client";
import { OrchestrationBuilder } from "./OrchestrationBuilder";

interface TaskExecutorProps {
	client: RuntimeClient;
	selectedGoblin: Goblin | null;
	onTaskComplete?: () => void;
	goblins: Goblin[];
}

export function TaskExecutor({
	client,
	selectedGoblin,
	onTaskComplete,
	goblins,
}: TaskExecutorProps) {
	const [task, setTask] = useState("");
	const [isExecuting, setIsExecuting] = useState(false);
	const [output, setOutput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [orchestrationPlan, setOrchestrationPlan] =
		useState<OrchestrationPlan | null>(null);
	const [showOrchestrationPreview, setShowOrchestrationPreview] =
		useState(false);
	const [showBuilder, setShowBuilder] = useState(false);
	const outputRef = useRef<HTMLDivElement>(null);

	// Detect orchestration keywords in task text
	const hasOrchestrationKeywords = (text: string): boolean => {
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
					(event: StreamEvent) => {
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

	const handleKeyDown = (e: React.KeyboardEvent) => {
		// Cmd/Ctrl + Enter to execute
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			handleExecute();
		}
	};

	return (
		<div className="task-executor">
			{/* Header */}
			<div className="executor-header">
				<h2>Execute Task</h2>
				<div className="executor-actions">
					{selectedGoblin && (
						<div className="selected-goblin">
							<span className="text-muted">Selected:</span>
							<span className="text-accent">{selectedGoblin.title}</span>
						</div>
					)}
					<button
						className="builder-toggle-btn"
						onClick={() => setShowBuilder(true)}
						title="Open Workflow Builder"
					>
						🎭 Build Workflow
					</button>
				</div>
			</div>

			{/* Task Input */}
			<div className="executor-input">
				<label htmlFor="task-input" className="input-label">
					Task Description
				</label>
				<textarea
					id="task-input"
					className="textarea"
					value={task}
					onChange={(e) => setTask(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={
						selectedGoblin
							? `Ask ${selectedGoblin.title} to do something...`
							: "Select a goblin first"
					}
					disabled={!selectedGoblin || isExecuting}
					rows={4}
				/>
				<div className="input-hint text-muted">
					{selectedGoblin ? (
						<>
							Press <kbd>⌘ Enter</kbd> or click Execute
							{showOrchestrationPreview && orchestrationPlan && (
								<span className="orchestration-hint">
									{" "}
									• 🎭 Orchestration detected ({orchestrationPlan.steps.length}{" "}
									steps)
								</span>
							)}
						</>
					) : (
						"Select a goblin from the left to start"
					)}
				</div>
			</div>

			{/* Orchestration Preview */}
			{showOrchestrationPreview && orchestrationPlan && (
				<div className="orchestration-preview">
					<div className="preview-header">
						<span className="preview-icon">🎭</span>
						<span className="preview-title">Orchestration Plan Preview</span>
						<span className="preview-badge">
							{orchestrationPlan.steps.length} steps •{" "}
							{orchestrationPlan.metadata.parallelBatches} batches
						</span>
					</div>
					<div className="preview-steps">
						{orchestrationPlan.steps.map((step, idx) => (
							<div key={step.id} className="preview-step">
								<div className="step-number">{idx + 1}</div>
								<div className="step-content">
									<div className="step-goblin">{step.goblinId}</div>
									<div className="step-task">{step.task}</div>
									{step.dependencies.length > 0 && (
										<div className="step-deps">
											Depends on: step{" "}
											{orchestrationPlan.steps.findIndex(
												(s) => s.id === step.dependencies[0],
											) + 1}
										</div>
									)}
									{step.condition && (
										<div className="step-condition">
											Conditional: {step.condition.operator}
										</div>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Execute Button */}
			<button
				className="button button-primary execute-button"
				onClick={handleExecute}
				disabled={!selectedGoblin || !task.trim() || isExecuting}
			>
				{isExecuting ? (
					<>
						<span className="spinner" />
						Executing...
					</>
				) : (
					<>
						<span>▶</span>
						Execute
					</>
				)}
			</button>

			{/* Output Display */}
			{(output || error) && (
				<div className="executor-output">
					<div className="output-header">
						<span>Output</span>
						{isExecuting && (
							<span className="animate-pulse text-accent">●</span>
						)}
					</div>

					<div ref={outputRef} className="output-content">
						{error ? (
							<div className="output-error">
								<span className="error-icon">❌</span>
								<span>{error}</span>
							</div>
						) : (
							<pre className="output-text">{output}</pre>
						)}
					</div>
				</div>
			)}

			{/* Empty State */}
			{!output && !error && !selectedGoblin && (
				<div className="executor-empty">
					<div className="empty-icon">👈</div>
					<p>Select a goblin to get started</p>
				</div>
			)}

			{/* Orchestration Builder Modal */}
			{showBuilder && (
				<OrchestrationBuilder
					goblins={goblins}
					onGenerate={(syntax) => {
						setTask(syntax);
						setShowBuilder(false);
					}}
					onClose={() => setShowBuilder(false)}
				/>
			)}
		</div>
	);
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
