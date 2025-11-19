/**
 * GoblinHub - Main interactive dashboard
 *
 * Layout:
 * - Left: GoblinGrid (sidebar)
 * - Center: TaskExecutor
 * - Right: StatsPanel + HistoryPanel
 */

import { useEffect, useState } from "react";
import {
	type Goblin,
	type RuntimeClient,
} from "../api/tauri-client";
import { CostPanel } from "../components/CostPanel";
import { GoblinGrid } from "../components/GoblinGrid";
import { HistoryPanel } from "../components/HistoryPanel";
import { RuntimeStatusPanel } from "../components/RuntimeStatusPanel";
import { StatsPanel } from "../components/StatsPanel";
import { TaskExecutor } from "../components/TaskExecutor";
import { LoginPanel } from "../components/LoginPanel";
import "../styles/dark-theme.css";

export function GoblinHubPage({ client }: { client: RuntimeClient }) {
	const [goblins, setGoblins] = useState<Goblin[]>([]);
	const [selectedGoblinId, setSelectedGoblinId] = useState<string | null>(null);
	const [selectedGoblin, setSelectedGoblin] = useState<Goblin | null>(null);
	const [busyGoblins] = useState<Set<string>>(new Set());
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	const [serverStatus, setServerStatus] = useState<
		"connecting" | "connected" | "error"
	>("connecting");

		// Initialize: check server health and fetch goblins
		useEffect(() => {
			const init = async () => {
				try {
					// Check server health - skip for desktop app
					// await client.getHealth();
					setServerStatus("connected");

					// Fetch goblins list
					const goblinsList = await client.getGoblins();
					setGoblins(goblinsList);				// Auto-select first goblin
				if (goblinsList.length > 0 && !selectedGoblinId) {
					setSelectedGoblinId(goblinsList[0].id);
				}
			} catch (error) {
				console.error("Failed to initialize:", error);
				setServerStatus("error");
			}
		};

		init();
	}, [client, selectedGoblinId]);

	// Update selected goblin object when ID changes
	useEffect(() => {
		if (selectedGoblinId) {
			const goblin = goblins.find((g) => g.id === selectedGoblinId);
			setSelectedGoblin(goblin || null);
		} else {
			setSelectedGoblin(null);
		}
	}, [selectedGoblinId, goblins]);

	// Handle goblin selection
	const handleSelectGoblin = (goblinId: string) => {
		setSelectedGoblinId(goblinId);
	};

	// Handle task completion - refresh stats and history
	const handleTaskComplete = () => {
		setRefreshTrigger((prev) => prev + 1);
	};

	// Server error state
	if (serverStatus === "error") {
		return (
			<div className="goblin-hub">
				<div className="server-error">
					<div className="error-content">
						<div className="error-icon">🔌</div>
						<h2>Server Connection Failed</h2>
						<p>Could not connect to GoblinOS Runtime Server</p>
						<code className="error-url">http://localhost:3001</code>
						<div className="error-actions">
							<p className="text-muted">Make sure the server is running:</p>
							<code className="error-command">
								pnpm --filter @goblinos/goblin-runtime server
							</code>
						</div>
						<button
							className="button button-primary"
							onClick={() => window.location.reload()}
						>
							Retry Connection
						</button>
					</div>
				</div>
			</div>
		);
	}

	// Loading state
	if (serverStatus === "connecting") {
		return (
			<div className="goblin-hub">
				<div className="server-loading">
					<div className="spinner-large" />
					<h2>Connecting to GoblinOS...</h2>
					<p className="text-muted">http://localhost:3001</p>
				</div>
			</div>
		);
	}

	return (
		<div className="goblin-hub">
			{/* Header */}
			<header className="hub-header">
				<div className="header-content">
					<h1 className="hub-title">
						<span className="title-icon">🤖</span>
						GoblinOS Hub
					</h1>
					<div className="header-status">
						<span className="status-dot status-connected" />
						<span className="text-muted">Connected</span>
					</div>
					<LoginPanel client={client as any} />
				</div>
			</header>

			{/* Main Layout */}
			<div className="hub-layout">
				{/* Left Sidebar: Goblin Grid */}
				<aside className="hub-sidebar-left">
					<GoblinGrid
						goblins={goblins}
						selectedGoblinId={selectedGoblinId}
						onSelectGoblin={handleSelectGoblin}
						busyGoblins={busyGoblins}
					/>
				</aside>

				{/* Center: Task Executor */}
				<main className="hub-main">
					<TaskExecutor
						client={client}
						selectedGoblin={selectedGoblin}
						onTaskComplete={handleTaskComplete}
						goblins={goblins}
					/>
				</main>

				{/* Right Sidebar: Stats + History + Costs + Runtime Status + API Keys */}
				<aside className="hub-sidebar-right">
					<StatsPanel
						client={client}
						goblinId={selectedGoblinId}
						refreshTrigger={refreshTrigger}
					/>
					<HistoryPanel
						client={client}
						goblinId={selectedGoblinId}
						refreshTrigger={refreshTrigger}
					/>
					<CostPanel client={client} refreshTrigger={refreshTrigger} />
					<RuntimeStatusPanel client={client} />
					<APIKeyTestPanel client={client} />
				</aside>
			</div>
		</div>
	);
}

/* ============================================================================
 * API Key Test Panel Component
 * ========================================================================== */

