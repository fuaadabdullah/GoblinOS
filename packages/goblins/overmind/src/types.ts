// Types for Overmind LLM routing and memory

export enum LLMProvider {
	OPENAI = "openai",
	DEEPSEEK = "deepseek",
	GEMINI = "gemini",
	OLLAMA = "ollama",
}

export enum RoutingStrategy {
	COST_OPTIMIZED = "cost-optimized",
	LATENCY_OPTIMIZED = "latency-optimized",
	QUALITY_OPTIMIZED = "quality-optimized",
	BALANCED = "balanced",
	LOCAL_FIRST = "local-first",
}

export enum TaskComplexity {
	SIMPLE = "simple",
	MODERATE = "moderate",
	COMPLEX = "complex",
	STRATEGIC = "strategic",
}

export interface ProviderConfig {
	apiKey?: string;
	baseURL?: string;
	defaultModel?: string;
}

export interface RoutingConfig {
	strategy: RoutingStrategy;
	preferLocal: boolean;
	offlineMode: boolean;
	costThresholds: { low: number; medium: number; high: number };
	latencyThresholds: { fast: number; medium: number; slow: number };
	enableFailover: boolean;
}

export interface MemoryConfig {
	enabled: boolean;
	backend: "sqlite" | "postgres" | "redis";
}

export interface CrewConfig {
	maxSize: number;
	agentTimeout: number;
}

export interface ObservabilityConfig {
	logLevel: "debug" | "info" | "warn" | "error";
	logPretty: boolean;
	metricsEnabled: boolean;
}

export interface APIConfig {
	host: string;
	port: number;
}

export interface OvermindConfig {
	providers: Record<string, ProviderConfig>;
	routing: RoutingConfig;
	memory: MemoryConfig;
	crew: CrewConfig;
	observability: ObservabilityConfig;
	api: APIConfig;
}
