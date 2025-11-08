/**
 * StatsPanel - Display goblin performance metrics
 *
 * Features:
 * - Total tasks, success rate, avg duration
 * - Visual indicators and progress bars
 * - Auto-refresh on task completion
 */
import { useEffect, useState } from "react";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function StatsPanel({ client, goblinId, refreshTrigger = 0 }) {
	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	useEffect(() => {
		if (!goblinId) {
			setStats(null);
			return;
		}
		const fetchStats = async () => {
			setLoading(true);
			setError(null);
			try {
				const data = await client.getStats(goblinId);
				setStats(data);
			} catch (err) {
				setError(err.message || "Failed to fetch stats");
			} finally {
				setLoading(false);
			}
		};
		fetchStats();
	}, [goblinId, refreshTrigger, client]);
	if (!goblinId) {
		return _jsxs("div", {
			className: "stats-panel",
			children: [
				_jsx("div", {
					className: "stats-header",
					children: _jsx("h3", { children: "Performance Stats" }),
				}),
				_jsxs("div", {
					className: "stats-empty",
					children: [
						_jsx("div", { className: "empty-icon", children: "\uD83D\uDCCA" }),
						_jsx("p", { children: "Select a goblin to view stats" }),
					],
				}),
			],
		});
	}
	if (loading && !stats) {
		return _jsxs("div", {
			className: "stats-panel",
			children: [
				_jsx("div", {
					className: "stats-header",
					children: _jsx("h3", { children: "Performance Stats" }),
				}),
				_jsxs("div", {
					className: "stats-loading",
					children: [
						_jsx("div", { className: "spinner" }),
						_jsx("p", { children: "Loading stats..." }),
					],
				}),
			],
		});
	}
	if (error) {
		return _jsxs("div", {
			className: "stats-panel",
			children: [
				_jsx("div", {
					className: "stats-header",
					children: _jsx("h3", { children: "Performance Stats" }),
				}),
				_jsxs("div", {
					className: "stats-error",
					children: [
						_jsx("span", { children: "\u274C" }),
						_jsx("p", { children: error }),
					],
				}),
			],
		});
	}
	if (!stats) return null;
	return _jsxs("div", {
		className: "stats-panel",
		children: [
			_jsxs("div", {
				className: "stats-header",
				children: [
					_jsx("h3", { children: "Performance Stats" }),
					loading &&
						_jsx("span", {
							className: "refresh-indicator animate-pulse",
							children: "\u25CF",
						}),
				],
			}),
			_jsxs("div", {
				className: "stats-grid",
				children: [
					_jsxs("div", {
						className: "stat-card",
						children: [
							_jsx("div", { className: "stat-icon", children: "\uD83D\uDCDD" }),
							_jsxs("div", {
								className: "stat-content",
								children: [
									_jsx("div", {
										className: "stat-label",
										children: "Total Tasks",
									}),
									_jsx("div", {
										className: "stat-value",
										children: stats.totalTasks,
									}),
								],
							}),
						],
					}),
					_jsxs("div", {
						className: "stat-card",
						children: [
							_jsx("div", { className: "stat-icon", children: "\u2705" }),
							_jsxs("div", {
								className: "stat-content",
								children: [
									_jsx("div", {
										className: "stat-label",
										children: "Success Rate",
									}),
									_jsxs("div", {
										className: "stat-value",
										children: [stats.successRate.toFixed(1), "%"],
									}),
								],
							}),
							_jsx("div", {
								className: "stat-progress",
								children: _jsx("div", {
									className: "progress-bar",
									style: { width: `${stats.successRate}%` },
								}),
							}),
						],
					}),
					_jsxs("div", {
						className: "stat-card",
						children: [
							_jsx("div", { className: "stat-icon", children: "\u26A1" }),
							_jsxs("div", {
								className: "stat-content",
								children: [
									_jsx("div", {
										className: "stat-label",
										children: "Avg Duration",
									}),
									_jsx("div", {
										className: "stat-value",
										children: formatDuration(stats.avgDuration),
									}),
								],
							}),
						],
					}),
					_jsx("div", {
						className: "stat-card stat-mini",
						children: _jsxs("div", {
							className: "stat-mini-content",
							children: [
								_jsx("span", {
									className: "text-accent",
									children: stats.successfulTasks,
								}),
								_jsx("span", {
									className: "text-muted",
									children: "successful",
								}),
							],
						}),
					}),
					_jsx("div", {
						className: "stat-card stat-mini",
						children: _jsxs("div", {
							className: "stat-mini-content",
							children: [
								_jsx("span", {
									className: "stat-mini-value-error",
									children: stats.failedTasks,
								}),
								_jsx("span", { className: "text-muted", children: "failed" }),
							],
						}),
					}),
				],
			}),
			stats.totalTasks > 0 &&
				_jsxs("div", {
					className: "stats-summary",
					children: [
						_jsx("div", {
							className: "summary-title",
							children: "Performance",
						}),
						_jsxs("div", {
							className: "summary-badges",
							children: [
								stats.successRate >= 90 &&
									_jsx("span", {
										className: "badge badge-success",
										children: "Excellent",
									}),
								stats.successRate >= 70 &&
									stats.successRate < 90 &&
									_jsx("span", {
										className: "badge badge-info",
										children: "Good",
									}),
								stats.successRate < 70 &&
									_jsx("span", {
										className: "badge badge-warning",
										children: "Needs Attention",
									}),
								stats.avgDuration < 5000 &&
									_jsx("span", {
										className: "badge badge-success",
										children: "Fast",
									}),
							],
						}),
					],
				}),
		],
	});
}
// Helper function to format duration
function formatDuration(ms) {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	return `${(ms / 60000).toFixed(1)}m`;
}
/* ============================================================================
 * Styles
 * ========================================================================== */
const styles = `
.stats-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-primary);
  border-left: 1px solid var(--border-subtle);
  overflow-y: auto;
}

/* Header */

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
}

.stats-header h3 {
  font-size: var(--text-lg);
  margin: 0;
}

.refresh-indicator {
  color: var(--accent-green);
  font-size: var(--text-xs);
}

/* Empty/Loading/Error States */

.stats-empty,
.stats-loading,
.stats-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  text-align: center;
}

.stats-empty .empty-icon {
  font-size: 3rem;
  opacity: 0.5;
}

.stats-loading .spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--border-medium);
  border-top-color: var(--accent-green);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.stats-error {
  color: var(--error);
}

/* Stats Grid */

.stats-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.stat-card:hover {
  border-color: var(--border-medium);
  background: var(--bg-tertiary);
}

.stat-icon {
  font-size: 1.5rem;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.stat-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
}

/* Progress Bar */

.stat-progress {
  height: 4px;
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--accent-green);
  transition: width var(--transition-slow);
  box-shadow: var(--glow-green);
}

/* Mini Stats */

.stat-mini {
  padding: var(--space-3);
}

.stat-mini-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.stat-mini-content span:first-child {
  font-size: var(--text-xl);
  font-weight: 700;
}

.stat-mini-value-error {
  color: var(--error);
  font-size: var(--text-xl);
  font-weight: 700;
}

/* Summary */

.stats-summary {
  padding: var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.summary-title {
  margin-bottom: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.summary-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
`;
// Inject styles
if (typeof document !== "undefined") {
	const styleSheet = document.createElement("style");
	styleSheet.textContent = styles;
	document.head.appendChild(styleSheet);
}
