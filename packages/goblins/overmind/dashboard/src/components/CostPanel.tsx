/**
 * CostPanel - Display cost breakdown and analytics
 *
 * Features:
 * - Total cost and task count
 * - Cost breakdown by provider, goblin, guild
 * - Recent cost entries with details
 * - Export to CSV functionality
 * - Refresh on demand
 */

import { useEffect, useState } from "react";
import type { RuntimeClient } from "../api/tauri-client";

interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
}

interface CostSummary {
	totalCost: number;
	totalTasks: number;
	byProvider: Record<
		string,
		{
			cost: number;
			tasks: number;
			tokens: TokenUsage;
		}
	>;
	byGoblin: Record<
		string,
		{
			cost: number;
			tasks: number;
			tokens: TokenUsage;
		}
	>;
	byGuild: Record<
		string,
		{
			cost: number;
			tasks: number;
			tokens: TokenUsage;
		}
	>;
	recentEntries: Array<{
		id: string;
		goblinId: string;
		guild: string;
		provider: string;
		model: string;
		task: string;
		cost: number;
		timestamp: Date;
		success: boolean;
	}>;
}

interface CostPanelProps {
	client: RuntimeClient;
	refreshTrigger?: number;
}

export function CostPanel({ client, refreshTrigger }: CostPanelProps) {
	const [summary, setSummary] = useState<CostSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [view, setView] = useState<
		"overview" | "providers" | "goblins" | "guilds"
	>("overview");

	// Fetch cost summary
	useEffect(() => {
		let mounted = true;

		const fetchSummary = async () => {
			try {
				setLoading(true);
				setError(null);

				const data = await client.getCostSummary();
				if (mounted) {
					setSummary(data);
				}
			} catch (err) {
				if (mounted) {
					setError(err instanceof Error ? err.message : "Unknown error");
				}
			} finally {
				if (mounted) {
					setLoading(false);
				}
			}
		};

		fetchSummary();
		return () => {
			mounted = false;
		};
	}, [client, refreshTrigger]);

	// Handle CSV export
	const handleExport = async () => {
		try {
			const csv = await client.exportCosts();
			const blob = new Blob([csv], { type: "text/csv" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `goblin-costs-${new Date().toISOString().split("T")[0]}.csv`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error("Export failed:", err);
			alert("Cost export not yet implemented");
		}
	};

	if (loading) {
		return (
			<div className="cost-panel">
				<div className="panel-header">
					<h3>💰 Cost Tracking</h3>
				</div>
				<div className="loading">Loading costs...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="cost-panel">
				<div className="panel-header">
					<h3>💰 Cost Tracking</h3>
				</div>
				<div className="error">❌ {error}</div>
			</div>
		);
	}

	if (!summary || summary.totalTasks === 0) {
		return (
			<div className="cost-panel">
				<div className="panel-header">
					<h3>💰 Cost Tracking</h3>
				</div>
				<div className="empty-state">
					<p>No cost data yet</p>
					<p className="hint">Execute tasks to see cost tracking</p>
				</div>
			</div>
		);
	}

	const formatCost = (cost: number) => {
		return cost < 0.01 ? `$${cost.toFixed(6)}` : `$${cost.toFixed(4)}`;
	};

	const formatTokens = (tokens: number) => {
		if (tokens > 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
		if (tokens > 1000) return `${(tokens / 1000).toFixed(1)}K`;
		return tokens.toString();
	};

	return (
		<div className="cost-panel">
			<div className="panel-header">
				<h3>💰 Cost Tracking</h3>
				<button
					onClick={handleExport}
					className="export-btn"
					title="Export to CSV"
				>
					📥 Export
				</button>
			</div>

			{/* Summary Stats */}
			<div className="cost-summary">
				<div className="stat-card">
					<div className="stat-label">Total Cost</div>
					<div className="stat-value primary">
						{formatCost(summary.totalCost)}
					</div>
				</div>
				<div className="stat-card">
					<div className="stat-label">Total Tasks</div>
					<div className="stat-value">{summary.totalTasks}</div>
				</div>
				<div className="stat-card">
					<div className="stat-label">Avg Cost/Task</div>
					<div className="stat-value">
						{formatCost(summary.totalCost / summary.totalTasks)}
					</div>
				</div>
			</div>

			{/* View Tabs */}
			<div className="view-tabs">
				<button
					className={view === "overview" ? "active" : ""}
					onClick={() => setView("overview")}
				>
					Overview
				</button>
				<button
					className={view === "providers" ? "active" : ""}
					onClick={() => setView("providers")}
				>
					Providers
				</button>
				<button
					className={view === "goblins" ? "active" : ""}
					onClick={() => setView("goblins")}
				>
					Goblins
				</button>
				<button
					className={view === "guilds" ? "active" : ""}
					onClick={() => setView("guilds")}
				>
					Guilds
				</button>
			</div>

			{/* View Content */}
			<div className="view-content">
				{view === "overview" && (
					<div className="overview-view">
						<h4>Recent Tasks</h4>
						<div className="recent-entries">
							{summary.recentEntries.map((entry) => (
								<div key={entry.id} className="entry-card">
									<div className="entry-header">
										<span className="goblin-name">{entry.goblinId}</span>
										<span
											className={`status ${entry.success ? "success" : "failed"}`}
										>
											{entry.success ? "✓" : "✗"}
										</span>
									</div>
									<div className="entry-task">
										{entry.task.substring(0, 50)}...
									</div>
									<div className="entry-footer">
										<span className="provider">{entry.provider}</span>
										<span className="cost">{formatCost(entry.cost)}</span>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{view === "providers" && (
					<div className="breakdown-view">
						{Object.entries(summary.byProvider).map(([provider, data]) => (
							<div key={provider} className="breakdown-card">
								<div className="breakdown-header">
									<span className="name">{provider}</span>
									<span className="cost">{formatCost(data.cost)}</span>
								</div>
								<div className="breakdown-details">
									<span>{data.tasks} tasks</span>
									<span>{formatTokens(data.tokens.totalTokens)} tokens</span>
								</div>
								<div className="breakdown-bar">
									<div
										className="bar-fill"
										style={{
											width: `${(data.cost / summary.totalCost) * 100}%`,
										}}
									/>
								</div>
							</div>
						))}
					</div>
				)}

				{view === "goblins" && (
					<div className="breakdown-view">
						{Object.entries(summary.byGoblin)
							.sort(([, a], [, b]) => b.cost - a.cost)
							.map(([goblin, data]) => (
								<div key={goblin} className="breakdown-card">
									<div className="breakdown-header">
										<span className="name">{goblin}</span>
										<span className="cost">{formatCost(data.cost)}</span>
									</div>
									<div className="breakdown-details">
										<span>{data.tasks} tasks</span>
										<span>{formatTokens(data.tokens.totalTokens)} tokens</span>
									</div>
									<div className="breakdown-bar">
										<div
											className="bar-fill"
											style={{
												width: `${(data.cost / summary.totalCost) * 100}%`,
											}}
										/>
									</div>
								</div>
							))}
					</div>
				)}

				{view === "guilds" && (
					<div className="breakdown-view">
						{Object.entries(summary.byGuild)
							.sort(([, a], [, b]) => b.cost - a.cost)
							.map(([guild, data]) => (
								<div key={guild} className="breakdown-card">
									<div className="breakdown-header">
										<span className="name">{guild}</span>
										<span className="cost">{formatCost(data.cost)}</span>
									</div>
									<div className="breakdown-details">
										<span>{data.tasks} tasks</span>
										<span>{formatTokens(data.tokens.totalTokens)} tokens</span>
									</div>
									<div className="breakdown-bar">
										<div
											className="bar-fill"
											style={{
												width: `${(data.cost / summary.totalCost) * 100}%`,
											}}
										/>
									</div>
								</div>
							))}
					</div>
				)}
			</div>
		</div>
	);
}