function APIKeyTestPanel({ client }: { client: RuntimeClient }) {
	const [providers, setProviders] = useState<string[]>([]);
	const [selectedProvider, setSelectedProvider] = useState<string>("");
	const [apiKey, setApiKey] = useState<string>("");
	const [testResults, setTestResults] = useState<string[]>([]);

	useEffect(() => {
		// Load available providers
		client.getProviders().then(setProviders).catch(console.error);
	}, [client]);

	const addTestResult = (message: string) => {
		setTestResults((prev) => [
			...prev.slice(-4),
			`${new Date().toLocaleTimeString()}: ${message}`,
		]);
	};

	const testStoreApiKey = async () => {
		if (!selectedProvider || !apiKey) return;
		try {
			await client.storeApiKey(selectedProvider, apiKey);
			addTestResult(`✅ Stored API key for ${selectedProvider}`);
		} catch (error) {
			addTestResult(`❌ Failed to store API key: ${error}`);
		}
	};

	const testGetApiKey = async () => {
		if (!selectedProvider) return;
		try {
			const key = await client.getApiKey(selectedProvider);
			addTestResult(
				`✅ Retrieved API key for ${selectedProvider}: ${key ? "Present" : "Not found"}`,
			);
		} catch (error) {
			addTestResult(`❌ Failed to get API key: ${error}`);
		}
	};

	const testClearApiKey = async () => {
		if (!selectedProvider) return;
		try {
			await client.clearApiKey(selectedProvider);
			addTestResult(`✅ Cleared API key for ${selectedProvider}`);
		} catch (error) {
			addTestResult(`❌ Failed to clear API key: ${error}`);
		}
	};

	return (
		<div className="panel api-key-test-panel">
			<div className="panel-header">
				<h3>API Key Testing</h3>
			</div>
			<div className="panel-content">
				<div className="form-group">
					<label htmlFor="provider-select">Provider:</label>
					<select
						id="provider-select"
						value={selectedProvider}
						onChange={(e) => setSelectedProvider(e.target.value)}
					>
						<option value="">Select provider...</option>
						{providers.map((provider) => (
							<option key={provider} value={provider}>
								{provider}
							</option>
						))}
					</select>
				</div>

				<div className="form-group">
					<label htmlFor="api-key-input">API Key:</label>
					<input
						id="api-key-input"
						type="password"
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						placeholder="Enter test API key"
					/>
				</div>

				<div className="button-group">
					<button
						onClick={testStoreApiKey}
						disabled={!selectedProvider || !apiKey}
					>
						Store Key
					</button>
					<button onClick={testGetApiKey} disabled={!selectedProvider}>
						Get Key
					</button>
					<button onClick={testClearApiKey} disabled={!selectedProvider}>
						Clear Key
					</button>
				</div>

				<div className="test-results">
					<h4>Test Results:</h4>
					<div className="results-list">
						{testResults.map((result, index) => (
							<div key={index} className="result-item">
								{result}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

/* ============================================================================
 * Styles
 * ========================================================================== */

const styles = `
.goblin-hub {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* Header */

.hub-header {
  flex-shrink: 0;
  padding: var(--space-4) var(--space-6);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-subtle);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hub-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font-size: var(--text-2xl);
  font-weight: 700;
}

.title-icon {
  font-size: 2rem;
}

.header-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.status-connected {
  background: var(--accent-green);
  box-shadow: var(--glow-green);
}

/* Layout */

.hub-layout {
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  flex: 1;
  overflow: hidden;
}

/* Sidebars */

.hub-sidebar-left,
.hub-sidebar-right {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hub-sidebar-left {
  background: var(--bg-primary);
  border-right: 1px solid var(--border-subtle);
}

.hub-sidebar-right {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: var(--space-4);
  background: var(--bg-primary);
  padding: var(--space-4);
  overflow-y: auto;
}

/* Main Content */

.hub-main {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
}

/* Error State */

.server-error,
.server-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: var(--space-8);
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  max-width: 500px;
  text-align: center;
}

.error-icon {
  font-size: 5rem;
  opacity: 0.5;
}

.error-content h2 {
  margin: 0;
  color: var(--text-primary);
}

.error-content p {
  color: var(--text-secondary);
}

.error-url,
.error-command {
  display: block;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--accent-green);
}

.error-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.error-command {
  margin-top: var(--space-2);
}

/* Loading State */

.server-loading {
  flex-direction: column;
  gap: var(--space-4);
}

.spinner-large {
  width: 48px;
  height: 48px;
  border: 4px solid var(--border-medium);
  border-top-color: var(--accent-green);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.server-loading h2 {
  margin: 0;
  color: var(--text-primary);
}

/* Responsive */

@media (max-width: 1200px) {
  .hub-layout {
    grid-template-columns: 240px 1fr 280px;
  }
}

@media (max-width: 900px) {
  .hub-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }

  .hub-sidebar-left {
    border-right: none;
    border-bottom: 1px solid var(--border-subtle);
    max-height: 200px;
  }

  .hub-sidebar-right {
    grid-template-rows: 1fr;
    border-left: none;
    border-top: 1px solid var(--border-subtle);
    max-height: 300px;
  }
}
`;

// Inject styles
if (typeof document !== "undefined") {
	const styleSheet = document.createElement("style");
	styleSheet.textContent = styles;
	document.head.appendChild(styleSheet);
}
