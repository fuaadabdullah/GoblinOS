// Market data ingestion package for GoblinOS
// Provides clean interfaces for fetching stock market data

export interface MarketQuote {
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

export interface MarketDataProvider {
  getQuote(symbol: string): Promise<MarketQuote | null>;
  getQuotes(symbols: string[]): Promise<MarketQuote[]>;
  isCacheStale(symbol: string, maxAgeHours?: number): boolean;
  getCachedQuote(symbol: string): MarketQuote | null;
}

export interface MarketDataConfig {
  alphaVantageKey?: string;
  finnhubKey?: string;
  polygonKey?: string;
  cacheEnabled?: boolean;
  cacheMaxAgeHours?: number;
}
