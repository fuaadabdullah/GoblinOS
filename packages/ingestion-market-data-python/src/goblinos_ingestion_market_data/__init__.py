"""
GoblinOS Market Data Ingestion Package

A clean, cached market data ingestion package that fetches stock prices
from Alpha Vantage, Finnhub, and Polygon APIs with intelligent fallback.
"""

from .provider import MarketDataService, create_market_data_provider
from .types import MarketQuote, MarketDataConfig, MarketDataProvider

__version__ = "0.1.0"
__all__ = [
    "MarketDataService",
    "create_market_data_provider",
    "MarketQuote",
    "MarketDataConfig",
    "MarketDataProvider",
]
