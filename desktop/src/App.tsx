import { useEffect, useState } from "react";
import {
	type CostSummary,
	type GoblinStatus,
	type OrchestrationPlan,
	runtimeClient,
} from "./api/tauri-client";
import "./App.css";

function App() {
	const [goblins, setGoblins] = useState<GoblinStatus[]>([]);
	const [providers, setProviders] = useState<string[]>([]);
	const [selectedGoblin, setSelectedGoblin] = useState<string | null>(null);
	const [selectedProvider, setSelectedProvider] = useState<string>("");
	const [task, setTask] = useState("");
	const [orchestrationText, setOrchestrationText] = useState("");
	const [response, setResponse] = useState("");
	const [streamingResponse, setStreamingResponse] = useState("");
	const [loading, setLoading] = useState(false);
	const [streaming, setStreaming] = useState(false);
	const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
	const [orchestrationPlan, setOrchestrationPlan] =
		useState<OrchestrationPlan | null>(null);

	useEffect(() => {
		loadInitialData();
	}, []);

	async function loadInitialData() {
		try {
			const [goblinList, providerList, costs] = await Promise.all([
				runtimeClient.getGoblins(),
				runtimeClient.getProviders(),
				runtimeClient.getCostSummary().catch(() => null),
			]);

			setGoblins(goblinList);
			setProviders(providerList);
			setCostSummary(costs);

			if (goblinList.length > 0) {
				setSelectedGoblin(goblinList[0].id);
			}
			if (providerList.length > 0) {
				setSelectedProvider(providerList[0]);
			}
		} catch (error) {
			console.error("Failed to load initial data:", error);
		}
	}

	async function executeTask() {
		if (!selectedGoblin || !task) return;

		setLoading(true);
		setResponse("");
		setStreamingResponse("");
		setOrchestrationPlan(null);

		try {
			if (streaming) {
				// Streaming execution
				await runtimeClient.executeTaskStreaming(
					selectedGoblin,
					task,
					(token) => {
						setStreamingResponse((prev) => prev + token);
					},
					(finalResponse) => {
						setResponse(finalResponse.reasoning);
						setLoading(false);
						// Refresh cost summary
						runtimeClient
							.getCostSummary()
							.then(setCostSummary)
							.catch(() => {});
					},
				);
			} else {
				// Regular execution
				const result = await runtimeClient.executeTask(
					selectedGoblin,
					task,
					false,
				);
				setResponse(result.reasoning);
				setLoading(false);
				// Refresh cost summary
				runtimeClient
					.getCostSummary()
					.then(setCostSummary)
					.catch(() => {});
			}
			setTask("");
		} catch (error) {
			setResponse(`Error: ${error}`);
			setLoading(false);
		}
	}

	async function parseOrchestration() {
		if (!orchestrationText) return;

		try {
			const plan = await runtimeClient.parseOrchestration(
				orchestrationText,
				selectedGoblin || undefined,
			);
			setOrchestrationPlan(plan);
		} catch (error) {
			console.error("Failed to parse orchestration:", error);
		}
	}

	return (
		<main className="container">
			<h1>🧙 GoblinOS Hub</h1>
			<p className="subtitle">
				AI Development Automation with Multi-Provider Support
			</p>

			<div className="goblin-selector">
				<label>Select Goblin:</label>
				<select
					value={selectedGoblin || ""}
					onChange={(e) => setSelectedGoblin(e.target.value)}
					disabled={goblins.length === 0}
				>
					{goblins.map((goblin) => (
						<option key={goblin.id} value={goblin.id}>
							{goblin.name} - {goblin.title}
						</option>
					))}
				</select>
			</div>

			{providers.length > 0 && (
				<div className="goblin-selector">
					<label>Available Providers:</label>
					<div className="provider-list">
						{providers.map((provider) => (
							<span key={provider} className="status active">
								{provider}
							</span>
						))}
					</div>
				</div>
			)}

			<form
				className="task-form"
				onSubmit={(e) => {
					e.preventDefault();
					executeTask();
				}}
			>
				<input
					id="task-input"
					value={task}
					onChange={(e) => setTask(e.currentTarget.value)}
					placeholder="Enter a task for your goblin..."
					disabled={loading || !selectedGoblin}
				/>
				<label className="streaming-toggle">
					<input
						type="checkbox"
						checked={streaming}
						onChange={(e) => setStreaming(e.target.checked)}
					/>
					Streaming
				</label>
				<button type="submit" disabled={loading || !selectedGoblin || !task}>
					{loading ? "Executing..." : "Execute"}
				</button>
			</form>

			<div className="orchestration-section">
				<h3>Orchestration Parser</h3>
				<form
					className="orchestration-form"
					onSubmit={(e) => {
						e.preventDefault();
						parseOrchestration();
					}}
				>
					<input
						value={orchestrationText}
						onChange={(e) => setOrchestrationText(e.currentTarget.value)}
						placeholder="e.g., websmith: build project THEN run tests"
					/>
					<button type="submit" disabled={!orchestrationText}>
						Parse
					</button>
				</form>
			</div>

			{orchestrationPlan && (
				<div className="response-box">
					<h3>Orchestration Plan:</h3>
					<pre>{JSON.stringify(orchestrationPlan, null, 2)}</pre>
				</div>
			)}

			{(response || streamingResponse) && (
				<div className="response-box">
					<h3>Response:</h3>
					<pre>{streamingResponse || response}</pre>
				</div>
			)}

			{costSummary && (
				<div className="response-box">
					<h3>Cost Summary:</h3>
					<div className="cost-summary">
						<div>
							<strong>Total Cost:</strong> ${costSummary.total_cost.toFixed(6)}
						</div>
						<div>
							<strong>By Provider:</strong>
							<ul>
								{Object.entries(costSummary.cost_by_provider).map(
									([provider, cost]) => (
										<li key={provider}>
											{provider}: ${cost.toFixed(6)}
										</li>
									),
								)}
							</ul>
						</div>
						<div>
							<strong>By Model:</strong>
							<ul>
								{Object.entries(costSummary.cost_by_model).map(
									([model, cost]) => (
										<li key={model}>
											{model}: ${cost.toFixed(6)}
										</li>
									),
								)}
							</ul>
						</div>
					</div>
				</div>
			)}

			<div className="goblin-list">
				<h3>Available Goblins:</h3>
				{goblins.map((goblin) => (
					<div key={goblin.id} className="goblin-card">
						<strong>{goblin.name}</strong>
						<div className="goblin-meta">
							<span className="title">{goblin.title}</span>
							{goblin.guild && <span className="guild">• {goblin.guild}</span>}
						</div>
						<span className={`status ${goblin.status}`}>{goblin.status}</span>
					</div>
				))}
			</div>
		</main>
	);
}

export default App;
