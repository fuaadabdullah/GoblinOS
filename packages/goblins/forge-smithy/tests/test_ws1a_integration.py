"""Integration tests for WS1A: AsyncEventBus + TriggerManager functionality."""

import asyncio

import pytest

from smithy.automation.engine import AsyncEventBus, AutomationEngine, AutomationEvent
from smithy.automation.triggers import (
    CronTrigger,
    FilesystemTrigger,
    TriggerEvent,
    TriggerManager,
    WebhookTrigger,
)
from smithy.automation.workflow import Task, Workflow, WorkflowEngine


class TestWS1AIntegration:
    """Integration tests demonstrating WS1A (AsyncEventBus + TriggerManager) functionality."""

    @pytest.fixture
    async def event_bus(self):
        """Create and start an event bus for testing."""
        bus = AsyncEventBus(max_queue_size=100)
        await bus.start()
        yield bus
        await bus.stop()

    @pytest.fixture
    def workflow_engine(self):
        """Create a workflow engine for testing."""
        return WorkflowEngine()

    @pytest.fixture
    def trigger_manager(self):
        """Create a trigger manager for testing."""
        return TriggerManager()

    @pytest.fixture
    def scheduler(self):
        """Create a scheduler for testing."""
        from smithy.automation.scheduler import Scheduler

        return Scheduler()

    @pytest.fixture
    async def state_manager(self):
        """Create a state manager for testing."""
        from smithy.automation.state import SQLiteBackend, StateManager

        backend = SQLiteBackend(":memory:")
        manager = StateManager(backend)
        await manager.initialize()
        return manager

    @pytest.fixture
    async def automation_engine(
        self, workflow_engine, trigger_manager, scheduler, state_manager, event_bus
    ):
        """Create a fully configured automation engine."""
        engine = AutomationEngine(
            workflow_engine=workflow_engine,
            trigger_manager=trigger_manager,
            scheduler=scheduler,
            state_manager=state_manager,
            event_bus=event_bus,
        )
        await engine.start()
        yield engine
        await engine.stop()

    async def test_event_bus_pub_sub(self, event_bus):
        """Test basic publish-subscribe functionality of AsyncEventBus."""
        received_events = []

        async def handler(event: AutomationEvent):
            received_events.append(event)

        # Subscribe to events
        event_bus.subscribe("test.event", handler)
        event_bus.subscribe("test.*", handler)  # Wildcard subscription

        # Publish events
        await event_bus.publish(AutomationEvent(type="test.event", payload={"data": "test1"}))
        await event_bus.publish(AutomationEvent(type="test.other", payload={"data": "test2"}))

        # Wait for processing
        await asyncio.sleep(0.1)

        # Verify events were received
        assert (
            len(received_events) == 3
        )  # test.event matches both subscriptions, test.other matches wildcard
        assert received_events[0].payload["data"] == "test1"
        assert received_events[1].payload["data"] == "test1"  # Wildcard match
        assert received_events[2].payload["data"] == "test2"

    async def test_trigger_registration_and_events(self, automation_engine):
        """Test trigger registration and event emission."""
        events_received = []

        async def event_handler(event: AutomationEvent):
            events_received.append(event)

        # Subscribe to trigger events
        automation_engine.event_bus.subscribe("trigger.fired", event_handler)

        # Create and register a webhook trigger
        trigger = WebhookTrigger("test_webhook", {"path": "/test"})
        automation_engine.register_trigger(trigger)

        # Manually fire the trigger (simulating webhook receipt)
        test_event = TriggerEvent(
            trigger_type="webhook",
            data={"method": "POST", "path": "/test", "body": {"test": True}},
            context={"source": "test"},
        )
        await trigger._fire_event(test_event)

        # Wait for processing
        await asyncio.sleep(0.1)

        # Verify trigger event was emitted
        assert len(events_received) == 1
        assert events_received[0].type == "trigger.fired"
        assert events_received[0].payload["trigger"] == "test_webhook"
        assert events_received[0].payload["type"] == "webhook"

    async def test_trigger_to_workflow_binding(self, automation_engine):
        """Test binding triggers to workflow execution."""

        # Create a simple workflow
        async def success_task():
            return {"result": "success"}

        task = Task(id="test_task", name="Test Task", action=success_task)
        workflow = Workflow(id="test_workflow", name="Test Workflow", tasks={"test_task": task})
        automation_engine.register_workflow(workflow)

        # Create and register a trigger
        trigger = CronTrigger("test_cron", {"cron_string": "* * * * *"})
        automation_engine.register_trigger(trigger)

        # Bind trigger to workflow
        automation_engine.bind_trigger_to_workflow("test_cron", "test_workflow")

        # Track workflow executions
        executions_before = len(await automation_engine.state_manager.get_recent_executions())

        # Fire the trigger
        test_event = TriggerEvent(
            trigger_type="cron",
            data={"schedule": "* * * * *", "timestamp": asyncio.get_event_loop().time()},
            context={"source": "test"},
        )
        await trigger._fire_event(test_event)

        # Wait for workflow execution
        await asyncio.sleep(0.2)

        # Verify workflow was executed
        executions_after = len(await automation_engine.state_manager.get_recent_executions())
        assert executions_after > executions_before

    async def test_multiple_triggers_different_types(self, automation_engine):
        """Test multiple triggers of different types working together."""
        events_received = []

        async def event_handler(event: AutomationEvent):
            events_received.append(event)

        automation_engine.event_bus.subscribe("trigger.fired", event_handler)

        # Create different types of triggers
        webhook_trigger = WebhookTrigger("webhook_trigger", {"path": "/api/webhook"})
        cron_trigger = CronTrigger("cron_trigger", {"cron_string": "0 * * * *"})
        fs_trigger = FilesystemTrigger("fs_trigger", {"path": "/tmp/watch"})

        # Register all triggers
        automation_engine.register_trigger(webhook_trigger)
        automation_engine.register_trigger(cron_trigger)
        automation_engine.register_trigger(fs_trigger)

        # Fire events from each trigger
        webhook_event = TriggerEvent(
            "webhook", {"method": "POST", "path": "/api/webhook"}, {"source": "api"}
        )
        cron_event = TriggerEvent("cron", {"timestamp": 1234567890}, {"source": "scheduler"})
        fs_event = TriggerEvent(
            "filesystem", {"path": "/tmp/watch", "event": "modified"}, {"source": "watcher"}
        )

        await webhook_trigger._fire_event(webhook_event)
        await cron_trigger._fire_event(cron_event)
        await fs_trigger._fire_event(fs_event)

        # Wait for processing
        await asyncio.sleep(0.1)

        # Verify all events were received
        assert len(events_received) == 3
        trigger_names = {event.payload["trigger"] for event in events_received}
        assert trigger_names == {"webhook_trigger", "cron_trigger", "fs_trigger"}

    async def test_event_bus_error_handling(self, event_bus):
        """Test that event bus handles handler errors gracefully."""
        error_count = 0
        success_count = 0

        async def failing_handler(event: AutomationEvent):
            nonlocal error_count
            error_count += 1
            raise Exception("Handler failed")

        async def working_handler(event: AutomationEvent):
            nonlocal success_count
            success_count += 1

        # Subscribe both handlers
        event_bus.subscribe("test.error", failing_handler)
        event_bus.subscribe("test.error", working_handler)

        # Publish event
        await event_bus.publish(AutomationEvent(type="test.error", payload={}))

        # Wait for processing
        await asyncio.sleep(0.1)

        # Verify working handler still executed despite failing handler
        assert error_count == 1
        assert success_count == 1

        # Check error stats
        stats = event_bus.get_stats()
        assert stats["error_counts"]["test.error"] == 1

    async def test_event_bus_pattern_matching(self, event_bus):
        """Test event bus pattern matching with wildcards."""
        received_events = []

        async def handler(event: AutomationEvent):
            received_events.append(event)

        # Subscribe with patterns
        event_bus.subscribe(
            "workflow.*", handler
        )  # Matches workflow.started, workflow.completed, etc.
        event_bus.subscribe("*.error", handler)  # Matches any.error
        event_bus.subscribe("exact.match", handler)  # Exact match only

        # Publish various events
        await event_bus.publish(AutomationEvent(type="workflow.started", payload={}))
        await event_bus.publish(AutomationEvent(type="workflow.completed", payload={}))
        await event_bus.publish(AutomationEvent(type="api.error", payload={}))
        await event_bus.publish(AutomationEvent(type="exact.match", payload={}))
        await event_bus.publish(AutomationEvent(type="no.match", payload={}))

        # Wait for processing
        await asyncio.sleep(0.1)

        # Verify pattern matching worked
        event_types = {event.type for event in received_events}
        expected_types = {"workflow.started", "workflow.completed", "api.error", "exact.match"}
        assert event_types == expected_types
        assert len(received_events) == 4  # no.match should not be received

    async def test_trigger_manager_lifecycle(self, trigger_manager):
        """Test trigger manager start/stop lifecycle."""
        # Add some triggers
        trigger1 = WebhookTrigger("trigger1", {"path": "/test1"})
        trigger2 = CronTrigger("trigger2", {"cron_string": "* * * * *"})

        trigger_manager.add_trigger(trigger1)
        trigger_manager.add_trigger(trigger2)

        # Verify triggers are registered
        assert len(trigger_manager.triggers) == 2
        assert "trigger1" in trigger_manager.triggers
        assert "trigger2" in trigger_manager.triggers

        # Note: In a real test, we'd start/stop the triggers, but since they run indefinitely,
        # we'll just verify the manager can handle the lifecycle methods
        # This would require mocking asyncio.create_task or using a timeout

    async def test_workflow_execution_via_triggers(self, automation_engine):
        """End-to-end test: trigger -> event bus -> workflow execution."""
        # Create a workflow that records execution
        execution_log = []

        async def logging_task():
            execution_log.append("workflow_executed")
            return {"status": "completed"}

        task = Task(id="log_task", name="Logging Task", action=logging_task)
        workflow = Workflow(
            id="logging_workflow", name="Logging Workflow", tasks={"log_task": task}
        )
        automation_engine.register_workflow(workflow)

        # Create and bind trigger
        trigger = WebhookTrigger("logging_trigger", {"path": "/log"})
        automation_engine.register_trigger(trigger)
        automation_engine.bind_trigger_to_workflow("logging_trigger", "logging_workflow")

        # Verify no executions yet
        assert len(execution_log) == 0

        # Fire trigger
        event = TriggerEvent(
            trigger_type="webhook",
            data={"method": "POST", "path": "/log"},
            context={"source": "test"},
        )
        await trigger._fire_event(event)

        # Wait for workflow execution
        await asyncio.sleep(0.3)

        # Verify workflow was executed
        assert len(execution_log) == 1
        assert execution_log[0] == "workflow_executed"
