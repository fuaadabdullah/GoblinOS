"""
Example usage of the GoblinOS market data ingestion package.
"""

from . import create_market_data_provider


def main():
    """Example trading agent using the market data provider."""
    # Create market data provider
    market_data = create_market_data_provider()

    # Example symbols
    symbols = ["AAPL", "GOOGL", "MSFT"]

    print("🤖 GoblinOS Trading Agent Demo")
    print("=" * 40)

    # Get quotes for multiple symbols
    quotes = market_data.get_quotes(symbols)

    for quote in quotes:
        print(
            f"📈 {quote['symbol']}: ${quote['price']:.2f} ({quote['change_percent']})"
        )
        print(f"   Source: {quote['source']}")

        # Simple trading logic example
        if quote["change"] > 0:
            print("   💹 Trend: BULLISH - Consider buying!")
        elif quote["change"] < 0:
            print("   📉 Trend: BEARISH - Consider selling!")
        else:
            print("   ➡️  Trend: NEUTRAL - Hold position!")

        print()

    # Get single quote example
    print("🔍 Single Symbol Lookup:")
    aapl_quote = market_data.get_quote("AAPL")
    if aapl_quote:
        print(f"AAPL: ${aapl_quote['price']:.2f} from {aapl_quote['source']}")
    else:
        print("Failed to get AAPL quote")


if __name__ == "__main__":
    main()
