"""
Automation engine core primitives (event bus + orchestration glue).

Phase 1 of the grand plan requires an event-driven automation engine that can:
1. Receive events (triggers, schedules, manual) via an async bus.
2. Bind schedules/triggers to workflows with persisted state.
3. Provide a single `start/stop` lifecycle that boots triggers + scheduler safely.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Awaitable, Callable, Dict, List, Optional

from .state import StateManager
from .triggers import Trigger, TriggerEvent, TriggerManager
from .workflow import Workflow, WorkflowEngine

if TYPE_CHECKING:
    from .scheduler import Scheduler

logger = logging.getLogger(__name__)


@dataclass
class AutomationEvent:
    """Event for the automation system."""

    type: str
    payload: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class ScheduleEvent:
    """Event emitted when a schedule fires."""

    schedule_name: str
    data: Optional[Dict[str, Any]] = None


@dataclass
class Schedule:
    """Represents a time-based schedule for workflow execution."""

    name: str
    cron_expression: str


class AsyncEventBus:
    """
    Asynchronous event bus for decoupling event producers and consumers.

    Features:
    - Pub/sub pattern with async event dispatching
    - Pattern matching for event types (supports wildcards)
    - Error isolation (failed handlers don't stop others)
    - Subscriber management and introspection
    - Dead letter queue for persistently failing events
    """

    def __init__(self, max_queue_size: int = 1000, dead_letter_retries: int = 3):
        self._subscribers: Dict[str, List[Callable[[AutomationEvent], Awaitable[None]]]] = {}
        self._queue: asyncio.Queue[AutomationEvent] = asyncio.Queue(maxsize=max_queue_size)
        self._running = False
        self._dispatcher_task: Optional[asyncio.Task] = None
        self._dead_letter_queue: asyncio.Queue[AutomationEvent] = asyncio.Queue()
        self._dead_letter_retries = dead_letter_retries
        self._event_counts: Dict[str, int] = {}
        self._error_counts: Dict[str, int] = {}

    def subscribe(
        self, event_type: str, handler: Callable[[AutomationEvent], Awaitable[None]]
    ) -> None:
        """Subscribe to a specific event type (use '*' for catch-all, or patterns like 'workflow.*')."""
        handlers = self._subscribers.setdefault(event_type, [])
        if handler not in handlers:
            handlers.append(handler)
        logger.debug("Subscribed handler %s to event '%s'", handler, event_type)

    def unsubscribe(
        self, event_type: str, handler: Callable[[AutomationEvent], Awaitable[None]]
    ) -> bool:
        """Remove a handler from an event type. Returns True if removed."""
        handlers = self._subscribers.get(event_type)
        if handlers and handler in handlers:
            handlers.remove(handler)
            if not handlers:
                del self._subscribers[event_type]
            logger.debug("Unsubscribed handler %s from event '%s'", handler, event_type)
            return True
        return False

    def get_subscribers(
        self, event_type: str
    ) -> List[Callable[[AutomationEvent], Awaitable[None]]]:
        """Get all subscribers for an event type."""
        return self._subscribers.get(event_type, []).copy()

    def list_event_types(self) -> List[str]:
        """List all event types with subscribers."""
        return list(self._subscribers.keys())

    def get_stats(self) -> Dict[str, Any]:
        """Get event bus statistics."""
        return {
            "queue_size": self._queue.qsize(),
            "dead_letter_size": self._dead_letter_queue.qsize(),
            "subscriber_counts": {k: len(v) for k, v in self._subscribers.items()},
            "event_counts": self._event_counts.copy(),
            "error_counts": self._error_counts.copy(),
            "running": self._running,
        }

    async def publish(self, event: AutomationEvent) -> None:
        """Publish an event onto the bus."""
        if not self._running:
            raise RuntimeError("Event bus not running")

        try:
            await asyncio.wait_for(self._queue.put(event), timeout=5.0)
            self._event_counts[event.type] = self._event_counts.get(event.type, 0) + 1
            logger.debug("Queued automation event %s (%s)", event.event_id, event.type)
        except asyncio.TimeoutError:
            logger.warning("Event bus queue full, dropping event %s", event.event_id)
            await self._handle_dead_letter(event)

    async def start(self) -> None:
        """Start event dispatcher."""
        if self._running:
            return

        self._running = True
        self._dispatcher_task = asyncio.create_task(self._dispatch())
        logger.info("Async event bus started")

    async def stop(self) -> None:
        """Stop dispatcher and drain queue."""
        if not self._running:
            return

        self._running = False
        if self._dispatcher_task:
            self._dispatcher_task.cancel()
            try:
                await self._dispatcher_task
            except asyncio.CancelledError:
                pass

        # Drain remaining events to dead letter queue
        while not self._queue.empty():
            try:
                event = self._queue.get_nowait()
                await self._handle_dead_letter(event)
                self._queue.task_done()
            except asyncio.QueueEmpty:
                break

        logger.info("Async event bus stopped")

    async def _dispatch(self) -> None:
        """Dispatch loop that fan-outs events."""
        while self._running:
            try:
                event = await self._queue.get()
                await self._dispatch_event(event)
                self._queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as exc:  # pragma: no cover - logged for observability
                logger.error("Event dispatch failed: %s", exc, exc_info=exc)

    async def _dispatch_event(self, event: AutomationEvent) -> None:
        """Dispatch a single event to matching subscribers."""
        matching_handlers = self._get_matching_handlers(event.type)

        if not matching_handlers:
            logger.debug("No handlers found for event type '%s'", event.type)
            return

        # Dispatch to all matching handlers concurrently
        tasks = []
        for handler in matching_handlers:
            task = asyncio.create_task(self._safe_dispatch(handler, event))
            tasks.append(task)

        # Wait for all handlers to complete (but don't fail if one does)
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Log any errors
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                handler = matching_handlers[i]
                logger.error(
                    "Handler %s failed for event %s: %s",
                    handler,
                    event.event_id,
                    result,
                    exc_info=result,
                )
                self._error_counts[event.type] = self._error_counts.get(event.type, 0) + 1

    async def _safe_dispatch(
        self, handler: Callable[[AutomationEvent], Awaitable[None]], event: AutomationEvent
    ) -> None:
        """Safely dispatch to a handler with timeout and error handling."""
        try:
            # Add timeout to prevent hanging handlers
            await asyncio.wait_for(handler(event), timeout=30.0)
        except asyncio.TimeoutError:
            logger.warning("Handler %s timed out for event %s", handler, event.event_id)
            raise
        except Exception as e:
            logger.error("Handler %s failed for event %s: %s", handler, event.event_id, e)
            raise

    def _get_matching_handlers(
        self, event_type: str
    ) -> List[Callable[[AutomationEvent], Awaitable[None]]]:
        """Get all handlers that match the event type using pattern matching."""
        matching_handlers = []

        # Direct match
        if event_type in self._subscribers:
            matching_handlers.extend(self._subscribers[event_type])

        # Wildcard matches
        for pattern, handlers in self._subscribers.items():
            if self._matches_pattern(event_type, pattern):
                matching_handlers.extend(handlers)

        # Remove duplicates while preserving order
        seen = set()
        unique_handlers = []
        for handler in matching_handlers:
            if handler not in seen:
                seen.add(handler)
                unique_handlers.append(handler)

        return unique_handlers

    def _matches_pattern(self, event_type: str, pattern: str) -> bool:
        """Check if event_type matches a pattern (supports * wildcards)."""
        if pattern == "*":
            return True

        # Simple wildcard matching
        # e.g., "workflow.*" matches "workflow.started", "workflow.completed"
        if "*" in pattern:
            prefix = pattern.split("*")[0]
            return event_type.startswith(prefix)

        return False

    async def _handle_dead_letter(self, event: AutomationEvent) -> None:
        """Handle events that can't be processed (queue full, persistent failures)."""
        logger.warning("Moving event %s to dead letter queue", event.event_id)
        try:
            await self._dead_letter_queue.put(event)
        except asyncio.QueueFull:
            logger.error("Dead letter queue full, dropping event %s", event.event_id)

    async def retry_dead_letters(self) -> int:
        """Retry processing dead letter events. Returns number retried."""
        retried = 0
        while not self._dead_letter_queue.empty() and retried < self._dead_letter_retries:
            try:
                event = self._dead_letter_queue.get_nowait()
                await self.publish(event)
                self._dead_letter_queue.task_done()
                retried += 1
            except asyncio.QueueEmpty:
                break
            except Exception as e:
                logger.error("Failed to retry dead letter event: %s", e)
                break

        return retried


class AutomationEngine:
    """
    Coordinates triggers, schedules, workflows, and state.

    Responsibilities:
    - Manage lifecycle of triggers + scheduler.
    - Bind schedules to workflows and persist execution results.
    - Provide a single event bus for emitting/observing automation events.
    """

    def __init__(
        self,
        *,
        workflow_engine: WorkflowEngine,
        trigger_manager: TriggerManager,
        scheduler: Scheduler,
        state_manager: StateManager,
        event_bus: Optional[AsyncEventBus] = None,
    ):
        self.workflow_engine = workflow_engine
        self.trigger_manager = trigger_manager
        self.scheduler = scheduler
        self.state_manager = state_manager
        self.event_bus = event_bus or AsyncEventBus()

        self._workflows: Dict[str, Workflow] = {}
        self._schedule_bindings: Dict[str, Dict[str, Any]] = {}
        self._running = False

    # ---------------------------------------------------------------------#
    # Lifecycle                                                            #
    # ---------------------------------------------------------------------#

    async def start(self) -> None:
        """Boot event bus, scheduler, and triggers."""
        if self._running:
            return

        await self.state_manager.initialize()
        await self.event_bus.start()
        await self.scheduler.start()
        await self.trigger_manager.start_all()
        self._running = True

        logger.info(
            "Automation engine started (workflows=%s, schedules=%s, triggers=%s)",
            len(self._workflows),
            len(self._schedule_bindings),
            len(self.trigger_manager.triggers),
        )

    async def stop(self) -> None:
        """Gracefully stop all components."""
        if not self._running:
            return

        await self.trigger_manager.stop_all()
        await self.scheduler.stop()
        await self.event_bus.stop()
        self._running = False
        logger.info("Automation engine stopped")

    # ---------------------------------------------------------------------#
    # Workflow Management                                                  #
    # ---------------------------------------------------------------------#

    def register_workflow(self, workflow: Workflow) -> None:
        """Register a workflow in memory."""
        self._workflows[workflow.id] = workflow
        logger.debug("Registered workflow '%s'", workflow.id)

    def unregister_workflow(self, workflow_id: str) -> None:
        """Remove workflow registration."""
        self._workflows.pop(workflow_id, None)

    async def run_workflow(
        self, workflow_id: str, context: Optional[Dict[str, Any]] = None
    ) -> None:
        """Execute a workflow and persist the run."""
        workflow = self._workflows.get(workflow_id)
        if not workflow:
            raise KeyError(f"Workflow '{workflow_id}' is not registered with the automation engine")

        logger.info("Executing workflow '%s' via automation engine", workflow_id)
        result = await self.workflow_engine.execute_workflow(workflow, context or {})
        await self.state_manager.save_workflow_execution(result)

        await self._emit_event(
            "workflow.completed",
            {
                "workflow_id": workflow_id,
                "status": result.status.value,
                "task_count": len(result.task_results),
            },
        )

    # ---------------------------------------------------------------------#
    # Schedule Orchestration                                               #
    # ---------------------------------------------------------------------#

    def schedule_workflow(
        self,
        workflow_id: str,
        schedule: Schedule,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Bind a schedule to a workflow and register scheduler callback."""
        if workflow_id not in self._workflows:
            raise KeyError(f"Workflow '{workflow_id}' must be registered before scheduling")

        self.scheduler.add_schedule(schedule)
        self.scheduler.add_callback(schedule.name, self.handle_schedule_event)
        self._schedule_bindings[schedule.name] = {
            "workflow_id": workflow_id,
            "context": context or {},
            "metadata": metadata or {},
        }

        logger.info(
            "Bound schedule '%s' to workflow '%s' (metadata=%s)",
            schedule.name,
            workflow_id,
            metadata or {},
        )

    async def handle_schedule_event(self, event: ScheduleEvent) -> None:
        """Scheduler callback to execute the bound workflow."""
        binding = self._schedule_bindings.get(event.schedule_name)
        if not binding:
            logger.warning("No workflow binding found for schedule '%s'", event.schedule_name)
            return

        workflow_id = binding["workflow_id"]
        context = binding.get("context", {})

        await self._emit_event(
            "schedule.triggered",
            {"schedule": event.schedule_name, "workflow_id": workflow_id, "data": event.data},
        )
        await self.run_workflow(workflow_id, context)

    # ---------------------------------------------------------------------#
    # Trigger Integration                                                  #
    # ---------------------------------------------------------------------#

    def register_trigger(self, trigger: Trigger) -> None:
        """Register a trigger and forward events to the bus."""

        async def on_trigger(event: TriggerEvent):
            await self._emit_event(
                "trigger.fired",
                {
                    "trigger": trigger.name,
                    "type": event.trigger_type,
                    "data": event.data,
                    "context": event.context,
                },
            )

        trigger.add_callback(on_trigger)
        self.trigger_manager.add_trigger(trigger)

    def bind_trigger_to_workflow(
        self,
        trigger_name: str,
        workflow_id: str,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Bind a trigger to automatically execute a workflow when fired."""
        if workflow_id not in self._workflows:
            raise KeyError(f"Workflow '{workflow_id}' must be registered before binding trigger")

        # Subscribe to trigger events for this specific trigger
        async def on_trigger_fired(event: AutomationEvent):
            if event.payload.get("trigger") == trigger_name and event.type == "trigger.fired":
                await self.run_workflow(workflow_id, context or {})

        self.event_bus.subscribe("trigger.fired", on_trigger_fired)

        logger.info(
            "Bound trigger '%s' to workflow '%s' (metadata=%s)",
            trigger_name,
            workflow_id,
            metadata or {},
        )

    # ---------------------------------------------------------------------#
    # Event Helpers                                                        #
    # ---------------------------------------------------------------------#

    async def emit_manual_event(self, event_type: str, payload: Dict[str, Any]) -> None:
        """Public helper for manual event injection."""
        await self._emit_event(event_type, payload)

    async def _emit_event(self, event_type: str, payload: Dict[str, Any]) -> None:
        event = AutomationEvent(type=event_type, payload=payload)
        await self.event_bus.publish(event)
