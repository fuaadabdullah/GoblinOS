export * from "./HistoryPanel";

// Thin wrapper re-exporting the TypeScript HistoryPanel
export * from "./HistoryPanel";
export * from "./HistoryPanel";
// Helper functions
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1)
        return "just now";
    if (diffMins < 60)
        return `${diffMins}m ago`;
    if (diffMins < 1440)
        return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
}
function formatDuration(ms) {
    if (ms < 1000)
        return `${Math.round(ms)}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(1)}s`;
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

export * from "./HistoryPanel";
