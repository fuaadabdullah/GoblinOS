/**
 * GoblinHub - Main interactive dashboard
 *
 * Layout:
 * - Left: GoblinGrid (sidebar)
 * - Center: TaskExecutor
 * - Right: StatsPanel + HistoryPanel
 */
import { useEffect, useState } from "react";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { getDefaultClient } from "../api/runtime-client";
import { CostPanel } from "../components/CostPanel";
import { GoblinGrid } from "../components/GoblinGrid";
import { HistoryPanel } from "../components/HistoryPanel";
import { StatsPanel } from "../components/StatsPanel";
import { TaskExecutor } from "../components/TaskExecutor";
import "../styles/dark-theme.css";
export function GoblinHubPage() {
	const [client] = useState(() => getDefaultClient("http://localhost:3001"));
	const [goblins, setGoblins] = useState([]);
	const [selectedGoblinId, setSelectedGoblinId] = useState(null);
	const [selectedGoblin, setSelectedGoblin] = useState(null);
	const [busyGoblins, setBusyGoblins] = useState(new Set());
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	const [serverStatus, setServerStatus] = useState("connecting");
	// Initialize: check server health and fetch goblins
	useEffect(() => {
		const init = async () => {
			try {
				// Check server health
				await client.getHealth();
				setServerStatus("connected");
				// Fetch goblins list
				const goblinsList = await client.getGoblins();
				setGoblins(goblinsList);
				// Auto-select first goblin
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
	const handleSelectGoblin = (goblinId) => {
		setSelectedGoblinId(goblinId);
	};
	// Handle task completion - refresh stats and history
	const handleTaskComplete = () => {
		setRefreshTrigger((prev) => prev + 1);
	};
	// Server error state
	if (serverStatus === "error") {
		return _jsx("div", {
			className: "goblin-hub",
			children: _jsx("div", {
				className: "server-error",
				children: _jsxs("div", {
					className: "error-content",
					children: [
						_jsx("div", { className: "error-icon", children: "\uD83D\uDD0C" }),
						_jsx("h2", { children: "Server Connection Failed" }),
						_jsx("p", {
							children: "Could not connect to GoblinOS Runtime Server",
						}),
						_jsx("code", {
							className: "error-url",
							children: "http://localhost:3001",
						}),
						_jsxs("div", {
							className: "error-actions",
							children: [
								_jsx("p", {
									className: "text-muted",
									children: "Make sure the server is running:",
								}),
								_jsx("code", {
									className: "error-command",
									children: "pnpm --filter @goblinos/goblin-runtime server",
								}),
							],
						}),
						_jsx("button", {
							className: "button button-primary",
							onClick: () => window.location.reload(),
							children: "Retry Connection",
						}),
					],
				}),
			}),
		});
	}
	// Loading state
	if (serverStatus === "connecting") {
		return _jsx("div", {
			className: "goblin-hub",
			children: _jsxs("div", {
				className: "server-loading",
				children: [
					_jsx("div", { className: "spinner-large" }),
					_jsx("h2", { children: "Connecting to GoblinOS..." }),
					_jsx("p", {
						className: "text-muted",
						children: "http://localhost:3001",
					}),
				],
			}),
		});
	}
	return _jsxs("div", {
		className: "goblin-hub",
		children: [
			_jsx("header", {
				className: "hub-header",
				children: _jsxs("div", {
					className: "header-content",
					children: [
						_jsxs("h1", {
							className: "hub-title",
							children: [
								_jsx("span", {
									className: "title-icon",
									children: "\uD83E\uDD16",
								}),
								"GoblinOS Hub",
							],
						}),
						_jsxs("div", {
							className: "header-status",
							children: [
								_jsx("span", { className: "status-dot status-connected" }),
								_jsx("span", {
									className: "text-muted",
									children: "Connected",
								}),
							],
						}),
					],
				}),
			}),
			_jsxs("div", {
				className: "hub-layout",
				children: [
					_jsx("aside", {
						className: "hub-sidebar-left",
						children: _jsx(GoblinGrid, {
							goblins: goblins,
							selectedGoblinId: selectedGoblinId,
							onSelectGoblin: handleSelectGoblin,
							busyGoblins: busyGoblins,
						}),
					}),
					_jsx("main", {
						className: "hub-main",
						children: _jsx(TaskExecutor, {
							client: client,
							selectedGoblin: selectedGoblin,
							onTaskComplete: handleTaskComplete,
						}),
					}),
					_jsxs("aside", {
						className: "hub-sidebar-right",
						children: [
							_jsx(StatsPanel, {
								client: client,
								goblinId: selectedGoblinId,
								refreshTrigger: refreshTrigger,
							}),
							_jsx(HistoryPanel, {
								client: client,
								goblinId: selectedGoblinId,
								refreshTrigger: refreshTrigger,
							}),
							_jsx(CostPanel, {
								client: client,
								refreshTrigger: refreshTrigger,
							}),
						],
					}),
				],
			}),
		],
	});
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
