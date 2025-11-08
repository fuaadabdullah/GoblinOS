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
const BRIDGE = import.meta.env?.VITE_BRIDGE_URL || "http://localhost:3030";
async function fetchSummary(hours = 24, guild, goblin) {
	const params = new URLSearchParams({ hours: String(hours) });
	if (guild) params.set("guild", guild);
	if (goblin) params.set("goblin", goblin);
	const res = await fetch(
		`${String(BRIDGE).replace(/\/$/, "")}/kpi/summary?` + params.toString(),
	);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}
async function fetchSeries(hours = 24, kpi, guild, goblin, intervalMs) {
	const params = new URLSearchParams({ hours: String(hours), kpi });
	if (guild) params.set("guild", guild);
	if (goblin) params.set("goblin", goblin);
	if (intervalMs) params.set("intervalMs", String(intervalMs));
	const res = await fetch(
		`${String(BRIDGE).replace(/\/$/, "")}/kpi/series?` + params.toString(),
	);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}
async function fetchMeta() {
	const res = await fetch(`${String(BRIDGE).replace(/\/$/, "")}/kpi/meta`);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}
export function KpiPage() {
	const [hours, setHours] = useState(24);
	const [guild, setGuild] = useState(undefined);
	const [goblin, setGoblin] = useState(undefined);
	const [selectedKpis, setSelectedKpis] = useState([]);
	const metaQ = useQuery({ queryKey: ["kpi-meta"], queryFn: fetchMeta });
	const { data, isLoading, error, refetch } = useQuery({
		queryKey: ["kpi-summary", hours, guild, goblin],
		queryFn: () => fetchSummary(hours, guild, goblin),
		refetchInterval: 30000,
	});
	const seriesQs = (selectedKpis.length ? selectedKpis : []).map((kpi) => ({
		kpi,
	}));
	const seriesData = [];
	// naive data fetching loop (keeps code simple without useQueries)
	// Triggered within render via useQuery when keys change
	const seriesResults = selectedKpis.map((kpi) =>
		useQuery({
			queryKey: ["kpi-series", hours, kpi, guild, goblin],
			queryFn: () => fetchSeries(hours, kpi, guild, goblin, 3600000),
			refetchInterval: 30000,
		}),
	);
	if (isLoading) return _jsx("div", { children: "Loading KPI summary\u2026" });
	if (error)
		return _jsxs("div", {
			children: ["Error loading summary: ", error.message],
		});
	const kpis = (data?.kpis || []).map((d) => ({
		name: d.kpi,
		count: Number(d.count || 0),
		avg: Number(d.avg_value || 0),
	}));
	const tools = (data?.tools || []).map((d) => ({
		name: d.tool,
		count: Number(d.count || 0),
		success: Number(d.success_count || 0),
		avg_duration: Number(d.avg_duration || 0),
	}));
	const series =
		seriesData.length > 0
			? seriesData[0].points.map((p) => ({
					bucket: new Date(Number(p.bucket)).toLocaleString(),
					count: Number(p.count || 0),
					avg: Number(p.avg_value || 0),
				}))
			: [];
	const guilds = metaQ.data?.guilds || [];
	const goblins = metaQ.data?.goblins || [];
	const kpiOptions = metaQ.data?.kpis || [];
	const filteredGoblins = goblins.filter((g) => !guild || g.guild === guild);
	return _jsxs("div", {
		style: { display: "grid", gap: 24 },
		children: [
			_jsxs("div", {
				children: [
					_jsxs("div", {
						style: {
							display: "flex",
							gap: 12,
							alignItems: "center",
							marginBottom: 12,
						},
						children: [
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
							_jsxs("label", {
								children: [
									"Guild:",
									_jsxs("select", {
										value: guild || "",
										onChange: (e) => setGuild(e.target.value || undefined),
										style: { marginLeft: 6 },
										children: [
											_jsx("option", { value: "", children: "All" }),
											guilds.map((g) =>
												_jsx("option", { value: g, children: g }, g),
											),
										],
									}),
								],
							}),
							_jsxs("label", {
								children: [
									"Goblin:",
									_jsxs("select", {
										value: goblin || "",
										onChange: (e) => setGoblin(e.target.value || undefined),
										style: { marginLeft: 6 },
										children: [
											_jsx("option", { value: "", children: "All" }),
											filteredGoblins.map((gg) =>
												_jsx(
													"option",
													{ value: gg.goblin, children: gg.goblin },
													gg.goblin,
												),
											),
										],
									}),
								],
							}),
							_jsxs("label", {
								children: [
									"KPIs:",
									_jsx("select", {
										multiple: true,
										value: selectedKpis,
										onChange: (e) =>
											setSelectedKpis(
												Array.from(e.target.selectedOptions).map(
													(o) => o.value,
												),
											),
										style: { marginLeft: 6, minWidth: 180, height: 80 },
										children: kpiOptions.map((k) =>
											_jsx("option", { value: k, children: k }, k),
										),
									}),
								],
							}),
							_jsx("button", {
								onClick: () => refetch(),
								style: { padding: "6px 12px", border: "1px solid #ddd" },
								children: "Refresh",
							}),
						],
					}),
					_jsx("h2", {
						style: { fontWeight: 600, marginBottom: 8 },
						children: "Top KPIs (24h)",
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
							children: _jsxs(BarChart, {
								data: kpis,
								margin: { top: 12, right: 12, bottom: 12, left: 12 },
								children: [
									_jsx(CartesianGrid, { strokeDasharray: "3 3" }),
									_jsx(XAxis, {
										dataKey: "name",
										hide: false,
										interval: 0,
										angle: -15,
										textAnchor: "end",
										height: 60,
									}),
									_jsx(YAxis, {}),
									_jsx(Tooltip, {}),
									_jsx(Bar, {
										dataKey: "count",
										fill: "#3b82f6",
										name: "Count",
									}),
								],
							}),
						}),
					}),
				],
			}),
			_jsxs("div", {
				children: [
					_jsx("h2", {
						style: { fontWeight: 600, marginBottom: 8 },
						children: "Tool Usage (24h)",
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
							children: _jsxs(BarChart, {
								data: tools,
								margin: { top: 12, right: 12, bottom: 12, left: 12 },
								children: [
									_jsx(CartesianGrid, { strokeDasharray: "3 3" }),
									_jsx(XAxis, {
										dataKey: "name",
										hide: false,
										interval: 0,
										angle: -15,
										textAnchor: "end",
										height: 60,
									}),
									_jsx(YAxis, {}),
									_jsx(Tooltip, {}),
									_jsx(Bar, {
										dataKey: "count",
										fill: "#10b981",
										name: "Runs",
									}),
								],
							}),
						}),
					}),
				],
			}),
			_jsxs("div", {
				children: [
					_jsx("h2", {
						style: { fontWeight: 600, marginBottom: 8 },
						children: "KPI Trend",
					}),
					selectedKpis.length
						? _jsx("div", {
								style: {
									height: 320,
									background: "#fafafa",
									border: "1px solid #eee",
									paddingTop: 4,
								},
								children: _jsx(ResponsiveContainer, {
									width: "100%",
									height: "100%",
									children: _jsxs(LineChart, {
										data: (() => {
											const bucketMap = new Map();
											const palette = [
												"#ef4444",
												"#3b82f6",
												"#10b981",
												"#f59e0b",
												"#8b5cf6",
												"#06b6d4",
											];
											seriesResults.forEach((qr, idx) => {
												if (!qr.data?.points) return;
												const series = qr.data.points;
												const key = selectedKpis[idx];
												series.forEach((p) => {
													const b = new Date(Number(p.bucket)).toLocaleString();
													const row = bucketMap.get(b) || { bucket: b };
													row[key] = Number(p.count || 0);
													bucketMap.set(b, row);
												});
											});
											return Array.from(bucketMap.values());
										})(),
										margin: { top: 12, right: 12, bottom: 12, left: 12 },
										children: [
											_jsx(CartesianGrid, { strokeDasharray: "3 3" }),
											_jsx(XAxis, { dataKey: "bucket", interval: 0 }),
											_jsx(YAxis, {}),
											_jsx(Tooltip, {}),
											selectedKpis.map((k, i) =>
												_jsx(
													Line,
													{
														type: "monotone",
														dataKey: k,
														stroke: [
															"#ef4444",
															"#3b82f6",
															"#10b981",
															"#f59e0b",
															"#8b5cf6",
															"#06b6d4",
														][i % 6],
														name: k,
													},
													k,
												),
											),
										],
									}),
								}),
							})
						: _jsx("div", { children: "Select one or more KPIs to see trend" }),
				],
			}),
		],
	});
}
