"""
Market data provider implementation with caching and fallback logic.
"""

import time
import requests
from typing import Optional, List, Dict, Any
from .types import MarketQuote, MarketDataConfig


class MarketDataService:
    """Market data service with intelligent caching and provider fallback."""

    def __init__(self, config: Optional[MarketDataConfig] = None):
        self.config = config or {}
        self.alpha_vantage_key = self.config.get("alpha_vantage_key") or __import__(
            "os"
        ).getenv("ALPHA_VANTAGE_API_KEY")
        self.finnhub_key = self.config.get("finnhub_key") or __import__("os").getenv(
            "FINNHUB_API_KEY"
        )
        self.polygon_key = self.config.get("polygon_key") or __import__("os").getenv(
            "POLYGON_API_KEY"
        )
        self.cache_ttl = self.config.get("cache_ttl_seconds", 86400)  # 24 hours default
        self._cache: Dict[str, Dict[str, Any]] = {}

    def get_quote(self, symbol: str) -> Optional[MarketQuote]:
        """Get current quote for a symbol with caching."""
        # Check cache first
        cached = self._get_cached_quote(symbol)
        if cached:
            return cached

        # Try providers in order
        quote = None

        # Try Alpha Vantage first
        if self.alpha_vantage_key:
            try:
                quote = self._fetch_from_alpha_vantage(symbol)
            except Exception as e:
                print(f"Alpha Vantage failed for {symbol}: {e}")

        # Fallback to Finnhub
        if not quote and self.finnhub_key:
            try:
                quote = self._fetch_from_finnhub(symbol)
            except Exception as e:
                print(f"Finnhub failed for {symbol}: {e}")

        # Final fallback to Polygon
        if not quote and self.polygon_key:
            try:
                quote = self._fetch_from_polygon(symbol)
            except Exception as e:
                print(f"Polygon failed for {symbol}: {e}")

        # Cache the result
        if quote:
            self._cache_quote(symbol, quote)

        return quote

    def get_quotes(self, symbols: List[str]) -> List[MarketQuote]:
        """Get quotes for multiple symbols."""
        results = []
        for symbol in symbols:
            quote = self.get_quote(symbol)
            if quote:
                results.append(quote)
        return results

    def get_ohlc(
        self, symbol: str, timeframe: str, limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get OHLC data for a symbol and timeframe using Polygon."""
        if not self.polygon_key:
            return []

        # Map timeframe to Polygon parameters
        now = __import__("datetime").datetime.now()
        if timeframe == "1D":
            days_back = 1
            multiplier, timespan = 5, "minute"
        elif timeframe == "1W":
            days_back = 7
            multiplier, timespan = 1, "day"
        elif timeframe == "1M":
            days_back = 30
            multiplier, timespan = 1, "day"
        else:
            return []

        from_date = (now - __import__("datetime").timedelta(days=days_back)).strftime(
            "%Y-%m-%d"
        )
        to_date = now.strftime("%Y-%m-%d")

        url = f"https://api.polygon.io/v2/aggs/ticker/{symbol.upper()}/range/{multiplier}/{timespan}/{from_date}/{to_date}"
        params = {
            "adjusted": "true",
            "sort": "asc",
            "limit": min(limit, 50000),
            "apiKey": self.polygon_key,
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            if data.get("status") == "OK" and data.get("results"):
                return [
                    {
                        "t": r["t"],  # timestamp
                        "o": r["o"],  # open
                        "h": r["h"],  # high
                        "l": r["l"],  # low
                        "c": r["c"],  # close
                        "v": r.get("v", 0),  # volume
                    }
                    for r in data["results"]
                ]
        except Exception as e:
            print(f"Polygon OHLC failed for {symbol}: {e}")

        return []

    def _get_cached_quote(self, symbol: str) -> Optional[MarketQuote]:
        """Get cached quote if still valid."""
        cached = self._cache.get(symbol)
        if cached and time.time() - cached["timestamp"] < self.cache_ttl:
            return cached["data"]
        return None

    def _cache_quote(self, symbol: str, quote: MarketQuote) -> None:
        """Cache a quote."""
        self._cache[symbol] = {"data": quote, "timestamp": time.time()}

    def _fetch_from_alpha_vantage(self, symbol: str) -> MarketQuote:
        """Fetch data from Alpha Vantage API."""
        url = "https://www.alphavantage.co/query"
        params = {
            "function": "GLOBAL_QUOTE",
            "symbol": symbol,
            "apikey": self.alpha_vantage_key,
        }

        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        if "Global Quote" not in data:
            raise ValueError("Invalid response from Alpha Vantage")

        quote = data["Global Quote"]
        return {
            "symbol": symbol,
            "price": float(quote.get("05. price", 0)),
            "change": float(quote.get("09. change", 0)),
            "change_percent": quote.get("10. change percent", "0%"),
            "volume": int(quote.get("06. volume", 0)),
            "timestamp": int(time.time()),
            "source": "alpha_vantage",
        }

    def _fetch_from_finnhub(self, symbol: str) -> MarketQuote:
        """Fetch data from Finnhub API."""
        url = "https://finnhub.io/api/v1/quote"
        params = {"symbol": symbol, "token": self.finnhub_key}

        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        # Validate response has required fields
        required_fields = ["c", "d", "dp", "h", "l", "o", "pc", "t"]
        if not all(field in data for field in required_fields):
            raise ValueError("Invalid response from Finnhub")

        return {
            "symbol": symbol,
            "price": float(data["c"]),  # Current price
            "change": float(data["d"]),  # Change
            "change_percent": f"{float(data['dp']):.2f}%",  # Change percent
            "volume": 0,  # Finnhub doesn't provide volume in quote endpoint
            "timestamp": int(time.time()),
            "source": "finnhub",
        }

    def _fetch_from_polygon(self, symbol: str) -> MarketQuote:
        """Fetch data from Polygon API."""
        url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/prev"
        params = {"apiKey": self.polygon_key}

        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        if data.get("status") != "OK" or not data.get("results"):
            raise ValueError("Invalid response from Polygon")

        result = data["results"][0]
        return {
            "symbol": symbol,
            "price": float(result["c"]),  # Close price
            "change": 0.0,  # Polygon doesn't provide change in prev endpoint
            "change_percent": "0.00%",  # Would need previous close to calculate
            "volume": int(result["v"]),  # Volume
            "timestamp": int(time.time()),
            "source": "polygon",
        }


def create_market_data_provider(
    config: Optional[MarketDataConfig] = None,
) -> MarketDataService:
    """Factory function to create a market data provider."""
    return MarketDataService(config)
