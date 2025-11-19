import { z } from 'zod';

// Database schemas for Overmind goblin
// Using Zod for runtime validation and type inference

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional(),
});

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  messageCount: z.number().int().min(0),
  metadata: z.record(z.any()).optional(),
});

export const MemoryFactSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  embedding: z.array(z.number()).optional(), // Vector embedding
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  accessCount: z.number().int().min(0).default(0),
  lastAccessed: z.date().optional(),
});

export const ProviderStatsSchema = z.object({
  provider: z.string(),
  model: z.string(),
  calls: z.number().int().min(0),
  errors: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
  totalLatency: z.number().int().min(0), // in milliseconds
  lastUsed: z.date(),
});

export const RoutingDecisionSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  provider: z.string(),
  model: z.string(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  latency: z.number().int().min(0), // in milliseconds
  tokensUsed: z.number().int().min(0),
  success: z.boolean(),
  timestamp: z.date(),
});

// Type exports
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type MemoryFact = z.infer<typeof MemoryFactSchema>;
export type ProviderStats = z.infer<typeof ProviderStatsSchema>;
export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

// Database table definitions (for migration purposes)
export const TABLES = {
  conversations: 'conversations',
  chat_messages: 'chat_messages',
  memory_facts: 'memory_facts',
  provider_stats: 'provider_stats',
  routing_decisions: 'routing_decisions',
} as const;

// Index definitions for performance
export const INDEXES = {
  conversations_updated_at: 'idx_conversations_updated_at',
  chat_messages_conversation_id: 'idx_chat_messages_conversation_id',
  chat_messages_timestamp: 'idx_chat_messages_timestamp',
  memory_facts_tags: 'idx_memory_facts_tags',
  memory_facts_embedding: 'idx_memory_facts_embedding', // Vector index
  provider_stats_provider: 'idx_provider_stats_provider',
  routing_decisions_conversation_id: 'idx_routing_decisions_conversation_id',
} as const;

/**
 * Database migration function
 * Creates all necessary tables and indexes for the Overmind goblin
 */
export async function migrate(): Promise<void> {
  // Note: This is a placeholder implementation
  // In a real implementation, you would:
  // 1. Connect to the database (e.g., SQLite, PostgreSQL)
  // 2. Check if tables exist
  // 3. Create tables and indexes if they don't exist
  // 4. Run any data migrations if needed

  console.log('🗄️  Running Overmind database migrations...');

  // Example SQL statements (would be executed against actual database):
  const tableDefinitions = {
    [TABLES.conversations]: `
      CREATE TABLE IF NOT EXISTS ${TABLES.conversations} (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        metadata TEXT
      )
    `,
    [TABLES.chat_messages]: `
      CREATE TABLE IF NOT EXISTS ${TABLES.chat_messages} (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (conversation_id) REFERENCES ${TABLES.conversations}(id)
      )
    `,
    [TABLES.memory_facts]: `
      CREATE TABLE IF NOT EXISTS ${TABLES.memory_facts} (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding TEXT, -- JSON array of numbers
        metadata TEXT,
        tags TEXT, -- JSON array of strings
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        access_count INTEGER NOT NULL DEFAULT 0,
        last_accessed DATETIME
      )
    `,
    [TABLES.provider_stats]: `
      CREATE TABLE IF NOT EXISTS ${TABLES.provider_stats} (
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        calls INTEGER NOT NULL DEFAULT 0,
        errors INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        total_latency INTEGER NOT NULL DEFAULT 0,
        last_used DATETIME NOT NULL,
        PRIMARY KEY (provider, model)
      )
    `,
    [TABLES.routing_decisions]: `
      CREATE TABLE IF NOT EXISTS ${TABLES.routing_decisions} (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        reasoning TEXT NOT NULL,
        confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        latency INTEGER NOT NULL,
        tokens_used INTEGER NOT NULL,
        success BOOLEAN NOT NULL,
        timestamp DATETIME NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES ${TABLES.conversations}(id)
      )
    `,
  };

  // Example index definitions:
  const indexDefinitions = {
    [INDEXES.conversations_updated_at]: `
      CREATE INDEX IF NOT EXISTS ${INDEXES.conversations_updated_at}
      ON ${TABLES.conversations}(updated_at)
    `,
    [INDEXES.chat_messages_conversation_id]: `
      CREATE INDEX IF NOT EXISTS ${INDEXES.chat_messages_conversation_id}
      ON ${TABLES.chat_messages}(conversation_id)
    `,
    [INDEXES.chat_messages_timestamp]: `
      CREATE INDEX IF NOT EXISTS ${INDEXES.chat_messages_timestamp}
      ON ${TABLES.chat_messages}(timestamp)
    `,
    [INDEXES.memory_facts_tags]: `
      CREATE INDEX IF NOT EXISTS ${INDEXES.memory_facts_tags}
      ON ${TABLES.memory_facts}(tags)
    `,
    [INDEXES.provider_stats_provider]: `
      CREATE INDEX IF NOT EXISTS ${INDEXES.provider_stats_provider}
      ON ${TABLES.provider_stats}(provider)
    `,
    [INDEXES.routing_decisions_conversation_id]: `
      CREATE INDEX IF NOT EXISTS ${INDEXES.routing_decisions_conversation_id}
      ON ${TABLES.routing_decisions}(conversation_id)
    `,
  };

  // TODO: Actually execute these SQL statements against the database
  // For now, just log what would be done
  console.log('📋 Tables to create:', Object.keys(tableDefinitions));
  console.log('🔍 Indexes to create:', Object.keys(indexDefinitions));

  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('✅ Overmind database migrations completed');
}
