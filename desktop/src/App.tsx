import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AgentsPage } from "../../packages/goblins/overmind/dashboard/src/pages/AgentsPage";
import { CrewsPage } from "../../packages/goblins/overmind/dashboard/src/pages/CrewsPage";
import { GoblinHubPage } from "../../packages/goblins/overmind/dashboard/src/pages/GoblinHubPage";
import { KpiPage } from "../../packages/goblins/overmind/dashboard/src/pages/KpiPage";
import { MemoryPage } from "../../packages/goblins/overmind/dashboard/src/pages/MemoryPage";
import { OverviewPage } from "../../packages/goblins/overmind/dashboard/src/pages/OverviewPage";
import Dashboard from "./components/Dashboard";
import { runtimeClient } from "./api/tauri-client";
import "./App.css";

const qc = new QueryClient();

function App() {
	return (
		<QueryClientProvider client={qc}>
			<BrowserRouter>
				<div className="app-container">
					<header className="app-header">
						<h1 className="app-title">GoblinOS Hub</h1>
						<nav className="app-nav">
							<Link to="/hub">Hub (New)</Link>
							<Link to="/overview">Overview</Link>
							<Link to="/kpi">KPI</Link>
							<Link to="/crews">Crews</Link>
							<Link to="/agents">Agents</Link>
							<Link to="/memory">Memory</Link>
							<Link to="/dashboard">Dashboard</Link>
						</nav>
					</header>
					<Routes>
						<Route path="/" element={<Navigate to="/hub" replace />} />
						<Route path="/hub" element={<GoblinHubPage client={runtimeClient as any} />} />
						<Route path="/overview" element={<OverviewPage />} />
						<Route path="/kpi" element={<KpiPage />} />
						<Route path="/crews" element={<CrewsPage />} />
						<Route path="/agents" element={<AgentsPage />} />
						<Route path="/memory" element={<MemoryPage />} />
						<Route path="/dashboard" element={<Dashboard />} />
					</Routes>
				</div>
			</BrowserRouter>
		</QueryClientProvider>
	);
}

export default App;
