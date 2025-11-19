"""
Tests for the market data ingestion package.
"""

import pytest
from unittest.mock import Mock, patch
from .provider import MarketDataService, create_market_data_provider
from .types import MarketQuote


class TestMarketDataService:
    """Test cases for MarketDataService."""

    def test_initialization(self):
        """Test service initialization."""
        service = MarketDataService()
        assert service.cache_ttl == 86400  # Default 24 hours

    def test_create_provider(self):
        """Test factory function."""
        provider = create_market_data_provider()
        assert isinstance(provider, MarketDataService)

    @patch("requests.get")
    def test_alpha_vantage_success(self, mock_get):
        """Test successful Alpha Vantage API call."""
        # Mock successful response
        mock_response = Mock()
        mock_response.json.return_value = {
            "Global Quote": {
                "01. symbol": "AAPL",
                "05. price": "150.25",
                "09. change": "2.50",
                "10. change percent": "+1.69%",
                "06. volume": "50000000",
            }
        }
        mock_get.return_value = mock_response

        service = MarketDataService({"alpha_vantage_key": "test_key"})
        quote = service.get_quote("AAPL")

        assert quote is not None
        assert quote["symbol"] == "AAPL"
        assert quote["price"] == 150.25
        assert quote["change"] == 2.50
        assert quote["source"] == "alpha_vantage"

    @patch("requests.get")
    def test_finnhub_success(self, mock_get):
        """Test successful Finnhub API call."""
        # Mock successful response
        mock_response = Mock()
        mock_response.json.return_value = {
            "c": 150.25,  # current price
            "d": 2.50,  # change
            "dp": 1.69,  # change percent
            "h": 152.00,  # high
            "l": 148.00,  # low
            "o": 149.00,  # open
            "pc": 147.75,  # previous close
            "t": 1638360000,  # timestamp
        }
        mock_get.return_value = mock_response

        service = MarketDataService({"finnhub_key": "test_key"})
        quote = service.get_quote("AAPL")

        assert quote is not None
        assert quote["symbol"] == "AAPL"
        assert quote["price"] == 150.25
        assert quote["change"] == 2.50
        assert quote["source"] == "finnhub"

    def test_caching(self):
        """Test that caching works correctly."""
        service = MarketDataService()

        # Mock a quote
        test_quote: MarketQuote = {
            "symbol": "TEST",
            "price": 100.0,
            "change": 1.0,
            "change_percent": "+1.00%",
            "volume": 1000,
            "timestamp": 1234567890,
            "source": "test",
        }

        # Manually cache it
        service._cache_quote("TEST", test_quote)

        # Should get from cache
        cached = service._get_cached_quote("TEST")
        assert cached == test_quote

    def test_provider_fallback(self):
        """Test that providers fall back correctly."""
        service = MarketDataService()

        # No API keys configured, should return None
        quote = service.get_quote("AAPL")
        assert quote is None
