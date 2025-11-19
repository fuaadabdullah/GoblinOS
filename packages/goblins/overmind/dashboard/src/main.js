export { default } from "./main";
export * from "./main";

// Wrapper entrypoint that re-exports the TypeScript main module (main.tsx)
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AgentsPage } from "./pages/AgentsPage";
import { CrewsPage } from "./pages/CrewsPage";
import { GoblinHubPage } from "./pages/GoblinHubPage";
import { KpiPage } from "./pages/KpiPage";
import { MemoryPage } from "./pages/MemoryPage";
import { OverviewPage } from "./pages/OverviewPage";
const qc = new QueryClient();
function App() {
    return (_jsx(QueryClientProvider, { client: qc, children: _jsx(BrowserRouter, { children: _jsxs("div", { style: { padding: 16, fontFamily: "ui-sans-serif, system-ui" }, children: [_jsxs("header", { style: { marginBottom: 16 }, children: [_jsx("h1", { style: { fontWeight: 700 }, children: "GoblinOS Hub" }), _jsxs("nav", { style: { display: "flex", gap: 12 }, children: [_jsx(Link, { to: "/hub", children: "Hub (New)" }), _jsx(Link, { to: "/overview", children: "Overview" }), _jsx(Link, { to: "/kpi", children: "KPI" }), _jsx(Link, { to: "/crews", children: "Crews" }), _jsx(Link, { to: "/agents", children: "Agents" }), _jsx(Link, { to: "/memory", children: "Memory" })] })] }), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/hub", replace: true }) }), _jsx(Route, { path: "/hub", element: _jsx(GoblinHubPage, {}) }), _jsx(Route, { path: "/overview", element: _jsx(OverviewPage, {}) }), _jsx(Route, { path: "/kpi", element: _jsx(KpiPage, {}) }), _jsx(Route, { path: "/crews", element: _jsx(CrewsPage, {}) }), _jsx(Route, { path: "/agents", element: _jsx(AgentsPage, {}) }), _jsx(Route, { path: "/memory", element: _jsx(MemoryPage, {}) })] })] }) }) }));
}
createRoot(document.getElementById("root")).render(_jsx(App, {}));
