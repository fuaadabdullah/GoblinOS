"""
Tests for the Smithy Automation package.
"""

import asyncio
import pytest

from smithy.automation.event_bus import AsyncEventBus

@pytest.mark.asyncio
async def test_event_bus_publish_subscribe():
    """
    Test that a subscriber receives an event.
    """
    bus = AsyncEventBus()
    queue = asyncio.Queue()
    bus.subscribe("test_event", queue)

    await bus.publish("test_event", "test_data")

    data = await queue.get()
    assert data == "test_data"
