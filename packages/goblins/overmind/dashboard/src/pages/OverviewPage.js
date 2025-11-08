import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { getGuildColor } from "../theme";
const BRIDGE = import.meta.env?.VITE_BRIDGE_URL || "http://localhost:3030";
async function fetchSummary(hours = 24) {
	const res = await fetch(
		`${String(BRIDGE).replace(/\/$/, "")}/kpi/summary?hours=${hours}`,
	);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}
async function fetchRecent(limit = 5) {
	const res = await fetch(
		`${String(BRIDGE).replace(/\/$/, "")}/kpi/recent?limit=${limit}`,
	);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}
async function fetchToolSeries(hours = 24, intervalMs = 3600000) {
	const res = await fetch(
		`${String(BRIDGE).replace(/\/$/, "")}/kpi/tool-series?hours=${hours}&intervalMs=${intervalMs}`,
	);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}
export function OverviewPage() {
	const [hours, setHours] = useState(24);
	const sumQ = useQuery({
		queryKey: ["overview-summary", hours],
		queryFn: () => fetchSummary(hours),
		refetchInterval: 30000,
	});
	const toolSeriesQ = useQuery({
		queryKey: ["overview-tool-series", hours],
		queryFn: () => fetchToolSeries(hours, 3600000),
		refetchInterval: 30000,
	});
	const recentQ = useQuery({
		queryKey: ["overview-recent"],
		queryFn: () => fetchRecent(5),
		refetchInterval: 15000,
	});
	const kpis = (sumQ.data?.kpis || []).slice(0, 8).map((d, i) => ({
		name: d.kpi,
		count: Number(d.count || 0),
		color: getGuildColor(undefined, i),
	}));
	const tools = (sumQ.data?.tools || []).slice(0, 8).map((d, i) => ({
		name: d.tool,
		count: Number(d.count || 0),
		color: getGuildColor(undefined, i),
	}));
	const toolSeries = (toolSeriesQ.data?.points || []).map((p) => ({
		bucket: new Date(Number(p.bucket)).toLocaleString(),
		count: Number(p.count || 0),
		success: Number(p.success_count || 0),
	}));
	return _jsxs("div", {
		style: { display: "grid", gap: 24 },
		children: [
			_jsxs("div", {
				style: { display: "flex", gap: 12, alignItems: "center" },
				children: [
					_jsx("h2", {
						style: { fontWeight: 700, margin: 0 },
						children: "Overview",
					}),
					_jsxs("label", {
						children: [
							"Hours:",
							_jsx("select", {
								value: hours,
								onChange: (e) => setHours(Number(e.target.value)),
								style: { marginLeft: 6 },
								children: [6, 24, 72, 168].map((h) =>
									_jsx("option", { value: h, children: h }, h),
								),
							}),
						],
					}),
				],
			}),
			_jsxs("div", {
				children: [
					_jsx("h3", {
						style: { fontWeight: 600, marginBottom: 8 },
						children: "Top KPIs",
					}),
					_jsx("div", {
						style: {
							height: 240,
							background: "#fafafa",
							border: "1px solid #eee",
						},
						children: _jsx(ResponsiveContainer, {
							width: "100%",
							height: "100%",
							children: _jsxs(BarChart, {
								data: kpis,
								margin: { top: 12, right: 12, bottom: 12, left: 12 },
								children: [
									_jsx(CartesianGrid, { strokeDasharray: "3 3" }),
									_jsx(XAxis, {
										dataKey: "name",
										interval: 0,
										angle: -15,
										textAnchor: "end",
										height: 60,
									}),
									_jsx(YAxis, {}),
									_jsx(Tooltip, {}),
									_jsx(Bar, {
										dataKey: "count",
										name: "Count",
										children: kpis.map((entry, index) =>
											// @ts-ignore recharts type quirk for per-bar fill
											_jsx("cell", { fill: entry.color }, `kpi-${index}`),
										),
									}),
								],
							}),
						}),
					}),
				],
			}),
			_jsxs("div", {
				children: [
					_jsx("h3", {
						style: { fontWeight: 600, marginBottom: 8 },
						children: "Top Tools",
					}),
					_jsx("div", {
						style: {
							height: 240,
							background: "#fafafa",
							border: "1px solid #eee",
						},
						children: _jsx(ResponsiveContainer, {
							width: "100%",
							height: "100%",
							children: _jsxs(BarChart, {
								data: tools,
								margin: { top: 12, right: 12, bottom: 12, left: 12 },
								children: [
									_jsx(CartesianGrid, { strokeDasharray: "3 3" }),
									_jsx(XAxis, {
										dataKey: "name",
										interval: 0,
										angle: -15,
										textAnchor: "end",
										height: 60,
									}),
									_jsx(YAxis, {}),
									_jsx(Tooltip, {}),
									_jsx(Bar, {
										dataKey: "count",
										name: "Runs",
										children: tools.map((entry, index) =>
											// @ts-ignore recharts type quirk for per-bar fill
											_jsx("cell", { fill: entry.color }, `tool-${index}`),
										),
									}),
								],
							}),
						}),
					}),
				],
			}),
			_jsxs("div", {
				children: [
					_jsx("h3", {
						style: { fontWeight: 600, marginBottom: 8 },
						children: "Tool Invocations Trend",
					}),
					_jsx("div", {
						style: {
							height: 280,
							background: "#fafafa",
							border: "1px solid #eee",
						},
						children: _jsx(ResponsiveContainer, {
							width: "100%",
							height: "100%",
							children: _jsxs(LineChart, {
								data: toolSeries,
								margin: { top: 12, right: 12, bottom: 12, left: 12 },
								children: [
									_jsx(CartesianGrid, { strokeDasharray: "3 3" }),
									_jsx(XAxis, {
										dataKey: "bucket",
										interval: Math.max(0, Math.floor(toolSeries.length / 8)),
									}),
									_jsx(YAxis, {}),
									_jsx(Tooltip, {}),
									_jsx(Line, {
										type: "monotone",
										dataKey: "count",
										stroke: "#ef4444",
										name: "Invocations",
									}),
									_jsx(Line, {
										type: "monotone",
										dataKey: "success",
										stroke: "#22c55e",
										name: "Successes",
									}),
								],
							}),
						}),
					}),
				],
			}),
			_jsxs("div", {
				children: [
					_jsx("h3", {
						style: { fontWeight: 600, marginBottom: 8 },
						children: "Last 5 Events",
					}),
					_jsx("div", {
						style: { overflowX: "auto" },
						children: _jsxs("table", {
							style: { width: "100%", borderCollapse: "collapse" },
							children: [
								_jsx("thead", {
									children: _jsxs("tr", {
										children: [
											_jsx("th", {
												style: {
													textAlign: "left",
													borderBottom: "1px solid #eee",
													padding: 6,
												},
												children: "Time",
											}),
											_jsx("th", {
												style: {
													textAlign: "left",
													borderBottom: "1px solid #eee",
													padding: 6,
												},
												children: "Type",
											}),
											_jsx("th", {
												style: {
													textAlign: "left",
													borderBottom: "1px solid #eee",
													padding: 6,
												},
												children: "Guild",
											}),
											_jsx("th", {
												style: {
													textAlign: "left",
													borderBottom: "1px solid #eee",
													padding: 6,
												},
												children: "Goblin",
											}),
											_jsx("th", {
												style: {
													textAlign: "left",
													borderBottom: "1px solid #eee",
													padding: 6,
												},
												children: "Item",
											}),
											_jsx("th", {
												style: {
													textAlign: "left",
													borderBottom: "1px solid #eee",
													padding: 6,
												},
												children: "Info",
											}),
										],
									}),
								}),
								_jsx("tbody", {
									children: (recentQ.data?.events || []).map((e, i) =>
										_jsxs(
											"tr",
											{
												children: [
													_jsx("td", {
														style: { padding: 6 },
														children: new Date(Number(e.ts)).toLocaleString(),
													}),
													_jsx("td", {
														style: { padding: 6 },
														children: e.type,
													}),
													_jsx("td", {
														style: { padding: 6 },
														children: e.guild || "",
													}),
													_jsx("td", {
														style: { padding: 6 },
														children: e.goblin || "",
													}),
													_jsx("td", {
														style: { padding: 6 },
														children: e.item,
													}),
													_jsx("td", {
														style: { padding: 6 },
														children:
															e.type === "kpi"
																? `value=${e.value ?? ""} source=${e.meta ?? ""}`
																: `success=${e.success ? "yes" : "no"} duration=${e.duration_ms ?? ""}ms reason=${e.meta ?? ""}`,
													}),
												],
											},
											i,
										),
									),
								}),
							],
						}),
					}),
				],
			}),
		],
	});
}
