import { describe, it, expect, vi } from 'vitest';
import { MarketDataService } from './provider.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('MarketDataService', () => {
  it('should create a provider instance', () => {
    const provider = new MarketDataService();
    expect(provider).toBeInstanceOf(MarketDataService);
  });

  it('should handle cache operations', () => {
    const provider = new MarketDataService({ cacheEnabled: true });

    // Test cache methods exist
    expect(typeof provider.getCachedQuote).toBe('function');
    expect(typeof provider.isCacheStale).toBe('function');
  });

  it('should return null for missing API keys', async () => {
    const provider = new MarketDataService({
      alphaVantageKey: undefined,
      finnhubKey: undefined,
      polygonKey: undefined
    });

    const result = await provider.getQuote('AAPL');
    expect(result).toBeNull();
  });

  // Integration test (requires real API keys)
  it.skip('should fetch real market data', async () => {
    // This test requires actual API keys
    const provider = new MarketDataService();

    const result = await provider.getQuote('AAPL');
    if (result) {
      expect(result.symbol).toBe('AAPL');
      expect(typeof result.price).toBe('number');
      expect(['alpha_vantage', 'finnhub', 'polygon']).toContain(result.source);
    }
  });
});
