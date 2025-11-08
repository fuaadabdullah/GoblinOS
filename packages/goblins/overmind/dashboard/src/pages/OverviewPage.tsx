import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
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

const BRIDGE =
	(import.meta as any).env?.VITE_BRIDGE_URL || "http://localhost:3030";

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
async function fetchToolSeries(hours = 24, intervalMs = 3600_000) {
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
		queryFn: () => fetchToolSeries(hours, 3600_000),
		refetchInterval: 30000,
	});
	const recentQ = useQuery({
		queryKey: ["overview-recent"],
		queryFn: () => fetchRecent(5),
		refetchInterval: 15000,
	});

	const kpis = (sumQ.data?.kpis || []).slice(0, 8).map((d: any, i: number) => ({
		name: d.kpi,
		count: Number(d.count || 0),
		color: getGuildColor(undefined, i),
	}));
	const tools = (sumQ.data?.tools || [])
		.slice(0, 8)
		.map((d: any, i: number) => ({
			name: d.tool,
			count: Number(d.count || 0),
			color: getGuildColor(undefined, i),
		}));
	const toolSeries = (toolSeriesQ.data?.points || []).map((p: any) => ({
		bucket: new Date(Number(p.bucket)).toLocaleString(),
		count: Number(p.count || 0),
		success: Number(p.success_count || 0),
	}));

	return (
		<div style={{ display: "grid", gap: 24 }}>
			<div style={{ display: "flex", gap: 12, alignItems: "center" }}>
				<h2 style={{ fontWeight: 700, margin: 0 }}>Overview</h2>
				<label>
					Hours:
					<select
						value={hours}
						onChange={(e) => setHours(Number(e.target.value))}
						style={{ marginLeft: 6 }}
					>
						{[6, 24, 72, 168].map((h) => (
							<option key={h} value={h}>
								{h}
							</option>
						))}
					</select>
				</label>
			</div>

			<div>
				<h3 style={{ fontWeight: 600, marginBottom: 8 }}>Top KPIs</h3>
				<div
					style={{
						height: 240,
						background: "#fafafa",
						border: "1px solid #eee",
					}}
				>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart
							data={kpis}
							margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
						>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis
								dataKey="name"
								interval={0}
								angle={-15}
								textAnchor="end"
								height={60}
							/>
							<YAxis />
							<Tooltip />
							<Bar dataKey="count" name="Count">
								{kpis.map((entry: any, index: number) => (
									// @ts-ignore recharts type quirk for per-bar fill
									<cell key={`kpi-${index}`} fill={entry.color} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</div>
			</div>

			<div>
				<h3 style={{ fontWeight: 600, marginBottom: 8 }}>Top Tools</h3>
				<div
					style={{
						height: 240,
						background: "#fafafa",
						border: "1px solid #eee",
					}}
				>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart
							data={tools}
							margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
						>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis
								dataKey="name"
								interval={0}
								angle={-15}
								textAnchor="end"
								height={60}
							/>
							<YAxis />
							<Tooltip />
							<Bar dataKey="count" name="Runs">
								{tools.map((entry: any, index: number) => (
									// @ts-ignore recharts type quirk for per-bar fill
									<cell key={`tool-${index}`} fill={entry.color} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</div>
			</div>

			<div>
				<h3 style={{ fontWeight: 600, marginBottom: 8 }}>
					Tool Invocations Trend
				</h3>
				<div
					style={{
						height: 280,
						background: "#fafafa",
						border: "1px solid #eee",
					}}
				>
					<ResponsiveContainer width="100%" height="100%">
						<LineChart
							data={toolSeries}
							margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
						>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis
								dataKey="bucket"
								interval={Math.max(0, Math.floor(toolSeries.length / 8))}
							/>
							<YAxis />
							<Tooltip />
							<Line
								type="monotone"
								dataKey="count"
								stroke="#ef4444"
								name="Invocations"
							/>
							<Line
								type="monotone"
								dataKey="success"
								stroke="#22c55e"
								name="Successes"
							/>
						</LineChart>
					</ResponsiveContainer>
				</div>
			</div>

			<div>
				<h3 style={{ fontWeight: 600, marginBottom: 8 }}>Last 5 Events</h3>
				<div style={{ overflowX: "auto" }}>
					<table style={{ width: "100%", borderCollapse: "collapse" }}>
						<thead>
							<tr>
								<th
									style={{
										textAlign: "left",
										borderBottom: "1px solid #eee",
										padding: 6,
									}}
								>
									Time
								</th>
								<th
									style={{
										textAlign: "left",
										borderBottom: "1px solid #eee",
										padding: 6,
									}}
								>
									Type
								</th>
								<th
									style={{
										textAlign: "left",
										borderBottom: "1px solid #eee",
										padding: 6,
									}}
								>
									Guild
								</th>
								<th
									style={{
										textAlign: "left",
										borderBottom: "1px solid #eee",
										padding: 6,
									}}
								>
									Goblin
								</th>
								<th
									style={{
										textAlign: "left",
										borderBottom: "1px solid #eee",
										padding: 6,
									}}
								>
									Item
								</th>
								<th
									style={{
										textAlign: "left",
										borderBottom: "1px solid #eee",
										padding: 6,
									}}
								>
									Info
								</th>
							</tr>
						</thead>
						<tbody>
							{(recentQ.data?.events || []).map((e: any, i: number) => (
								<tr key={i}>
									<td style={{ padding: 6 }}>
										{new Date(Number(e.ts)).toLocaleString()}
									</td>
									<td style={{ padding: 6 }}>{e.type}</td>
									<td style={{ padding: 6 }}>{e.guild || ""}</td>
									<td style={{ padding: 6 }}>{e.goblin || ""}</td>
									<td style={{ padding: 6 }}>{e.item}</td>
									<td style={{ padding: 6 }}>
										{e.type === "kpi"
											? `value=${e.value ?? ""} source=${e.meta ?? ""}`
											: `success=${e.success ? "yes" : "no"} duration=${e.duration_ms ?? ""}ms reason=${e.meta ?? ""}`}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
