// Example: Trading Analysis Agent using the new ingestion package
// This demonstrates the "Official Package Rule for Data" in action

import { createMarketDataProvider, type MarketQuote } from './index.js';

export class TradingAnalysisAgent {
  private marketData = createMarketDataProvider();

  async analyze(symbol: string): Promise<string> {
    // Agent engine only thinks/reasons - data fetching is delegated to ingestion package
    const quote = await this.marketData.getQuote(symbol);

    if (!quote) {
      return `❌ Unable to fetch data for ${symbol}`;
    }

    // Agent reasons about the market data
    const analysis = this.analyzeQuote(quote);
    return analysis;
  }

  private analyzeQuote(quote: MarketQuote): string {
    const { symbol, price, change, changePercent, volume } = quote;

    let sentiment = '🤔';
    let analysis = `${symbol}: $${price.toFixed(2)}`;

    if (change > 0) {
      sentiment = '📈';
      analysis += ` (up ${changePercent})`;
    } else if (change < 0) {
      sentiment = '📉';
      analysis += ` (down ${changePercent})`;
    } else {
      analysis += ` (unchanged)`;
    }

    // Add volume analysis
    if (volume && volume > 1000000) {
      analysis += ` with high volume (${(volume / 1000000).toFixed(1)}M shares)`;
    }

    return `${sentiment} ${analysis}`;
  }

  async compare(symbols: string[]): Promise<string> {
    const quotes = await this.marketData.getQuotes(symbols);

    if (quotes.length === 0) {
      return '❌ Unable to fetch any market data';
    }

    const comparisons = quotes.map((quote: MarketQuote) => {
      const { symbol, changePercent } = quote;
      return `${symbol}: ${changePercent}`;
    });

    return `📊 Market comparison: ${comparisons.join(', ')}`;
  }
}

// Usage example
export async function demo() {
  const agent = new TradingAnalysisAgent();

  console.log(await agent.analyze('AAPL'));
  console.log(await agent.compare(['AAPL', 'MSFT', 'GOOGL']));
}
