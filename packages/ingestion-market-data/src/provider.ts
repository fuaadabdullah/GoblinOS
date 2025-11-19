import NodeCache from 'node-cache';
import type { MarketQuote, MarketDataProvider, MarketDataConfig } from './types.js';

export class MarketDataService implements MarketDataProvider {
  private alphaVantageKey?: string;
  private finnhubKey?: string;
  private polygonKey?: string;
  private cache?: NodeCache;
  private cacheMaxAgeHours: number;

  constructor(config: MarketDataConfig = {}) {
    this.alphaVantageKey = config.alphaVantageKey || process.env.ALPHA_VANTAGE_API_KEY;
    this.finnhubKey = config.finnhubKey || process.env.FINNHUB_API_KEY;
    this.polygonKey = config.polygonKey || process.env.POLYGON_API_KEY;
    this.cacheMaxAgeHours = config.cacheMaxAgeHours || 24;

    if (config.cacheEnabled !== false) {
      // Cache for 24 hours by default
      this.cache = new NodeCache({ stdTTL: this.cacheMaxAgeHours * 3600 });
    }
  }

  async getQuote(symbol: string): Promise<MarketQuote | null> {
    // Check cache first
    if (this.cache) {
      const cached = this.cache.get<MarketQuote>(symbol.toLowerCase());
      if (cached && !this.isCacheStale(symbol)) {
        return cached;
      }
    }

    // Try providers in order
    let quote: MarketQuote | null = null;

    // Try Alpha Vantage first
    if (this.alphaVantageKey) {
      try {
        quote = await this.fetchFromAlphaVantage(symbol);
      } catch (error) {
        console.warn(`Alpha Vantage failed for ${symbol}:`, error);
      }
    }

    // Fallback to Finnhub
    if (!quote && this.finnhubKey) {
      try {
        quote = await this.fetchFromFinnhub(symbol);
      } catch (error) {
        console.warn(`Finnhub failed for ${symbol}:`, error);
      }
    }

    // Final fallback to Polygon
    if (!quote && this.polygonKey) {
      try {
        quote = await this.fetchFromPolygon(symbol);
      } catch (error) {
        console.warn(`Polygon failed for ${symbol}:`, error);
      }
    }

    // Cache the result
    if (quote && this.cache) {
      this.cache.set(symbol.toLowerCase(), quote);
    }

    return quote;
  }

  async getQuotes(symbols: string[]): Promise<MarketQuote[]> {
    const quotes: MarketQuote[] = [];

    // Fetch in parallel for better performance
    const promises = symbols.map(symbol => this.getQuote(symbol));
    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        quotes.push(result.value);
      }
    }

    return quotes;
  }

  getCachedQuote(symbol: string): MarketQuote | null {
    if (!this.cache) return null;
    return this.cache.get<MarketQuote>(symbol.toLowerCase()) || null;
  }

  isCacheStale(symbol: string, maxAgeHours?: number): boolean {
    const maxAge = maxAgeHours || this.cacheMaxAgeHours;
    const cached = this.getCachedQuote(symbol);

    if (!cached) return true;

    const ageSeconds = (Date.now() / 1000) - cached.timestamp;
    return ageSeconds > (maxAge * 3600);
  }

  private async fetchFromAlphaVantage(symbol: string): Promise<MarketQuote> {
    const url = 'https://www.alphavantage.co/query';
    const params = new URLSearchParams({
      function: 'GLOBAL_QUOTE',
      symbol: symbol.toUpperCase(),
      apikey: this.alphaVantageKey!
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${url}?${params}`, {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }

      const data: any = await response.json();

      if (!data['Global Quote']) {
        throw new Error('Invalid response from Alpha Vantage');
      }

      const quote = data['Global Quote'];
      return {
        symbol: symbol.toUpperCase(),
        price: parseFloat(quote['05. price'] || '0'),
        change: parseFloat(quote['09. change'] || '0'),
        changePercent: quote['10. change percent'] || '0%',
        volume: parseInt(quote['06. volume'] || '0'),
        lastUpdated: quote['07. latest trading day'] || '',
        source: 'alpha_vantage',
        timestamp: Math.floor(Date.now() / 1000)
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async fetchFromFinnhub(symbol: string): Promise<MarketQuote> {
    const url = 'https://finnhub.io/api/v1/quote';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      token: this.finnhubKey!
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${url}?${params}`, {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status}`);
      }

      const data: any = await response.json();

      // Validate required fields
      if (typeof data.c !== 'number' || typeof data.d !== 'number') {
        throw new Error('Invalid response from Finnhub');
      }

      return {
        symbol: symbol.toUpperCase(),
        price: data.c,
        change: data.d,
        changePercent: `${data.dp?.toFixed(2) || 0}%`,
        high: data.h,
        low: data.l,
        open: data.o,
        previousClose: data.pc,
        lastUpdated: new Date(data.t * 1000).toISOString().split('T')[0],
        source: 'finnhub',
        timestamp: Math.floor(Date.now() / 1000)
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async fetchFromPolygon(symbol: string): Promise<MarketQuote> {
    const url = `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/prev`;
    const params = new URLSearchParams({
      apiKey: this.polygonKey!
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${url}?${params}`, {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Polygon API error: ${response.status}`);
      }

      const data: any = await response.json();

      if (data.status !== 'OK' || !data.results?.[0]) {
        throw new Error('Invalid response from Polygon');
      }

      const result = data.results[0];
      const change = result.c - result.o;
      const changePercent = result.o !== 0 ? ((change / result.o) * 100).toFixed(2) : '0';

      return {
        symbol: symbol.toUpperCase(),
        price: result.c,
        open: result.o,
        high: result.h,
        low: result.l,
        volume: result.v,
        change,
        changePercent: `${changePercent}%`,
        lastUpdated: new Date(result.t).toISOString().split('T')[0],
        source: 'polygon',
        timestamp: Math.floor(Date.now() / 1000)
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
