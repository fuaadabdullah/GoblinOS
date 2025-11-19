"""
Type definitions for market data ingestion package.
"""

from typing import Optional, TypedDict, List, Dict, Any


class MarketQuote(TypedDict):
    """Market quote data structure."""

    symbol: str
    price: float
    change: float
    change_percent: str
    volume: int
    timestamp: int
    source: str  # 'alpha_vantage' | 'finnhub' | 'polygon'


class MarketDataConfig(TypedDict, total=False):
    """Configuration for market data provider."""

    alpha_vantage_key: Optional[str]
    finnhub_key: Optional[str]
    polygon_key: Optional[str]
    cache_ttl_seconds: int  # Default: 86400 (24 hours)


class MarketDataProvider:
    """Market data provider interface."""

    def get_quote(self, symbol: str) -> Optional[MarketQuote]:
        """Get current quote for a symbol."""
        raise NotImplementedError

    def get_quotes(self, symbols: List[str]) -> List[MarketQuote]:
        """Get current quotes for multiple symbols."""
        raise NotImplementedError

    def get_ohlc(
        self, symbol: str, timeframe: str, limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get OHLC data for a symbol."""
        raise NotImplementedError
