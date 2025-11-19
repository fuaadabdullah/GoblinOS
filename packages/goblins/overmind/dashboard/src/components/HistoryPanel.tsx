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
import type { HistoryEntry, RuntimeClient } from "../api/tauri-client";

interface HistoryPanelProps {
	client: RuntimeClient;
	goblinId: string | null;
	refreshTrigger?: number;
}

export function HistoryPanel({
	client,
	goblinId,
	refreshTrigger = 0,
}: HistoryPanelProps) {
	const [history, setHistory] = useState<HistoryEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [limit, setLimit] = useState(10);
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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
			} catch (err: any) {
				setError(err.message || "Failed to fetch history");
			} finally {
				setLoading(false);
			}
		};

		fetchHistory();
	}, [goblinId, limit, refreshTrigger, client]);

	const toggleExpanded = (id: string) => {
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
		return (
			<div className="history-panel">
				<div className="history-header">
					<h3>Task History</h3>
				</div>
				<div className="history-empty">
					<div className="empty-icon">📜</div>
					<p>Select a goblin to view history</p>
				</div>
			</div>
		);
	}

	return (
		<div className="history-panel">
			{/* Header with Limit Selector */}
			<div className="history-header">
				<h3>Task History</h3>
				<select
					className="limit-selector"
					value={limit}
					onChange={(e) => setLimit(Number(e.target.value))}
					disabled={loading}
				>
					<option value={10}>Last 10</option>
					<option value={50}>Last 50</option>
					<option value={100}>Last 100</option>
				</select>
			</div>

			{/* Loading State */}
			{loading && history.length === 0 && (
				<div className="history-loading">
					<div className="spinner" />
					<p>Loading history...</p>
				</div>
			)}

			{/* Error State */}
			{error && (
				<div className="history-error">
					<span>❌</span>
					<p>{error}</p>
				</div>
			)}

			{/* History List */}
			{!loading && !error && history.length === 0 && (
				<div className="history-empty">
					<div className="empty-icon">🆕</div>
					<p>No tasks yet</p>
					<span className="text-muted">Execute a task to see it here</span>
				</div>
			)}

			{history.length > 0 && (
				<div className="history-list">
					{history.map((entry) => {
						const isExpanded = expandedIds.has(entry.id);
						const duration = entry.kpis?.response_time_ms as number | undefined;

						return (
							<div
								key={entry.id}
								className={`history-entry ${isExpanded ? "expanded" : ""}`}
							>
								{/* Entry Header */}
								<button
									className="entry-header"
									onClick={() => toggleExpanded(entry.id)}
								>
									<div className="entry-info">
										<div className="entry-status">
											{entry.success ? (
												<span className="status-success">✓</span>
											) : (
												<span className="status-error">✗</span>
											)}
										</div>
										<div className="entry-details">
											<div className="entry-task">{entry.task}</div>
											<div className="entry-meta">
												<span className="entry-time">
													{formatTimestamp(entry.timestamp)}
												</span>
												{duration && (
													<>
														<span className="meta-separator">•</span>
														<span className="entry-duration">
															{formatDuration(duration)}
														</span>
													</>
												)}
											</div>
										</div>
									</div>
									<div className="entry-expand-icon">
										{isExpanded ? "▼" : "▶"}
									</div>
								</button>

								{/* Expanded Response */}
								{isExpanded && (
									<div className="entry-content">
										<div className="content-label">Response:</div>
										<pre className="content-text">{entry.response}</pre>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

// Helper functions
function formatTimestamp(timestamp: Date): string {
	const date = new Date(timestamp);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);

	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
	return date.toLocaleDateString();
}

function formatDuration(ms: number): string {
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
