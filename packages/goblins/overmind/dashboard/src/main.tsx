import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AgentsPage } from "./pages/AgentsPage";
import { CrewsPage } from "./pages/CrewsPage";
import { GoblinHubPage } from "./pages/GoblinHubPage";
import { getDefaultClient } from "./api/tauri-client";
import { KpiPage } from "./pages/KpiPage";
import { MemoryPage } from "./pages/MemoryPage";
import { OverviewPage } from "./pages/OverviewPage";

const qc = new QueryClient();
const defaultClient = getDefaultClient();

function App() {
	return (
		<QueryClientProvider client={qc}>
			<BrowserRouter>
				<div style={{ padding: 16, fontFamily: "ui-sans-serif, system-ui" }}>
					<header style={{ marginBottom: 16 }}>
						<h1 style={{ fontWeight: 700 }}>GoblinOS Hub</h1>
						<nav style={{ display: "flex", gap: 12 }}>
							<Link to="/hub">Hub (New)</Link>
							<Link to="/overview">Overview</Link>
							<Link to="/kpi">KPI</Link>
							<Link to="/crews">Crews</Link>
							<Link to="/agents">Agents</Link>
							<Link to="/memory">Memory</Link>
						</nav>
					</header>
					<Routes>
						<Route path="/" element={<Navigate to="/hub" replace />} />
						<Route path="/hub" element={<GoblinHubPage client={defaultClient} />} />
						<Route path="/overview" element={<OverviewPage />} />
						<Route path="/kpi" element={<KpiPage />} />
						<Route path="/crews" element={<CrewsPage />} />
						<Route path="/agents" element={<AgentsPage />} />
						<Route path="/memory" element={<MemoryPage />} />
					</Routes>
				</div>
			</BrowserRouter>
		</QueryClientProvider>
	);
}

createRoot(document.getElementById("root")!).render(<App />);
