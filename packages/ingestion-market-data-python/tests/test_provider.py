"""Tests for the market data ingestion package."""

import pytest
from unittest.mock import Mock, patch
from goblinos_ingestion_market_data import create_market_data_provider, MarketDataConfig


class TestMarketDataProvider:
    """Test the market data provider functionality."""

    def test_create_provider(self):
        """Test that we can create a market data provider."""
        config = MarketDataConfig(
            alpha_vantage_key="test_key", finnhub_key="test_key", polygon_key="test_key"
        )
        provider = create_market_data_provider(config)
        assert provider is not None

    @patch("goblinos_ingestion_market_data.provider.requests.get")
    def test_get_quote_alpha_vantage(self, mock_get):
        """Test getting a quote from Alpha Vantage."""
        # Mock successful response
        mock_response = Mock()
        mock_response.json.return_value = {
            "Global Quote": {
                "01. symbol": "AAPL",
                "05. price": "150.00",
                "09. change": "2.50",
                "10. change percent": "1.69%",
            }
        }
        mock_get.return_value = mock_response

        config = MarketDataConfig(
            alpha_vantage_key="test_key", finnhub_key=None, polygon_key=None
        )
        provider = create_market_data_provider(config)

        result = provider.get_quote("AAPL")
        assert result["symbol"] == "AAPL"
        assert result["price"] == 150.00
        assert result["change"] == 2.50

    @patch("goblinos_ingestion_market_data.provider.requests.get")
    def test_get_quotes_batch(self, mock_get):
        """Test getting multiple quotes in batch."""
        # Mock successful response
        mock_response = Mock()
        mock_response.json.return_value = {
            "Global Quote": {"01. symbol": "AAPL", "05. price": "150.00"}
        }
        mock_get.return_value = mock_response

        config = MarketDataConfig(
            alpha_vantage_key="test_key", finnhub_key=None, polygon_key=None
        )
        provider = create_market_data_provider(config)

        result = provider.get_quotes(["AAPL", "MSFT"])
        assert len(result) == 2
        assert result[0]["symbol"] == "AAPL"
