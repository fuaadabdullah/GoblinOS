export { default } from "./RuntimeStatusPanel";
export * from "./RuntimeStatusPanel";

// Thin wrapper-only file
export { default } from "./RuntimeStatusPanel";
export * from "./RuntimeStatusPanel";
/**
 * RuntimeStatusPanel - Shows runtime status and controls
 *
 * Features:
 * - Runtime status indicator (running/stopped)
 * - Start/Stop runtime buttons
 * - Runtime version and uptime
 */
import { useEffect, useState } from "react";
export function RuntimeStatusPanel({ client }) {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Fetch runtime status
    const fetchStatus = async () => {
        try {
            // For now, we'll use a placeholder status
            // In the future, this could be a dedicated status command
            setStatus({
                running: true, // Assume running for now
                version: "0.1.0",
                uptime: 3600, // 1 hour
            });
        }
        catch (err) {
            console.error("Failed to fetch runtime status:", err);
            setError("Failed to fetch status");
        }
    };
    // Start runtime
    const handleStartRuntime = async () => {
        setLoading(true);
        setError(null);
        try {
            await client.startRuntime();
            await fetchStatus(); // Refresh status
        }
        catch (err) {
            console.error("Failed to start runtime:", err);
            setError("Failed to start runtime");
        }
        finally {
            setLoading(false);
        }
    };
    // Stop runtime
    const handleStopRuntime = async () => {
        setLoading(true);
        setError(null);
        try {
            await client.stopRuntime();
            await fetchStatus(); // Refresh status
        }
        catch (err) {
            console.error("Failed to stop runtime:", err);
            setError("Failed to stop runtime");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchStatus();
        // Refresh status every 30 seconds
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);
    return (_jsxs("div", { className: "runtime-status-panel", children: [_jsxs("div", { className: "panel-header", children: [_jsx("h3", { children: "Runtime Status" }), _jsxs("div", { className: `status-indicator ${status?.running ? "running" : "stopped"}`, children: [_jsx("span", { className: "status-dot" }), status?.running ? "Running" : "Stopped"] })] }), status && (_jsxs("div", { className: "status-details", children: [_jsxs("div", { className: "status-item", children: [_jsx("span", { className: "label", children: "Version:" }), _jsx("span", { className: "value", children: status.version })] }), status.uptime && (_jsxs("div", { className: "status-item", children: [_jsx("span", { className: "label", children: "Uptime:" }), _jsxs("span", { className: "value", children: [Math.floor(status.uptime / 3600), "h", " ", Math.floor((status.uptime % 3600) / 60), "m"] })] }))] })), _jsxs("div", { className: "runtime-controls", children: [_jsx("button", { className: "button button-success", onClick: handleStartRuntime, disabled: loading || status?.running, children: loading ? "Starting..." : "Start Runtime" }), _jsx("button", { className: "button button-danger", onClick: handleStopRuntime, disabled: loading || !status?.running, children: loading ? "Stopping..." : "Stop Runtime" })] }), error && _jsx("div", { className: "error-message", children: error })] }));
}
