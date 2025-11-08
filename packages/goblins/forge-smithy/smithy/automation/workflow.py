"""
Workflow orchestration engine for automation.

Provides DAG-based workflow execution with task dependencies, parallel execution,
error handling, and state management.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Awaitable, Callable, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    """Task execution status."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


class WorkflowStatus(Enum):
    """Workflow execution status."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class TaskResult:
    """Result of a task execution."""

    task_id: str
    status: TaskStatus
    output: Any = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration: Optional[float] = None

    def __post_init__(self):
        if self.started_at and self.completed_at:
            self.duration = (self.completed_at - self.started_at).total_seconds()


@dataclass
class Task:
    """Represents a task in a workflow."""

    id: str
    name: str
    action: Callable[..., Awaitable[Any]]
    dependencies: Set[str] = field(default_factory=set)
    timeout: Optional[float] = None  # seconds
    retry_count: int = 0
    retry_delay: float = 1.0  # seconds
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __hash__(self):
        return hash(self.id)

    def __eq__(self, other):
        return isinstance(other, Task) and self.id == other.id


@dataclass
class WorkflowResult:
    """Result of a workflow execution."""

    workflow_id: str
    status: WorkflowStatus
    task_results: Dict[str, TaskResult] = field(default_factory=dict)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration: Optional[float] = None

    def __post_init__(self):
        if self.started_at and self.completed_at:
            self.duration = (self.completed_at - self.started_at).total_seconds()


class WorkflowExecutionError(Exception):
    """Error during workflow execution."""

    pass


class TaskExecutor(ABC):
    """Abstract base class for task executors."""

    @abstractmethod
    async def execute_task(self, task: Task, context: Dict[str, Any]) -> TaskResult:
        """Execute a single task."""
        pass


class DefaultTaskExecutor(TaskExecutor):
    """Default task executor with retry and timeout support."""

    async def execute_task(self, task: Task, context: Dict[str, Any]) -> TaskResult:
        """Execute a task with retry and timeout."""
        started_at = datetime.now(timezone.utc)
        last_error = None

        for attempt in range(task.retry_count + 1):
            try:
                if task.timeout:
                    # Execute with timeout
                    result = await asyncio.wait_for(task.action(**context), timeout=task.timeout)
                else:
                    result = await task.action(**context)

                completed_at = datetime.now(timezone.utc)
                return TaskResult(
                    task_id=task.id,
                    status=TaskStatus.COMPLETED,
                    output=result,
                    started_at=started_at,
                    completed_at=completed_at,
                )

            except asyncio.TimeoutError:
                error_msg = f"Task {task.id} timed out after {task.timeout}s"
                logger.warning(error_msg)
                last_error = error_msg

            except Exception as e:
                error_msg = f"Task {task.id} failed: {str(e)}"
                logger.error(error_msg)
                last_error = error_msg

                # Don't retry on the last attempt
                if attempt < task.retry_count:
                    logger.info(
                        f"Retrying task {task.id} in {task.retry_delay}s (attempt {attempt + 1}/{task.retry_count + 1})"
                    )
                    await asyncio.sleep(task.retry_delay)

        # All attempts failed
        completed_at = datetime.now(timezone.utc)
        return TaskResult(
            task_id=task.id,
            status=TaskStatus.FAILED,
            error=last_error,
            started_at=started_at,
            completed_at=completed_at,
        )


@dataclass
class Workflow:
    """Represents a workflow with tasks and dependencies."""

    id: str
    name: str
    description: Optional[str] = None
    tasks: Dict[str, Task] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    max_parallel: int = 5  # Maximum parallel tasks

    def add_task(self, task: Task) -> None:
        """Add a task to the workflow."""
        self.tasks[task.id] = task
        logger.debug(f"Added task '{task.id}' to workflow '{self.id}'")

    def remove_task(self, task_id: str) -> None:
        """Remove a task from the workflow."""
        if task_id in self.tasks:
            del self.tasks[task_id]
            # Remove this task from other tasks' dependencies
            for task in self.tasks.values():
                task.dependencies.discard(task_id)
            logger.debug(f"Removed task '{task_id}' from workflow '{self.id}'")

    def validate(self) -> List[str]:
        """Validate the workflow structure."""
        errors = []

        # Check for missing dependencies
        all_task_ids = set(self.tasks.keys())
        for task in self.tasks.values():
            missing_deps = task.dependencies - all_task_ids
            if missing_deps:
                errors.append(f"Task '{task.id}' has missing dependencies: {missing_deps}")

        # Check for circular dependencies
        if self._has_circular_dependencies():
            errors.append("Workflow contains circular dependencies")

        return errors

    def _has_circular_dependencies(self) -> bool:
        """Check for circular dependencies using topological sort."""
        # Build adjacency list
        graph = {task.id: list(task.dependencies) for task in self.tasks.values()}

        # Calculate indegrees
        indegree = {task_id: 0 for task_id in graph}
        for neighbors in graph.values():
            for neighbor in neighbors:
                indegree[neighbor] += 1

        # Queue for tasks with no dependencies
        queue = deque([task_id for task_id, degree in indegree.items() if degree == 0])

        processed = 0

        while queue:
            current = queue.popleft()
            processed += 1

            # Reduce indegree of neighbors
            for neighbor in graph.get(current, []):
                indegree[neighbor] -= 1
                if indegree[neighbor] == 0:
                    queue.append(neighbor)

        # If not all tasks were processed, there's a cycle
        return processed != len(graph)

    def get_execution_order(self) -> List[List[str]]:
        """Get tasks grouped by execution order (parallel groups)."""
        if not self.tasks:
            return []

        # Build graph and indegrees
        graph = {task.id: list(task.dependencies) for task in self.tasks.values()}
        indegree = {task_id: 0 for task_id in graph}

        for neighbors in graph.values():
            for neighbor in neighbors:
                indegree[neighbor] += 1

        # Kahn's algorithm for topological sort
        queue = deque([task_id for task_id, degree in indegree.items() if degree == 0])
        result = []

        while queue:
            level_size = len(queue)
            current_level = []

            for _ in range(level_size):
                current = queue.popleft()
                current_level.append(current)

                # Reduce indegree of neighbors
                for neighbor in graph.get(current, []):
                    indegree[neighbor] -= 1
                    if indegree[neighbor] == 0:
                        queue.append(neighbor)

            result.append(current_level)

        # Check if all tasks were included (no cycles)
        if sum(len(level) for level in result) != len(graph):
            raise WorkflowExecutionError(
                "Cannot determine execution order: circular dependencies detected"
            )

        return result


class WorkflowEngine:
    """Engine for executing workflows with parallel task execution."""

    def __init__(self, executor: Optional[TaskExecutor] = None):
        self.executor = executor or DefaultTaskExecutor()
        self._running_workflows: Dict[str, asyncio.Task] = {}
        self._cancel_tokens: Dict[str, asyncio.Event] = {}

    async def execute_workflow(
        self, workflow: Workflow, context: Optional[Dict[str, Any]] = None
    ) -> WorkflowResult:
        """Execute a workflow."""
        context = context or {}

        # Validate workflow
        validation_errors = workflow.validate()
        if validation_errors:
            raise WorkflowExecutionError(f"Workflow validation failed: {validation_errors}")

        workflow_id = workflow.id
        started_at = datetime.now(timezone.utc)

        # Create cancel token
        cancel_token = asyncio.Event()
        self._cancel_tokens[workflow_id] = cancel_token

        try:
            # Execute tasks in topological order
            execution_order = workflow.get_execution_order()
            task_results = {}

            for level_tasks in execution_order:
                if cancel_token.is_set():
                    # Workflow was cancelled
                    break

                # Execute tasks in this level in parallel (up to max_parallel)
                semaphore = asyncio.Semaphore(workflow.max_parallel)
                tasks = []

                async def execute_with_semaphore(task_id: str):
                    async with semaphore:
                        if cancel_token.is_set():
                            return TaskResult(
                                task_id=task_id,
                                status=TaskStatus.CANCELLED,
                                started_at=datetime.now(timezone.utc),
                                completed_at=datetime.now(timezone.utc),
                            )

                        task = workflow.tasks[task_id]
                        logger.info(f"Executing task '{task_id}' in workflow '{workflow_id}'")

                        # Check if dependencies failed
                        dep_results = [task_results[dep_id] for dep_id in task.dependencies]
                        if any(r.status == TaskStatus.FAILED for r in dep_results):
                            return TaskResult(
                                task_id=task_id,
                                status=TaskStatus.SKIPPED,
                                error="Skipped due to failed dependencies",
                                started_at=datetime.now(timezone.utc),
                                completed_at=datetime.now(timezone.utc),
                            )

                        # Execute task
                        result = await self.executor.execute_task(task, context)
                        logger.info(f"Task '{task_id}' completed with status {result.status}")
                        return result

                # Create tasks for this level
                for task_id in level_tasks:
                    task = asyncio.create_task(execute_with_semaphore(task_id))
                    tasks.append(task)

                # Wait for all tasks in this level to complete
                level_results = await asyncio.gather(*tasks, return_exceptions=True)

                # Process results
                for i, result in enumerate(level_results):
                    task_id = level_tasks[i]
                    if isinstance(result, Exception):
                        # Task raised an exception
                        task_results[task_id] = TaskResult(
                            task_id=task_id,
                            status=TaskStatus.FAILED,
                            error=str(result),
                            started_at=datetime.now(timezone.utc),
                            completed_at=datetime.now(timezone.utc),
                        )
                    else:
                        task_results[task_id] = result

                # Check if any critical task failed
                level_failed = any(
                    result.status == TaskStatus.FAILED
                    for result in task_results.values()
                    if result.task_id in level_tasks
                )

                if level_failed:
                    # Mark remaining tasks as skipped
                    remaining_tasks = []
                    for remaining_level in execution_order[
                        execution_order.index(level_tasks) + 1 :
                    ]:
                        remaining_tasks.extend(remaining_level)

                    for task_id in remaining_tasks:
                        if task_id not in task_results:
                            task_results[task_id] = TaskResult(
                                task_id=task_id,
                                status=TaskStatus.SKIPPED,
                                error="Skipped due to failed dependencies",
                                started_at=datetime.now(timezone.utc),
                                completed_at=datetime.now(timezone.utc),
                            )

                    break

            # Determine workflow status
            completed_at = datetime.now(timezone.utc)
            failed_tasks = [r for r in task_results.values() if r.status == TaskStatus.FAILED]
            cancelled_tasks = [r for r in task_results.values() if r.status == TaskStatus.CANCELLED]

            if cancelled_tasks:
                status = WorkflowStatus.CANCELLED
            elif failed_tasks:
                status = WorkflowStatus.FAILED
            else:
                status = WorkflowStatus.COMPLETED

            result = WorkflowResult(
                workflow_id=workflow_id,
                status=status,
                task_results=task_results,
                started_at=started_at,
                completed_at=completed_at,
            )

            logger.info(f"Workflow '{workflow_id}' completed with status {status}")
            return result

        finally:
            # Cleanup
            self._cancel_tokens.pop(workflow_id, None)

    async def cancel_workflow(self, workflow_id: str) -> bool:
        """Cancel a running workflow."""
        cancel_token = self._cancel_tokens.get(workflow_id)
        if cancel_token:
            cancel_token.set()
            logger.info(f"Cancelled workflow '{workflow_id}'")
            return True
        return False

    def is_workflow_running(self, workflow_id: str) -> bool:
        """Check if a workflow is currently running."""
        return workflow_id in self._cancel_tokens

    async def execute_workflow_async(
        self, workflow: Workflow, context: Optional[Dict[str, Any]] = None
    ) -> str:
        """Execute a workflow asynchronously and return workflow ID."""
        task = asyncio.create_task(self.execute_workflow(workflow, context))
        self._running_workflows[workflow.id] = task

        # Cleanup when done
        def cleanup(task):
            self._running_workflows.pop(workflow.id, None)

        task.add_done_callback(cleanup)
        return workflow.id

    async def get_workflow_result(self, workflow_id: str) -> Optional[WorkflowResult]:
        """Get the result of an asynchronously executed workflow."""
        task = self._running_workflows.get(workflow_id)
        if task and task.done():
            try:
                return task.result()
            except Exception as e:
                logger.error(f"Workflow '{workflow_id}' failed: {e}")
                return None
        return None
