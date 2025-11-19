// @goblinos/ingestion-market-data
// Clean market data ingestion for GoblinOS agent engine

export type { MarketQuote, MarketDataProvider, MarketDataConfig } from './types.js';
export { MarketDataService } from './provider.js';

// Factory function for easy instantiation
import { MarketDataService } from './provider.js';
import type { MarketDataConfig } from './types.js';

export function createMarketDataProvider(config?: MarketDataConfig) {
  return new MarketDataService(config);
}

// Example usage
export { TradingAnalysisAgent, demo } from './example.js';

// Default export for convenience
export default MarketDataService;
