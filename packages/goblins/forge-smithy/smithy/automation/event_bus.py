"""
Event Bus for Smithy Automation.
"""

import asyncio

class AsyncEventBus:
    """
    An asynchronous event bus for decoupling components.
    """

    def __init__(self):
        self._subscribers = {}

    async def publish(self, event_type: str, data: any):
        """
        Publish an event to all subscribers.
        """
        if event_type in self._subscribers:
            for queue in self._subscribers[event_type]:
                await queue.put(data)

    def subscribe(self, event_type: str, queue: asyncio.Queue):
        """
        Subscribe to an event type.
        """
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(queue)

    def unsubscribe(self, event_type: str, queue: asyncio.Queue):
        """
        Unsubscribe from an event type.
        """
        if event_type in self._subscribers:
            self._subscribers[event_type].remove(queue)
