// Overmind Goblin: Implements the GoblinInterface for LLM routing and memory management

import { config } from "dotenv";
import type { ChatRequest, OvermindGoblinConfig } from './types.js';
import { OvermindLogic } from './logic.js';

// Temporary local interfaces until @goblinos/shared is available
interface GoblinContext {
  input: ChatRequest;
}

interface GoblinResult {
  success: boolean;
  output?: any;
  error?: string;
  metadata?: Record<string, any>;
}

interface GoblinCapabilities {
  name: string;
  description: string;
  version: string;
  inputs: string[];
  outputs: string[];
}

// Load environment variables
config();

export class OvermindGoblin {
  private logic: OvermindLogic;

  constructor(_config: OvermindGoblinConfig) {
    this.logic = new OvermindLogic();
  }

  async initialize(): Promise<void> {
    // Initialize memory and providers
    // This could load configuration, set up connections, etc.
  }

  async execute(context: GoblinContext): Promise<GoblinResult> {
    const overmindContext = context as { input: ChatRequest };

    try {
      const response = await this.logic.processChat(overmindContext.input);

      return {
        success: true,
        output: response,
        metadata: {
          routing: response.routing,
          metrics: response.metrics,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {},
      };
    }
  }

  async shutdown(): Promise<void> {
    // Clean up resources
    // This could close connections, save state, etc.
  }

  getCapabilities(): GoblinCapabilities {
    return {
      name: 'overmind',
      description: 'LLM routing and memory management goblin',
      version: '1.0.0',
      inputs: ['ChatRequest'],
      outputs: ['ChatResponse'],
    };
  }
};
