// Lightweight Overmind facade: wires memory, providers, and exposes a simple chat API.

import { config } from "dotenv";
import { createMemoryManager } from "./memory/index.js";
import * as Ollama from "./providers/ollama.js";
import type { MemoryManager } from "./memory/index.js";

// Load environment variables
config();

export type Overmind = {
  chat(message: string): Promise<{ response: string; routing: any; metrics: any }>;
  getConversationHistory(): Array<{ role: string; content: string }>;
  resetConversation(): void;
  getAvailableProviders(): string[];
  getRoutingStats(): Record<string, unknown>;
  rememberFact(fact: string, metadata?: Record<string, unknown>): Promise<string>;
  searchMemory(query: string, limit?: number): Promise<any[]>;
  searchMemoryByVector(query: string, options?: { topK?: number; minScore?: number }): Promise<any[]>;
  getMemoryStats(): Promise<Record<string, unknown>>;
};

function defaultProviders(): string[] {
  const providers: string[] = [];
  // Basic detection: if ollama module is available via env, advertise it
  providers.push("ollama");
  return providers;
}

export function createOvermind(): Overmind {
  const memory: MemoryManager = createMemoryManager();

  // simple routing stats collector
  const routingStats: Record<string, { calls: number }> = {};

  function recordRoute(provider: string) {
    routingStats[provider] = routingStats[provider] || { calls: 0 };
    routingStats[provider].calls++;
  }

  return {
    async chat(message: string) {
      // store user message
      memory.addMessage({ role: "user", content: message });

      // Build simple context from recent messages
      const recent = memory.getRecentMessages(5).map((m) => `${m.role}: ${m.content}`);

      // Choose provider (basic: ollama)
      const provider = "ollama";

      try {
        const model = Ollama.selectModel("chat");
        const responseText = await Ollama.generateWithOllama(model, message, { context: recent });

        // store assistant message
        memory.addMessage({ role: "assistant", content: responseText });

        recordRoute(provider);

        return {
          response: responseText,
          routing: { provider, model },
          metrics: { providerCalls: routingStats },
        };
      } catch (err) {
        // Fallback: return canned response
        const fallback = "(overmind) unable to fetch model response";
        memory.addMessage({ role: "assistant", content: fallback });
        return { response: fallback, routing: { provider: "none" }, metrics: {} };
      }
    },

    getConversationHistory() {
      return memory.getConversationHistory().map((m) => ({ role: m.role, content: m.content }));
    },

    resetConversation() {
      memory.clearConversation();
    },

    getAvailableProviders() {
      return defaultProviders();
    },

    getRoutingStats() {
      return routingStats;
    },

    async rememberFact(fact: string, metadata?: Record<string, unknown>) {
      // metadata currently ignored; store fact and return id
      return memory.storeFact(fact, { tags: metadata?.tags as string[] | undefined });
    },

    async searchMemory(query: string, limit = 10) {
      const results = await memory.search({ query });
      return results.slice(0, limit);
    },

    async searchMemoryByVector(query: string, options?: { topK?: number; minScore?: number }) {
      const results = await memory.searchByVector(query, options);
      return results;
    },

    async getMemoryStats() {
      return memory.getStats();
    },
  } as Overmind;
}

export type { MemoryManager };
