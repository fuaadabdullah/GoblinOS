export { default } from "./CostPanel";
export * from "./CostPanel";

// Thin wrapper-only file
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
export function CostPanel({ client, refreshTrigger }) {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [view, setView] = useState("overview");
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
            }
            catch (err) {
                if (mounted) {
                    setError(err instanceof Error ? err.message : "Unknown error");
                }
            }
            finally {
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
        }
        catch (err) {
            console.error("Export failed:", err);
            alert("Cost export not yet implemented");
        }
    };
    if (loading) {
        return (_jsxs("div", { className: "cost-panel", children: [_jsx("div", { className: "panel-header", children: _jsx("h3", { children: "\uD83D\uDCB0 Cost Tracking" }) }), _jsx("div", { className: "loading", children: "Loading costs..." })] }));
    }
    if (error) {
        return (_jsxs("div", { className: "cost-panel", children: [_jsx("div", { className: "panel-header", children: _jsx("h3", { children: "\uD83D\uDCB0 Cost Tracking" }) }), _jsxs("div", { className: "error", children: ["\u274C ", error] })] }));
    }
    if (!summary || summary.totalTasks === 0) {
        return (_jsxs("div", { className: "cost-panel", children: [_jsx("div", { className: "panel-header", children: _jsx("h3", { children: "\uD83D\uDCB0 Cost Tracking" }) }), _jsxs("div", { className: "empty-state", children: [_jsx("p", { children: "No cost data yet" }), _jsx("p", { className: "hint", children: "Execute tasks to see cost tracking" })] })] }));
    }
    const formatCost = (cost) => {
        return cost < 0.01 ? `$${cost.toFixed(6)}` : `$${cost.toFixed(4)}`;
    };
    const formatTokens = (tokens) => {
        if (tokens > 1000000)
            return `${(tokens / 1000000).toFixed(1)}M`;
        if (tokens > 1000)
            return `${(tokens / 1000).toFixed(1)}K`;
        return tokens.toString();
    };
    return (_jsxs("div", { className: "cost-panel", children: [_jsxs("div", { className: "panel-header", children: [_jsx("h3", { children: "\uD83D\uDCB0 Cost Tracking" }), _jsx("button", { onClick: handleExport, className: "export-btn", title: "Export to CSV", children: "\uD83D\uDCE5 Export" })] }), _jsxs("div", { className: "cost-summary", children: [_jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "stat-label", children: "Total Cost" }), _jsx("div", { className: "stat-value primary", children: formatCost(summary.totalCost) })] }), _jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "stat-label", children: "Total Tasks" }), _jsx("div", { className: "stat-value", children: summary.totalTasks })] }), _jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "stat-label", children: "Avg Cost/Task" }), _jsx("div", { className: "stat-value", children: formatCost(summary.totalCost / summary.totalTasks) })] })] }), _jsxs("div", { className: "view-tabs", children: [_jsx("button", { className: view === "overview" ? "active" : "", onClick: () => setView("overview"), children: "Overview" }), _jsx("button", { className: view === "providers" ? "active" : "", onClick: () => setView("providers"), children: "Providers" }), _jsx("button", { className: view === "goblins" ? "active" : "", onClick: () => setView("goblins"), children: "Goblins" }), _jsx("button", { className: view === "guilds" ? "active" : "", onClick: () => setView("guilds"), children: "Guilds" })] }), _jsxs("div", { className: "view-content", children: [view === "overview" && (_jsxs("div", { className: "overview-view", children: [_jsx("h4", { children: "Recent Tasks" }), _jsx("div", { className: "recent-entries", children: summary.recentEntries.map((entry) => (_jsxs("div", { className: "entry-card", children: [_jsxs("div", { className: "entry-header", children: [_jsx("span", { className: "goblin-name", children: entry.goblinId }), _jsx("span", { className: `status ${entry.success ? "success" : "failed"}`, children: entry.success ? "✓" : "✗" })] }), _jsxs("div", { className: "entry-task", children: [entry.task.substring(0, 50), "..."] }), _jsxs("div", { className: "entry-footer", children: [_jsx("span", { className: "provider", children: entry.provider }), _jsx("span", { className: "cost", children: formatCost(entry.cost) })] })] }, entry.id))) })] })), view === "providers" && (_jsx("div", { className: "breakdown-view", children: Object.entries(summary.byProvider).map(([provider, data]) => (_jsxs("div", { className: "breakdown-card", children: [_jsxs("div", { className: "breakdown-header", children: [_jsx("span", { className: "name", children: provider }), _jsx("span", { className: "cost", children: formatCost(data.cost) })] }), _jsxs("div", { className: "breakdown-details", children: [_jsxs("span", { children: [data.tasks, " tasks"] }), _jsxs("span", { children: [formatTokens(data.tokens.totalTokens), " tokens"] })] }), _jsx("div", { className: "breakdown-bar", children: _jsx("div", { className: "bar-fill", style: {
                                            width: `${(data.cost / summary.totalCost) * 100}%`,
                                        } }) })] }, provider))) })), view === "goblins" && (_jsx("div", { className: "breakdown-view", children: Object.entries(summary.byGoblin)
                            .sort(([, a], [, b]) => b.cost - a.cost)
                            .map(([goblin, data]) => (_jsxs("div", { className: "breakdown-card", children: [_jsxs("div", { className: "breakdown-header", children: [_jsx("span", { className: "name", children: goblin }), _jsx("span", { className: "cost", children: formatCost(data.cost) })] }), _jsxs("div", { className: "breakdown-details", children: [_jsxs("span", { children: [data.tasks, " tasks"] }), _jsxs("span", { children: [formatTokens(data.tokens.totalTokens), " tokens"] })] }), _jsx("div", { className: "breakdown-bar", children: _jsx("div", { className: "bar-fill", style: {
                                            width: `${(data.cost / summary.totalCost) * 100}%`,
                                        } }) })] }, goblin))) })), view === "guilds" && (_jsx("div", { className: "breakdown-view", children: Object.entries(summary.byGuild)
                            .sort(([, a], [, b]) => b.cost - a.cost)
                            .map(([guild, data]) => (_jsxs("div", { className: "breakdown-card", children: [_jsxs("div", { className: "breakdown-header", children: [_jsx("span", { className: "name", children: guild }), _jsx("span", { className: "cost", children: formatCost(data.cost) })] }), _jsxs("div", { className: "breakdown-details", children: [_jsxs("span", { children: [data.tasks, " tasks"] }), _jsxs("span", { children: [formatTokens(data.tokens.totalTokens), " tokens"] })] }), _jsx("div", { className: "breakdown-bar", children: _jsx("div", { className: "bar-fill", style: {
                                            width: `${(data.cost / summary.totalCost) * 100}%`,
                                        } }) })] }, guild))) }))] })] }));
}
