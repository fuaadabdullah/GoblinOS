/**
 * HistoryPanel - Display task history with expandable details
 *
 * Features:
 * - Scrollable list of recent tasks
 * - Success/failure indicators
 * - Duration display
 * - Expandable reasoning
 * - Limit selector (10/50/100)
 */
import { useEffect, useState } from "react";
import {
	Fragment as _Fragment,
	jsx as _jsx,
	jsxs as _jsxs,
} from "react/jsx-runtime";
export function HistoryPanel({ client, goblinId, refreshTrigger = 0 }) {
	const [history, setHistory] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [limit, setLimit] = useState(10);
	const [expandedIds, setExpandedIds] = useState(new Set());
	useEffect(() => {
		if (!goblinId) {
			setHistory([]);
			return;
		}
		const fetchHistory = async () => {
			setLoading(true);
			setError(null);
			try {
				const data = await client.getHistory(goblinId, limit);
				setHistory(data);
			} catch (err) {
				setError(err.message || "Failed to fetch history");
			} finally {
				setLoading(false);
			}
		};
		fetchHistory();
	}, [goblinId, limit, refreshTrigger, client]);
	const toggleExpanded = (id) => {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};
	if (!goblinId) {
		return _jsxs("div", {
			className: "history-panel",
			children: [
				_jsx("div", {
					className: "history-header",
					children: _jsx("h3", { children: "Task History" }),
				}),
				_jsxs("div", {
					className: "history-empty",
					children: [
						_jsx("div", { className: "empty-icon", children: "\uD83D\uDCDC" }),
						_jsx("p", { children: "Select a goblin to view history" }),
					],
				}),
			],
		});
	}
	return _jsxs("div", {
		className: "history-panel",
		children: [
			_jsxs("div", {
				className: "history-header",
				children: [
					_jsx("h3", { children: "Task History" }),
					_jsxs("select", {
						className: "limit-selector",
						value: limit,
						onChange: (e) => setLimit(Number(e.target.value)),
						disabled: loading,
						children: [
							_jsx("option", { value: 10, children: "Last 10" }),
							_jsx("option", { value: 50, children: "Last 50" }),
							_jsx("option", { value: 100, children: "Last 100" }),
						],
					}),
				],
			}),
			loading &&
				history.length === 0 &&
				_jsxs("div", {
					className: "history-loading",
					children: [
						_jsx("div", { className: "spinner" }),
						_jsx("p", { children: "Loading history..." }),
					],
				}),
			error &&
				_jsxs("div", {
					className: "history-error",
					children: [
						_jsx("span", { children: "\u274C" }),
						_jsx("p", { children: error }),
					],
				}),
			!loading &&
				!error &&
				history.length === 0 &&
				_jsxs("div", {
					className: "history-empty",
					children: [
						_jsx("div", { className: "empty-icon", children: "\uD83C\uDD95" }),
						_jsx("p", { children: "No tasks yet" }),
						_jsx("span", {
							className: "text-muted",
							children: "Execute a task to see it here",
						}),
					],
				}),
			history.length > 0 &&
				_jsx("div", {
					className: "history-list",
					children: history.map((entry) => {
						const isExpanded = expandedIds.has(entry.id);
						const duration = entry.kpis?.response_time_ms;
						return _jsxs(
							"div",
							{
								className: `history-entry ${isExpanded ? "expanded" : ""}`,
								children: [
									_jsxs("button", {
										className: "entry-header",
										onClick: () => toggleExpanded(entry.id),
										children: [
											_jsxs("div", {
												className: "entry-info",
												children: [
													_jsx("div", {
														className: "entry-status",
														children: entry.success
															? _jsx("span", {
																	className: "status-success",
																	children: "\u2713",
																})
															: _jsx("span", {
																	className: "status-error",
																	children: "\u2717",
																}),
													}),
													_jsxs("div", {
														className: "entry-details",
														children: [
															_jsx("div", {
																className: "entry-task",
																children: entry.task,
															}),
															_jsxs("div", {
																className: "entry-meta",
																children: [
																	_jsx("span", {
																		className: "entry-time",
																		children: formatTimestamp(entry.timestamp),
																	}),
																	duration &&
																		_jsxs(_Fragment, {
																			children: [
																				_jsx("span", {
																					className: "meta-separator",
																					children: "\u2022",
																				}),
																				_jsx("span", {
																					className: "entry-duration",
																					children: formatDuration(duration),
																				}),
																			],
																		}),
																],
															}),
														],
													}),
												],
											}),
											_jsx("div", {
												className: "entry-expand-icon",
												children: isExpanded ? "▼" : "▶",
											}),
										],
									}),
									isExpanded &&
										_jsxs("div", {
											className: "entry-content",
											children: [
												_jsx("div", {
													className: "content-label",
													children: "Response:",
												}),
												_jsx("pre", {
													className: "content-text",
													children: entry.response,
												}),
											],
										}),
								],
							},
							entry.id,
						);
					}),
				}),
		],
	});
}
// Helper functions
function formatTimestamp(timestamp) {
	const date = new Date(timestamp);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
	return date.toLocaleDateString();
}
function formatDuration(ms) {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	return `${(ms / 60000).toFixed(1)}m`;
}
/* ============================================================================
 * Styles
 * ========================================================================== */
const styles = `
.history-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-primary);
  border-top: 1px solid var(--border-subtle);
  overflow-y: auto;
}

/* Header */

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
}

.history-header h3 {
  font-size: var(--text-lg);
  margin: 0;
}

.limit-selector {
  padding: var(--space-1) var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.limit-selector:hover {
  border-color: var(--border-strong);
}

.limit-selector:focus {
  outline: none;
  border-color: var(--accent-green);
}

/* Empty/Loading/Error States */

.history-empty,
.history-loading,
.history-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  text-align: center;
}

.history-empty .empty-icon {
  font-size: 3rem;
  opacity: 0.5;
}

.history-loading .spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--border-medium);
  border-top-color: var(--accent-green);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.history-error {
  color: var(--error);
}

/* History List */

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* History Entry */

.history-entry {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: all var(--transition-fast);
}

.history-entry:hover {
  border-color: var(--border-medium);
}

.history-entry.expanded {
  border-color: var(--accent-green-dim);
}

/* Entry Header */

.entry-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-3);
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.entry-header:hover {
  background: var(--bg-tertiary);
}

.entry-info {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  flex: 1;
}

.entry-status {
  flex-shrink: 0;
  font-size: var(--text-lg);
}

.status-success {
  color: var(--success);
}

.status-error {
  color: var(--error);
}

.entry-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}

.entry-task {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.meta-separator {
  opacity: 0.5;
}

.entry-expand-icon {
  flex-shrink: 0;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  transition: transform var(--transition-fast);
}

.history-entry.expanded .entry-expand-icon {
  transform: rotate(0deg);
}

/* Entry Content */

.entry-content {
  padding: 0 var(--space-3) var(--space-3);
  animation: slideDown var(--transition-base) ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.content-label {
  margin-bottom: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.content-text {
  padding: var(--space-3);
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  line-height: var(--leading-relaxed);
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 300px;
  overflow-y: auto;
}
`;
// Inject styles
if (typeof document !== "undefined") {
	const styleSheet = document.createElement("style");
	styleSheet.textContent = styles;
	document.head.appendChild(styleSheet);
}
