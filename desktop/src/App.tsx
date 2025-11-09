import { useEffect, useState } from "react";
import {
	type CostSummary,
	type GoblinStatus,
	type OrchestrationPlan,
	runtimeClient,
} from "./api/tauri-client";
import "./App.css";
import ProviderSelector from "./components/ProviderSelector";
import StreamingView from "./components/StreamingView";
import CostPanel from "./components/CostPanel";
import OrchestrationPreview from "./components/OrchestrationPreview";
import APIKeyManager from "./components/APIKeyManager";

function App() {
	const [goblins, setGoblins] = useState<GoblinStatus[]>([]);
	const [providers, setProviders] = useState<string[]>([]);
	const [selectedGoblin, setSelectedGoblin] = useState<string | null>(null);
	const [selectedProvider, setSelectedProvider] = useState<string>("");
	const [providerModels, setProviderModels] = useState<string[]>([]);
	const [task, setTask] = useState("");
	const [selectedModel, setSelectedModel] = useState<string>("");
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

	useEffect(() => {
		if (!selectedProvider) {
			setProviderModels([]);
			return;
		}
		runtimeClient
			.getProviderModels(selectedProvider)
			.then((m) => setProviderModels(m))
			.catch(() => setProviderModels([]));
	}, [selectedProvider]);

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
				// Prefer per-goblin router if present (brain.router or router)
				const first = goblinList[0] as any;
				const preferred =
					(first?.brain && first.brain.router) || first?.router || undefined;
				if (preferred && providerList.includes(preferred)) {
					setSelectedProvider(preferred);
				} else if (providerList.length > 0) {
					setSelectedProvider(providerList[0]);
				}
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
					selectedProvider || undefined,
					selectedModel || undefined,
				);
			} else {
				// Regular execution
				const result = await runtimeClient.executeTask(
					selectedGoblin,
					task,
					false,
					selectedProvider || undefined,
					selectedModel || undefined,
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
				<label htmlFor="goblin-select">Select Goblin:</label>
				<select
					id="goblin-select"
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
				<ProviderSelector
					providers={providers}
					selected={selectedProvider}
					onChange={(p) => setSelectedProvider(p)}
				/>
			)}

			{/* Secure API key manager (stores keys in OS keychain via Tauri) */}
			<APIKeyManager />

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
				{providerModels && providerModels.length > 0 ? (
					<select
						aria-label="Select model"
						id="model-select"
						value={selectedModel}
						onChange={(e) => setSelectedModel(e.currentTarget.value)}
						disabled={loading || !selectedGoblin}
					>
						<option value="">(provider default)</option>
						{providerModels.map((m) => (
							<option value={m} key={m}>
								{m}
							</option>
						))}
					</select>
				) : (
					<input
						id="model-input"
						value={selectedModel}
						onChange={(e) => setSelectedModel(e.currentTarget.value)}
						placeholder="(optional) model override"
						disabled={loading || !selectedGoblin}
					/>
				)}
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
				<OrchestrationPreview plan={orchestrationPlan} />
			)}

			{streaming && <StreamingView streamingText={streamingResponse} />}
			{!streaming && response && (
				<div className="response-box">
					<h3>Response:</h3>
					<pre>{response}</pre>
				</div>
			)}

			<CostPanel costSummary={costSummary} />

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
