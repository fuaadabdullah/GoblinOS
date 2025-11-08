/**
 * StatsPanel - Display goblin performance metrics
 *
 * Features:
 * - Total tasks, success rate, avg duration
 * - Visual indicators and progress bars
 * - Auto-refresh on task completion
 */

import { useEffect, useState } from "react";
import type { GoblinStats, RuntimeClient } from "../api/runtime-client";

interface StatsPanelProps {
	client: RuntimeClient;
	goblinId: string | null;
	refreshTrigger?: number;
}

export function StatsPanel({
	client,
	goblinId,
	refreshTrigger = 0,
}: StatsPanelProps) {
	const [stats, setStats] = useState<GoblinStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

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
			} catch (err: any) {
				setError(err.message || "Failed to fetch stats");
			} finally {
				setLoading(false);
			}
		};

		fetchStats();
	}, [goblinId, refreshTrigger, client]);

	if (!goblinId) {
		return (
			<div className="stats-panel">
				<div className="stats-header">
					<h3>Performance Stats</h3>
				</div>
				<div className="stats-empty">
					<div className="empty-icon">📊</div>
					<p>Select a goblin to view stats</p>
				</div>
			</div>
		);
	}

	if (loading && !stats) {
		return (
			<div className="stats-panel">
				<div className="stats-header">
					<h3>Performance Stats</h3>
				</div>
				<div className="stats-loading">
					<div className="spinner" />
					<p>Loading stats...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="stats-panel">
				<div className="stats-header">
					<h3>Performance Stats</h3>
				</div>
				<div className="stats-error">
					<span>❌</span>
					<p>{error}</p>
				</div>
			</div>
		);
	}

	if (!stats) return null;

	return (
		<div className="stats-panel">
			{/* Header */}
			<div className="stats-header">
				<h3>Performance Stats</h3>
				{loading && <span className="refresh-indicator animate-pulse">●</span>}
			</div>

			{/* Stats Grid */}
			<div className="stats-grid">
				{/* Total Tasks */}
				<div className="stat-card">
					<div className="stat-icon">📝</div>
					<div className="stat-content">
						<div className="stat-label">Total Tasks</div>
						<div className="stat-value">{stats.totalTasks}</div>
					</div>
				</div>

				{/* Success Rate */}
				<div className="stat-card">
					<div className="stat-icon">✅</div>
					<div className="stat-content">
						<div className="stat-label">Success Rate</div>
						<div className="stat-value">{stats.successRate.toFixed(1)}%</div>
					</div>
					<div className="stat-progress">
						<div
							className="progress-bar"
							style={{ width: `${stats.successRate}%` }}
						/>
					</div>
				</div>

				{/* Avg Duration */}
				<div className="stat-card">
					<div className="stat-icon">⚡</div>
					<div className="stat-content">
						<div className="stat-label">Avg Duration</div>
						<div className="stat-value">
							{formatDuration(stats.avgDuration)}
						</div>
					</div>
				</div>

				{/* Successful Tasks */}
				<div className="stat-card stat-mini">
					<div className="stat-mini-content">
						<span className="text-accent">{stats.successfulTasks}</span>
						<span className="text-muted">successful</span>
					</div>
				</div>

				{/* Failed Tasks */}
				<div className="stat-card stat-mini">
					<div className="stat-mini-content">
						<span className="stat-mini-value-error">{stats.failedTasks}</span>
						<span className="text-muted">failed</span>
					</div>
				</div>
			</div>

			{/* Performance Summary */}
			{stats.totalTasks > 0 && (
				<div className="stats-summary">
					<div className="summary-title">Performance</div>
					<div className="summary-badges">
						{stats.successRate >= 90 && (
							<span className="badge badge-success">Excellent</span>
						)}
						{stats.successRate >= 70 && stats.successRate < 90 && (
							<span className="badge badge-info">Good</span>
						)}
						{stats.successRate < 70 && (
							<span className="badge badge-warning">Needs Attention</span>
						)}
						{stats.avgDuration < 5000 && (
							<span className="badge badge-success">Fast</span>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

// Helper function to format duration
function formatDuration(ms: number): string {
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
