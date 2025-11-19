"""
Event Triggers for Smithy Automation Workflows.

This module defines the trigger system that initiates automation workflows. Triggers
can be time-based (cron), event-based (webhooks, Git events), or manual. Each
trigger is responsible for listening to an event source and dispatching a
standardized payload to the central event engine.

Key Components:
- Trigger: Abstract base class for all trigger implementations.
- WebhookTrigger: Listens for incoming HTTP requests.
- CronTrigger: Executes workflows on a predefined schedule.
- FilesystemTrigger: Watches for file/directory changes.
- GitTrigger: Responds to Git events like commits or merges.
"""
import abc
import asyncio
from typing import Any, Callable, Dict, Optional



class TriggerEvent:
    """Event emitted by a trigger."""

    def __init__(self, trigger_type: str, data: Dict[str, Any], context: Optional[Dict[str, Any]] = None):
        self.trigger_type = trigger_type
        self.data = data
        self.context = context or {}


class Trigger(abc.ABC):
    """Abstract base class for an event trigger."""

    def __init__(self, name: str, config: Dict[str, Any]):
        self.name = name
        self.config = config
        self._callbacks: list[Callable[[TriggerEvent], Any]] = []

    def add_callback(self, callback: Callable[[TriggerEvent], Any]) -> None:
        """Add a callback to be called when the trigger fires."""
        self._callbacks.append(callback)

    async def _fire_event(self, event: TriggerEvent) -> None:
        """Fire the event to all registered callbacks."""
        for callback in self._callbacks:
            try:
                await callback(event)
            except Exception as e:
                print(f"Error in trigger callback: {e}")

    @abc.abstractmethod
    async def start(self):
        """Starts the trigger to listen for events."""
        raise NotImplementedError

    @abc.abstractmethod
    async def stop(self):
        """Stops the trigger."""
        raise NotImplementedError


class WebhookTrigger(Trigger):
    """A trigger activated by an HTTP webhook."""

    async def start(self):
        """
        Starts a web server to listen for incoming webhooks.
        (Implementation deferred to web framework integration, e.g., FastAPI)
        """
        print(f"WebhookTrigger '{self.name}' started. Endpoint: {self.config.get('path')}")
        # In a real implementation, this would integrate with a web server.
        # For now, simulate webhook events
        while True:
            await asyncio.sleep(10)  # Check every 10 seconds
            # Simulate receiving a webhook
            event = TriggerEvent(
                trigger_type="webhook",
                data={"method": "POST", "path": self.config.get('path'), "body": {"test": True}},
                context={"source": "simulated"}
            )
            await self._fire_event(event)

    async def stop(self):
        print(f"WebhookTrigger '{self.name}' stopped.")
        # In real implementation, stop the web server


class CronTrigger(Trigger):
    """A trigger activated by a cron-style schedule."""

    async def start(self):
        """Starts a scheduler to run jobs at the specified interval."""
        print(f"CronTrigger '{self.name}' started. Schedule: {self.config.get('cron_string')}")
        # In a real implementation, this would use a library like croniter or apscheduler.
        # For now, simulate cron events every 30 seconds
        while True:
            await asyncio.sleep(30)
            event = TriggerEvent(
                trigger_type="cron",
                data={"schedule": self.config.get('cron_string'), "timestamp": asyncio.get_event_loop().time()},
                context={"source": "simulated"}
            )
            await self._fire_event(event)

    async def stop(self):
        print(f"CronTrigger '{self.name}' stopped.")


class FilesystemTrigger(Trigger):
    """A trigger activated by filesystem events."""

    async def start(self):
        """Starts watching a directory for changes."""
        print(f"FilesystemTrigger '{self.name}' started. Path: {self.config.get('path')}")
        # In a real implementation, this would use a library like watchfiles.
        # For now, simulate filesystem events every 60 seconds
        while True:
            await asyncio.sleep(60)
            event = TriggerEvent(
                trigger_type="filesystem",
                data={"path": self.config.get('path'), "event": "modified", "file": "example.txt"},
                context={"source": "simulated"}
            )
            await self._fire_event(event)

    async def stop(self):
        print(f"FilesystemTrigger '{self.name}' stopped.")


class GitTrigger(Trigger):
    """A trigger activated by Git repository events."""

    async def start(self):
        """Starts polling a Git repository for changes."""
        print(f"GitTrigger '{self.name}' started. Repo: {self.config.get('repo_path')}")
        # In a real implementation, this could use polling or webhook integration from a Git server.
        # For now, simulate git events every 120 seconds
        while True:
            await asyncio.sleep(120)
            event = TriggerEvent(
                trigger_type="git",
                data={"repo": self.config.get('repo_path'), "event": "push", "branch": "main"},
                context={"source": "simulated"}
            )
            await self._fire_event(event)

    async def stop(self):
        print(f"GitTrigger '{self.name}' stopped.")


class TriggerManager:
    """Manages the lifecycle of all registered triggers."""

    def __init__(self):
        self.triggers: Dict[str, Trigger] = {}

    def add_trigger(self, trigger: Trigger) -> None:
        """Add a trigger to the manager."""
        self.triggers[trigger.name] = trigger
        print(f"Added trigger '{trigger.name}'")

    async def start_all(self):
        """Starts all registered triggers."""
        print("Starting all triggers...")
        tasks = []
        for trigger in self.triggers.values():
            task = asyncio.create_task(trigger.start())
            tasks.append(task)
        await asyncio.gather(*tasks, return_exceptions=True)

    async def stop_all(self):
        """Stops all registered triggers."""
        print("Stopping all triggers...")
        tasks = []
        for trigger in self.triggers.values():
            task = asyncio.create_task(trigger.stop())
            tasks.append(task)
        await asyncio.gather(*tasks, return_exceptions=True)


def create_trigger_manager(trigger_configs: Dict[str, Any]) -> TriggerManager:
    """Factory function to create a TriggerManager from a configuration dict."""
    manager = TriggerManager()
    for name, config in trigger_configs.items():
        trigger_type = config.get("type")

        if trigger_type == "webhook":
            manager.add_trigger(WebhookTrigger(name, config))
        elif trigger_type == "cron":
            manager.add_trigger(CronTrigger(name, config))
        elif trigger_type == "filesystem":
            manager.add_trigger(FilesystemTrigger(name, config))
        elif trigger_type == "git":
            manager.add_trigger(GitTrigger(name, config))
        else:
            print(f"Warning: Unknown trigger type '{trigger_type}' for trigger '{name}'.")

    return manager