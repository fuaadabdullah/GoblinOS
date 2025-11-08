"""
Workflow Scheduler for Smithy Automation.

This module provides a scheduler for executing workflows triggered by the event
system. It is responsible for managing a queue of jobs, executing them
asynchronously, and handling their state (e.g., pending, running, completed).

For the MVP, this is a simple in-memory scheduler. Future iterations will add
persistence, resource awareness, and advanced scheduling policies (WS1B).

Key Components:
- Job: A workflow to be executed with its parameters.
- Scheduler: The core component that manages and runs jobs.
"""

import asyncio
import uuid
from typing import Any, Callable, Coroutine, Dict, NamedTuple, Optional

from .engine import AsyncEventBus, Schedule, ScheduleEvent


class Job(NamedTuple):
    """Represents a unit of work to be executed by the scheduler."""

    id: str
    name: str
    coro: Coroutine[Any, Any, Any]
    # Future additions: priority, resource_requirements, retry_policy


class Scheduler:
    """Manages the execution of asynchronous jobs."""

    def __init__(self, event_bus: Optional[AsyncEventBus] = None):
        self.event_bus = event_bus
        self._jobs: Dict[str, Job] = {}
        self._queue: asyncio.Queue[Job] = asyncio.Queue()
        self._running = False
        self._callbacks: Dict[str, Callable[[ScheduleEvent], Coroutine[Any, Any, None]]] = {}

    async def start(self):
        """Starts the scheduler's main event processing loop."""
        print("Scheduler started.")
        self._running = True
        self._consumer_task = asyncio.create_task(self._consume_events())
        self._worker_task = asyncio.create_task(self._worker())

    async def stop(self):
        """Stops the scheduler and cancels running jobs."""
        print("Scheduler stopping...")
        self._running = False
        if self._consumer_task:
            self._consumer_task.cancel()
        if self._worker_task:
            self._worker_task.cancel()
        print("Scheduler stopped.")

    async def _consume_events(self):
        """Listens to the event bus for payloads to turn into jobs."""
        if not self.event_bus:
            return

        while self._running:
            try:
                # For now, we'll simulate events. In a real implementation,
                # this would listen to the event bus for schedule events
                await asyncio.sleep(1)  # Placeholder for event listening
            except asyncio.CancelledError:
                break

    async def _worker(self):
        """Pulls jobs from the queue and executes them."""
        while self._running:
            try:
                job = await self._queue.get()
                print(f"Executing job '{job.name}' ({job.id})")
                try:
                    await job.coro
                    print(f"Job '{job.name}' ({job.id}) completed successfully.")
                except Exception as e:
                    print(f"Job '{job.name}' ({job.id}) failed: {e}")
                finally:
                    self._queue.task_done()
                    del self._jobs[job.id]
            except asyncio.CancelledError:
                break

    async def submit_job(self, name: str, coro: Coroutine[Any, Any, Any]) -> Job:
        """Adds a new job to the execution queue."""
        job_id = str(uuid.uuid4())
        job = Job(id=job_id, name=name, coro=coro)
        self._jobs[job.id] = job
        await self._queue.put(job)
        print(f"Job '{name}' ({job_id}) submitted to the queue.")
        return job

    def add_schedule(self, schedule: Schedule) -> None:
        """Add a schedule to be managed by the scheduler."""
        # Placeholder for schedule management
        print(f"Added schedule '{schedule.name}' with cron '{schedule.cron_expression}'")

    def add_callback(
        self, schedule_name: str, callback: Callable[[ScheduleEvent], Coroutine[Any, Any, None]]
    ) -> None:
        """Add a callback for when a schedule fires."""
        self._callbacks[schedule_name] = callback
        print(f"Added callback for schedule '{schedule_name}'")

    async def trigger_schedule(
        self, schedule_name: str, data: Optional[Dict[str, Any]] = None
    ) -> None:
        """Manually trigger a schedule (for testing)."""
        callback = self._callbacks.get(schedule_name)
        if callback:
            event = ScheduleEvent(schedule_name=schedule_name, data=data)
            await callback(event)
            print(f"Triggered schedule '{schedule_name}'")
        else:
            print(f"No callback found for schedule '{schedule_name}'")


# Singleton instance of the scheduler
scheduler = Scheduler()
