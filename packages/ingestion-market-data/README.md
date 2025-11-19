# @goblinos/ingestion-market-data

Market data ingestion package for GoblinOS. Provides clean, cached access to stock market data from multiple providers.

## Features

- ✅ **Multiple Providers**: Alpha Vantage, Finnhub, Polygon with automatic fallback
- ✅ **Intelligent Caching**: Built-in NodeCache with configurable TTL
- ✅ **Type Safety**: Full TypeScript support with Zod-validated interfaces
- ✅ **Error Handling**: Graceful degradation when APIs are unavailable
- ✅ **Clean Interface**: Simple async API for agent engine consumption

## Installation

```bash
cd GoblinOS/packages/ingestion-market-data
pnpm install
pnpm build
```

## Quick Start

### Basic Usage

```typescript
import { createMarketDataProvider } from '@goblinos/ingestion-market-data';

// Create provider (reads from environment variables)
const marketData = createMarketDataProvider();

// Get a single quote
const quote = await marketData.getQuote('AAPL');
console.log(`${quote.symbol}: $${quote.price} (${quote.changePercent})`);

// Get multiple quotes
const quotes = await marketData.getQuotes(['AAPL', 'MSFT', 'GOOGL']);
quotes.forEach(q => console.log(`${q.symbol}: $${q.price}`));
```

### Configuration

```typescript
const marketData = createMarketDataProvider({
  alphaVantageKey: 'your-alpha-vantage-key',
  finnhubKey: 'your-finnhub-key',
  polygonKey: 'your-polygon-key',
  cacheEnabled: true,
  cacheMaxAgeHours: 24
});
```

## API Reference

### MarketQuote

```typescript
interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: string;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
  lastUpdated: string;
  source: 'alpha_vantage' | 'finnhub' | 'polygon';
  timestamp: number;
}
```

### MarketDataProvider

```typescript
interface MarketDataProvider {
  getQuote(symbol: string): Promise<MarketQuote | null>;
  getQuotes(symbols: string[]): Promise<MarketQuote[]>;
  isCacheStale(symbol: string, maxAgeHours?: number): boolean;
  getCachedQuote(symbol: string): MarketQuote | null;
}
```

## Environment Variables

Set these in your environment or `.env` file:

```bash
ALPHA_VANTAGE_API_KEY=your-key
FINNHUB_API_KEY=your-key
POLYGON_API_KEY=your-key
```

## Provider Priority

1. **Alpha Vantage** - Primary provider (free tier available)
2. **Finnhub** - Fallback provider (free tier available)
3. **Polygon** - Final fallback (requires paid API key)

## Caching

- Default cache TTL: 24 hours
- Cache keys are lowercase symbols
- Cache can be disabled with `cacheEnabled: false`

## Error Handling

- Returns `null` for individual quotes when all providers fail
- Filters out failed quotes in batch requests
- Logs warnings for provider failures (continues to next provider)

## Testing

```bash
pnpm test
pnpm test:coverage
```

## Usage in Agent Engine

This package follows the **Official Package Rule for Data**. Agent engines should only import and use the clean interface:

```typescript
// ✅ GOOD: Agent engine stays clean
import { createMarketDataProvider } from '@goblinos/ingestion-market-data';

export class TradingAgent {
  async analyze(symbol: string) {
    const marketData = createMarketDataProvider();
    const quote = await marketData.getQuote(symbol);

    // Agent reasons about the data
    if (quote.change > 0) {
      return `📈 ${symbol} is up ${quote.changePercent} today`;
    }
  }
}
```

## Part of the GoblinOS Data Ingestion Framework
