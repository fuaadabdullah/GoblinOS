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

const BRIDGE =
	(import.meta as any).env?.VITE_BRIDGE_URL || "http://localhost:3030";

async function fetchSummary(hours = 24, guild?: string, goblin?: string) {
	const params = new URLSearchParams({ hours: String(hours) });
	if (guild) params.set("guild", guild);
	if (goblin) params.set("goblin", goblin);
	const res = await fetch(
		`${String(BRIDGE).replace(/\/$/, "")}/kpi/summary?` + params.toString(),
	);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}
async function fetchSeries(
	hours = 24,
	kpi: string,
	guild?: string,
	goblin?: string,
	intervalMs?: number,
) {
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
	const [guild, setGuild] = useState<string | undefined>(undefined);
	const [goblin, setGoblin] = useState<string | undefined>(undefined);
	const [selectedKpis, setSelectedKpis] = useState<string[]>([]);

	const metaQ = useQuery({ queryKey: ["kpi-meta"], queryFn: fetchMeta });
	const { data, isLoading, error, refetch } = useQuery({
		queryKey: ["kpi-summary", hours, guild, goblin],
		queryFn: () => fetchSummary(hours, guild, goblin),
		refetchInterval: 30_000,
	});
	const seriesQs = (selectedKpis.length ? selectedKpis : []).map((kpi) => ({
		kpi,
	}));
	const seriesData = [] as { kpi: string; points: any[] }[];
	// naive data fetching loop (keeps code simple without useQueries)
	// Triggered within render via useQuery when keys change
	const seriesResults = selectedKpis.map((kpi) =>
		useQuery({
			queryKey: ["kpi-series", hours, kpi, guild, goblin],
			queryFn: () => fetchSeries(hours, kpi, guild, goblin, 3600_000),
			refetchInterval: 30_000,
		}),
	);

	if (isLoading) return <div>Loading KPI summary…</div>;
	if (error)
		return <div>Error loading summary: {(error as Error).message}</div>;

	const kpis = (data?.kpis || []).map((d: any) => ({
		name: d.kpi,
		count: Number(d.count || 0),
		avg: Number(d.avg_value || 0),
	}));
	const tools = (data?.tools || []).map((d: any) => ({
		name: d.tool,
		count: Number(d.count || 0),
		success: Number(d.success_count || 0),
		avg_duration: Number(d.avg_duration || 0),
	}));
	const series =
		seriesData.length > 0
			? seriesData[0].points.map((p: any) => ({
					bucket: new Date(Number(p.bucket)).toLocaleString(),
					count: Number(p.count || 0),
					avg: Number(p.avg_value || 0),
				}))
			: [];

	const guilds: string[] = metaQ.data?.guilds || [];
	const goblins: { goblin: string; guild: string }[] =
		metaQ.data?.goblins || [];
	const kpiOptions: string[] = metaQ.data?.kpis || [];
	const filteredGoblins = goblins.filter((g) => !guild || g.guild === guild);

	return (
		<div style={{ display: "grid", gap: 24 }}>
			<div>
				<div
					style={{
						display: "flex",
						gap: 12,
						alignItems: "center",
						marginBottom: 12,
					}}
				>
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
					<label>
						Guild:
						<select
							value={guild || ""}
							onChange={(e) => setGuild(e.target.value || undefined)}
							style={{ marginLeft: 6 }}
						>
							<option value="">All</option>
							{guilds.map((g) => (
								<option key={g} value={g}>
									{g}
								</option>
							))}
						</select>
					</label>
					<label>
						Goblin:
						<select
							value={goblin || ""}
							onChange={(e) => setGoblin(e.target.value || undefined)}
							style={{ marginLeft: 6 }}
						>
							<option value="">All</option>
							{filteredGoblins.map((gg) => (
								<option key={gg.goblin} value={gg.goblin}>
									{gg.goblin}
								</option>
							))}
						</select>
					</label>
					<label>
						KPIs:
						<select
							multiple
							value={selectedKpis}
							onChange={(e) =>
								setSelectedKpis(
									Array.from(e.target.selectedOptions).map((o) => o.value),
								)
							}
							style={{ marginLeft: 6, minWidth: 180, height: 80 }}
						>
							{kpiOptions.map((k) => (
								<option key={k} value={k}>
									{k}
								</option>
							))}
						</select>
					</label>
					<button
						onClick={() => refetch()}
						style={{ padding: "6px 12px", border: "1px solid #ddd" }}
					>
						Refresh
					</button>
				</div>
				<h2 style={{ fontWeight: 600, marginBottom: 8 }}>Top KPIs (24h)</h2>
				<div
					style={{
						height: 280,
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
								hide={false}
								interval={0}
								angle={-15}
								textAnchor="end"
								height={60}
							/>
							<YAxis />
							<Tooltip />
							<Bar dataKey="count" fill="#3b82f6" name="Count" />
						</BarChart>
					</ResponsiveContainer>
				</div>
			</div>

			<div>
				<h2 style={{ fontWeight: 600, marginBottom: 8 }}>Tool Usage (24h)</h2>
				<div
					style={{
						height: 280,
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
								hide={false}
								interval={0}
								angle={-15}
								textAnchor="end"
								height={60}
							/>
							<YAxis />
							<Tooltip />
							<Bar dataKey="count" fill="#10b981" name="Runs" />
						</BarChart>
					</ResponsiveContainer>
				</div>
			</div>

			<div>
				<h2 style={{ fontWeight: 600, marginBottom: 8 }}>KPI Trend</h2>
				{selectedKpis.length ? (
					<div
						style={{
							height: 320,
							background: "#fafafa",
							border: "1px solid #eee",
							paddingTop: 4,
						}}
					>
						<ResponsiveContainer width="100%" height="100%">
							<LineChart
								data={(() => {
									const bucketMap = new Map<string, any>();
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
										const series = qr.data.points as any[];
										const key = selectedKpis[idx];
										series.forEach((p) => {
											const b = new Date(Number(p.bucket)).toLocaleString();
											const row = bucketMap.get(b) || { bucket: b };
											row[key] = Number(p.count || 0);
											bucketMap.set(b, row);
										});
									});
									return Array.from(bucketMap.values());
								})()}
								margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
							>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="bucket" interval={0} />
								<YAxis />
								<Tooltip />
								{selectedKpis.map((k, i) => (
									<Line
										key={k}
										type="monotone"
										dataKey={k}
										stroke={
											[
												"#ef4444",
												"#3b82f6",
												"#10b981",
												"#f59e0b",
												"#8b5cf6",
												"#06b6d4",
											][i % 6]
										}
										name={k}
									/>
								))}
							</LineChart>
						</ResponsiveContainer>
					</div>
				) : (
					<div>Select one or more KPIs to see trend</div>
				)}
			</div>
		</div>
	);
}
