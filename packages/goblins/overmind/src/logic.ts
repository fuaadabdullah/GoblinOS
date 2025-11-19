import type {
  ChatRequest,
  ChatResponse,
  MemoryManager,
  RoutingStats,
  ChatMessage,
  MemorySearchResult
} from './types.js';
import { createMemoryManager } from './memory/index.js';
import * as Ollama from './providers/ollama.js';

/**
 * Core business logic for the Overmind goblin
 * This module contains the private implementation details
 */

export class OvermindLogic {
  private memory: MemoryManager;
  private routingStats: Record<string, RoutingStats> = {};

  constructor() {
    this.memory = createMemoryManager();
  }

  /**
   * Process a chat request and generate a response
   */
  async processChat(request: ChatRequest): Promise<ChatResponse> {
    // Store user message
    this.memory.addMessage({
      role: 'user',
      content: request.message,
      timestamp: Date.now()
    });

    // Build context from recent messages
    const recentMessages = this.memory.getRecentMessages(5);
    const context = recentMessages.map(m => `${m.role}: ${m.content}`);

    // Choose provider (basic: ollama)
    const provider = 'ollama';

    try {
      const model = Ollama.selectModel('chat');
      const responseText = await Ollama.generateWithOllama(model, request.message, {
        context,
      });

      // Store assistant message
      this.memory.addMessage({
        role: 'assistant',
        content: responseText,
        timestamp: Date.now()
      });

      this.recordRoute(provider);

      return {
        response: responseText,
        routing: { provider, model },
        metrics: { providerCalls: this.routingStats },
      };
    } catch (error) {
      // Fallback response
      const fallback = '(overmind) unable to fetch model response';
      this.memory.addMessage({
        role: 'assistant',
        content: fallback,
        timestamp: Date.now()
      });

      return {
        response: fallback,
        routing: { provider: 'none', model: 'fallback' },
        metrics: {},
      };
    }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(limit: number = 10): ChatMessage[] {
    return this.memory.getRecentMessages(limit);
  }

  /**
   * Search memory for relevant information
   */
  searchMemory(query: string): Promise<MemorySearchResult[]> {
    return this.memory.search({ query });
  }

  /**
   * Record routing statistics
   */
  private recordRoute(provider: string): void {
    if (!this.routingStats[provider]) {
      this.routingStats[provider] = { count: 0, lastUsed: Date.now() };
    }
    this.routingStats[provider].count++;
    this.routingStats[provider].lastUsed = Date.now();
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): Record<string, RoutingStats> {
    return { ...this.routingStats };
  }
}
