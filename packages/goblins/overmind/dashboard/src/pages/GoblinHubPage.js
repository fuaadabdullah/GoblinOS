export { default } from "./GoblinHubPage";
export * from "./GoblinHubPage";

// Thin wrapper re-export for GoblinHubPage (keeps backward compatibility with .js imports)
export { default } from "./GoblinHubPage";
export * from "./GoblinHubPage";

// Thin wrapper re-export for GoblinHubPage
export { default } from "./GoblinHubPage";
export * from "./GoblinHubPage";

/**
 * GoblinHub - Main interactive dashboard
 *
 * Layout:
 * - Left: GoblinGrid (sidebar)
 * - Center: TaskExecutor
 * - Right: StatsPanel + HistoryPanel
 */
import { useEffect, useState } from "react";
import { CostPanel } from "../components/CostPanel";
import { GoblinGrid } from "../components/GoblinGrid";
import { HistoryPanel } from "../components/HistoryPanel";
import { RuntimeStatusPanel } from "../components/RuntimeStatusPanel";
import { StatsPanel } from "../components/StatsPanel";
import { TaskExecutor } from "../components/TaskExecutor";
import "../styles/dark-theme.css";
export function GoblinHubPage({ client }) {
    const [goblins, setGoblins] = useState([]);
    const [selectedGoblinId, setSelectedGoblinId] = useState(null);
    const [selectedGoblin, setSelectedGoblin] = useState(null);
    const [busyGoblins] = useState(new Set());
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [serverStatus, setServerStatus] = useState("connecting");
    // Initialize: check server health and fetch goblins
    useEffect(() => {
        const init = async () => {
            try {
                // Check server health - skip for desktop app
                // await client.getHealth();
                setServerStatus("connected");
                // Fetch goblins list
                const goblinsList = await client.getGoblins();
                setGoblins(goblinsList); // Auto-select first goblin
                if (goblinsList.length > 0 && !selectedGoblinId) {
                    setSelectedGoblinId(goblinsList[0].id);
                }
            }
            catch (error) {
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
        }
        else {
            setSelectedGoblin(null);
        }
    }, [selectedGoblinId, goblins]);
    // Handle goblin selection
    const handleSelectGoblin = (goblinId) => {
        setSelectedGoblinId(goblinId);
    };
    // Handle task completion - refresh stats and history
    const handleTaskComplete = () => {
        setRefreshTrigger((prev) => prev + 1);
    };
    // Server error state
    if (serverStatus === "error") {
        return (_jsx("div", { className: "goblin-hub", children: _jsx("div", { className: "server-error", children: _jsxs("div", { className: "error-content", children: [_jsx("div", { className: "error-icon", children: "\uD83D\uDD0C" }), _jsx("h2", { children: "Server Connection Failed" }), _jsx("p", { children: "Could not connect to GoblinOS Runtime Server" }), _jsx("code", { className: "error-url", children: "http://localhost:3001" }), _jsxs("div", { className: "error-actions", children: [_jsx("p", { className: "text-muted", children: "Make sure the server is running:" }), _jsx("code", { className: "error-command", children: "pnpm --filter @goblinos/goblin-runtime server" })] }), _jsx("button", { className: "button button-primary", onClick: () => window.location.reload(), children: "Retry Connection" })] }) }) }));
    }
    // Loading state
    if (serverStatus === "connecting") {
        return (_jsx("div", { className: "goblin-hub", children: _jsxs("div", { className: "server-loading", children: [_jsx("div", { className: "spinner-large" }), _jsx("h2", { children: "Connecting to GoblinOS..." }), _jsx("p", { className: "text-muted", children: "http://localhost:3001" })] }) }));
    }
    return (_jsxs("div", { className: "goblin-hub", children: [_jsx("header", { className: "hub-header", children: _jsxs("div", { className: "header-content", children: [_jsxs("h1", { className: "hub-title", children: [_jsx("span", { className: "title-icon", children: "\uD83E\uDD16" }), "GoblinOS Hub"] }), _jsxs("div", { className: "header-status", children: [_jsx("span", { className: "status-dot status-connected" }), _jsx("span", { className: "text-muted", children: "Connected" })] })] }) }), _jsxs("div", { className: "hub-layout", children: [_jsx("aside", { className: "hub-sidebar-left", children: _jsx(GoblinGrid, { goblins: goblins, selectedGoblinId: selectedGoblinId, onSelectGoblin: handleSelectGoblin, busyGoblins: busyGoblins }) }), _jsx("main", { className: "hub-main", children: _jsx(TaskExecutor, { client: client, selectedGoblin: selectedGoblin, onTaskComplete: handleTaskComplete, goblins: goblins }) }), _jsxs("aside", { className: "hub-sidebar-right", children: [_jsx(StatsPanel, { client: client, goblinId: selectedGoblinId, refreshTrigger: refreshTrigger }), _jsx(HistoryPanel, { client: client, goblinId: selectedGoblinId, refreshTrigger: refreshTrigger }), _jsx(CostPanel, { client: client, refreshTrigger: refreshTrigger }), _jsx(RuntimeStatusPanel, { client: client }), _jsx(APIKeyTestPanel, { client: client })] })] })] }));
}
/* ============================================================================
 * API Key Test Panel Component
 * ========================================================================== */
function APIKeyTestPanel({ client }) {
    const [providers, setProviders] = useState([]);
    const [selectedProvider, setSelectedProvider] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [testResults, setTestResults] = useState([]);
    useEffect(() => {
        // Load available providers
        client.getProviders().then(setProviders).catch(console.error);
    }, [client]);
    const addTestResult = (message) => {
        setTestResults((prev) => [
            ...prev.slice(-4),
            `${new Date().toLocaleTimeString()}: ${message}`,
        ]);
    };
    const testStoreApiKey = async () => {
        if (!selectedProvider || !apiKey)
            return;
        try {
            await client.storeApiKey(selectedProvider, apiKey);
            addTestResult(`✅ Stored API key for ${selectedProvider}`);
        }
        catch (error) {
            addTestResult(`❌ Failed to store API key: ${error}`);
        }
    };
    const testGetApiKey = async () => {
        if (!selectedProvider)
            return;
        try {
            const key = await client.getApiKey(selectedProvider);
            addTestResult(`✅ Retrieved API key for ${selectedProvider}: ${key ? "Present" : "Not found"}`);
        }
        catch (error) {
            addTestResult(`❌ Failed to get API key: ${error}`);
        }
    };
    const testClearApiKey = async () => {
        if (!selectedProvider)
            return;
        try {
            await client.clearApiKey(selectedProvider);
            addTestResult(`✅ Cleared API key for ${selectedProvider}`);
        }
        catch (error) {
            addTestResult(`❌ Failed to clear API key: ${error}`);
        }
    };
    return (_jsxs("div", { className: "panel api-key-test-panel", children: [_jsx("div", { className: "panel-header", children: _jsx("h3", { children: "API Key Testing" }) }), _jsxs("div", { className: "panel-content", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "provider-select", children: "Provider:" }), _jsxs("select", { id: "provider-select", value: selectedProvider, onChange: (e) => setSelectedProvider(e.target.value), children: [_jsx("option", { value: "", children: "Select provider..." }), providers.map((provider) => (_jsx("option", { value: provider, children: provider }, provider)))] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "api-key-input", children: "API Key:" }), _jsx("input", { id: "api-key-input", type: "password", value: apiKey, onChange: (e) => setApiKey(e.target.value), placeholder: "Enter test API key" })] }), _jsxs("div", { className: "button-group", children: [_jsx("button", { onClick: testStoreApiKey, disabled: !selectedProvider || !apiKey, children: "Store Key" }), _jsx("button", { onClick: testGetApiKey, disabled: !selectedProvider, children: "Get Key" }), _jsx("button", { onClick: testClearApiKey, disabled: !selectedProvider, children: "Clear Key" })] }), _jsxs("div", { className: "test-results", children: [_jsx("h4", { children: "Test Results:" }), _jsx("div", { className: "results-list", children: testResults.map((result, index) => (_jsx("div", { className: "result-item", children: result }, index))) })] })] })] }));
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
