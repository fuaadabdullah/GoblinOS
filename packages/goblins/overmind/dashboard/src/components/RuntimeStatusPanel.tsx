/**
 * RuntimeStatusPanel - Shows runtime status and controls
 *
 * Features:
 * - Runtime status indicator (running/stopped)
 * - Start/Stop runtime buttons
 * - Runtime version and uptime
 */

import { useEffect, useState } from "react";
import type { RuntimeClient } from "../api/tauri-client";

interface RuntimeStatusPanelProps {
	client: RuntimeClient;
}

interface RuntimeStatus {
	running: boolean;
	version: string;
	uptime?: number;
}

export function RuntimeStatusPanel({ client }: RuntimeStatusPanelProps) {
	const [status, setStatus] = useState<RuntimeStatus | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

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
		} catch (err) {
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
		} catch (err) {
			console.error("Failed to start runtime:", err);
			setError("Failed to start runtime");
		} finally {
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
		} catch (err) {
			console.error("Failed to stop runtime:", err);
			setError("Failed to stop runtime");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchStatus();
		// Refresh status every 30 seconds
		const interval = setInterval(fetchStatus, 30000);
		return () => clearInterval(interval);
	}, []);

	return (
		<div className="runtime-status-panel">
			<div className="panel-header">
				<h3>Runtime Status</h3>
				<div
					className={`status-indicator ${status?.running ? "running" : "stopped"}`}
				>
					<span className="status-dot"></span>
					{status?.running ? "Running" : "Stopped"}
				</div>
			</div>

			{status && (
				<div className="status-details">
					<div className="status-item">
						<span className="label">Version:</span>
						<span className="value">{status.version}</span>
					</div>
					{status.uptime && (
						<div className="status-item">
							<span className="label">Uptime:</span>
							<span className="value">
								{Math.floor(status.uptime / 3600)}h{" "}
								{Math.floor((status.uptime % 3600) / 60)}m
							</span>
						</div>
					)}
				</div>
			)}

			<div className="runtime-controls">
				<button
					className="button button-success"
					onClick={handleStartRuntime}
					disabled={loading || status?.running}
				>
					{loading ? "Starting..." : "Start Runtime"}
				</button>
				<button
					className="button button-danger"
					onClick={handleStopRuntime}
					disabled={loading || !status?.running}
				>
					{loading ? "Stopping..." : "Stop Runtime"}
				</button>
			</div>

			{error && <div className="error-message">{error}</div>}
		</div>
	);
}
