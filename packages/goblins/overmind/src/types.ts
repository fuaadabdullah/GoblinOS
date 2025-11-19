// Local type definitions until @goblinos/shared is available
export interface GoblinConfig {
  [key: string]: any;
}

export interface GoblinContext {
  input: ChatRequest;
}

export interface GoblinResult {
  success: boolean;
  output?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface GoblinCapabilities {
  name: string;
  description: string;
  version: string;
  inputs: string[];
  outputs: string[];
}

import type { MemoryImportance } from './memory/types.js';

// Legacy types for Overmind LLM routing and memory
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

// New Goblin Interface Types
export interface OvermindGoblinConfig extends GoblinConfig {
  providers?: {
    ollama?: {
      enabled: boolean;
      endpoint?: string;
      defaultModel?: string;
      timeout?: number;
    };
    openai?: {
      enabled: boolean;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
  };
  memory?: {
    type: 'sqlite' | 'postgres' | 'memory';
    maxMessages?: number;
    vectorSearch?: {
      enabled: boolean;
      dimensions?: number;
    };
  };
  routing?: {
    defaultProvider?: string;
    fallbackEnabled?: boolean;
    metricsEnabled?: boolean;
  };
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    structured?: boolean;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface ChatRequest {
  message: string;
  context?: ChatMessage[];
  metadata?: Record<string, any>;
}

export interface ChatResponse {
  response: string;
  routing: {
    provider: string;
    model: string;
  };
  metrics: Record<string, any>;
  conversationId?: string;
}

export interface MemoryFact {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  tags?: string[];
}

export interface MemorySearchResult {
  entry: { id: string; content: string; importance: MemoryImportance };
}

export interface OvermindGoblinContext extends GoblinContext {
  input: ChatRequest;
}

export interface OvermindGoblinResult extends GoblinResult {
  output?: ChatResponse;
}

export interface MemoryManager {
  // Message methods (short-term memory)
  addMessage(message: ChatMessage): void;
  getRecentMessages(
    count?: number,
    role?: "user" | "assistant" | "system",
  ): ChatMessage[];
  getConversationHistory(): ChatMessage[];
  clearConversation(): void;

  // Context methods (working memory)
  setContext(key: string, value: unknown, importance?: MemoryImportance): void;
  getContext(key: string): unknown;
  hasContext(key: string): boolean;
  deleteContext(key: string): boolean;
  clearWorkingMemory(): void;

  // Long-term memory methods (facts)
  storeFact(
    content: string,
    options?: { tags?: string[]; importance?: MemoryImportance },
  ): Promise<string>;
  search(options: {
    query?: string;
    importance?: MemoryImportance;
    tags?: string[];
  }): Promise<
    Array<{
      entry: { id: string; content: string; importance: MemoryImportance };
    }>
  >;
  searchByVector(
    query: string,
    options?: {
      topK?: number;
      minScore?: number;
    },
  ): Promise<
    Array<{
      entry: { id: string; content: string; importance: MemoryImportance };
    }>
  >;
}

export interface ProviderCapabilities {
  name: string;
  supportsStreaming: boolean;
  supportsEmbeddings: boolean;
  maxTokens: number;
  models: string[];
}

export interface RoutingStats {
  count: number;
  lastUsed: number;
}
