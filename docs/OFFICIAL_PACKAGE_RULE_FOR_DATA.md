# Official Package Rule for Data

## Rule: Data Ingestion Gets Its Own Package

**Any new data source gets its own package under `packages/ingestion-*`.**

### Why This Rule?

- **Keep Agent Engine Clean**: The "agent engine" (overmind, brains) should only think/reason, not fetch data
- **Easy to Swap Data Sources**: Want to change from Alpha Vantage to Yahoo Finance? Just swap the ingestion package
- **Testable Isolation**: Each data source can be tested independently
- **Future-Proof**: New data sources don't clutter the core agent logic

### Package Naming Convention

```
packages/ingestion-{data-source}
```

Examples:

- `packages/ingestion-market-data` - Stock prices, crypto, forex
- `packages/ingestion-files` - Local markdown, documents, code files
- `packages/ingestion-web` - Web scraping, RSS feeds, APIs
- `packages/ingestion-database` - SQL/NoSQL database queries
- `packages/ingestion-obsidian` - Obsidian vault integration

### Package Structure

Each ingestion package should:

1. **Export a clean interface** that agents can use
2. **Handle authentication** (API keys, credentials)
3. **Implement caching** where appropriate
4. **Provide error handling** and fallbacks
5. **Include tests** for reliability

### Example Interface

```typescript
// packages/ingestion-market-data/src/index.ts

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  volume: number;
  timestamp: Date;
}

export interface MarketDataProvider {
  getQuote(symbol: string): Promise<MarketData>;
  getQuotes(symbols: string[]): Promise<MarketData[]>;
  searchSymbols(query: string): Promise<string[]>;
}

export function createMarketDataProvider(): MarketDataProvider {
  // Implementation here
}
```

### Usage in Agent Engine

```typescript
// In overmind or brains - CLEAN agent logic only
import { createMarketDataProvider } from '@goblinos/ingestion-market-data';

const marketData = createMarketDataProvider();
const quote = await marketData.getQuote('AAPL');
// Agent reasons about the data, doesn't fetch it
```

### Migration Examples

**Before (❌ tight coupling):**

```typescript
// Inside overmind package
async function getStockPrice(symbol: string) {
  const response = await fetch(`https://api.example.com/stocks/${symbol}`);
  return response.json();
}
```

**After (✅ loose coupling):**

```typescript
// In packages/ingestion-market-data
export async function getStockPrice(symbol: string) { /* ... */ }

// In overmind
import { getStockPrice } from '@goblinos/ingestion-market-data';
const price = await getStockPrice('AAPL');
```

### Existing Packages

- `packages/ingestion-market-data` - Alpha Vantage, Finnhub integration
- `packages/ingestion-files` - Local file system access (planned)
- `packages/ingestion-obsidian` - Obsidian vault integration (planned)

### When to Create a New Package

- **New external API**: `packages/ingestion-twitter`, `packages/ingestion-github`
- **New file format**: `packages/ingestion-pdf`, `packages/ingestion-csv`
- **New data protocol**: `packages/ingestion-graphql`, `packages/ingestion-websocket`
- **New storage system**: `packages/ingestion-redis`, `packages/ingestion-s3`

### Testing Strategy

Each ingestion package should:

- Mock external dependencies
- Test error conditions (API down, rate limits)
- Test caching behavior
- Include integration tests with real APIs (optional, with API keys)

---

**Last Updated**: November 13, 2025
