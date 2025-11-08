"""
State persistence for automation.

Provides database-backed storage for workflow and task state, execution history,
and configuration persistence.
"""

import asyncio
import json
import logging
import sqlite3
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List, Optional, Union

logger = logging.getLogger(__name__)


@dataclass
class PersistedTaskResult:
    """Database representation of task result."""

    id: Optional[int] = None
    task_id: str = ""
    workflow_id: str = ""
    status: str = ""
    output: Optional[str] = None  # JSON serialized
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration: Optional[float] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    def from_task_result(cls, result, workflow_id: str) -> "PersistedTaskResult":
        """Create from TaskResult object."""
        return cls(
            task_id=result.task_id,
            workflow_id=workflow_id,
            status=result.status.value,
            output=json.dumps(result.output) if result.output is not None else None,
            error=result.error,
            started_at=result.started_at,
            completed_at=result.completed_at,
            duration=result.duration,
        )

    def to_task_result(self):
        """Convert to TaskResult object."""
        from .workflow import TaskResult, TaskStatus

        return TaskResult(
            task_id=self.task_id,
            status=TaskStatus(self.status),
            output=json.loads(self.output) if self.output else None,
            error=self.error,
            started_at=self.started_at,
            completed_at=self.completed_at,
        )


@dataclass
class PersistedWorkflowResult:
    """Database representation of workflow result."""

    id: Optional[int] = None
    workflow_id: str = ""
    status: str = ""
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration: Optional[float] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    def from_workflow_result(cls, result) -> "PersistedWorkflowResult":
        """Create from WorkflowResult object."""
        return cls(
            workflow_id=result.workflow_id,
            status=result.status.value,
            started_at=result.started_at,
            completed_at=result.completed_at,
            duration=result.duration,
        )


class StateBackend(ABC):
    """Abstract base class for state backends."""

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the backend."""
        pass

    @abstractmethod
    async def save_workflow_result(self, result) -> None:
        """Save a workflow result."""
        pass

    @abstractmethod
    async def save_task_result(self, result, workflow_id: str) -> None:
        """Save a task result."""
        pass

    @abstractmethod
    async def get_workflow_result(self, workflow_id: str) -> Optional[PersistedWorkflowResult]:
        """Get a workflow result by ID."""
        pass

    @abstractmethod
    async def get_workflow_history(self, limit: int = 100) -> List[PersistedWorkflowResult]:
        """Get recent workflow results."""
        pass

    @abstractmethod
    async def get_task_results(self, workflow_id: str) -> List[PersistedTaskResult]:
        """Get task results for a workflow."""
        pass

    @abstractmethod
    async def save_config(self, key: str, value: Any) -> None:
        """Save configuration value."""
        pass

    @abstractmethod
    async def get_config(self, key: str) -> Optional[Any]:
        """Get configuration value."""
        pass

    @abstractmethod
    async def close(self) -> None:
        """Close the backend connection."""
        pass


class SQLiteBackend(StateBackend):
    """SQLite-based state backend."""

    def __init__(self, db_path: Union[str, Path]):
        self.db_path = Path(db_path)
        self._connection: Optional[sqlite3.Connection] = None
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        """Initialize SQLite database and create tables."""
        async with self._lock:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            self._connection = sqlite3.connect(
                str(self.db_path),
                check_same_thread=False,
                isolation_level=None,  # Enable autocommit mode
            )
            self._connection.row_factory = sqlite3.Row

            # Create tables
            await self._execute("""
                CREATE TABLE IF NOT EXISTS workflow_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workflow_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    duration REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            await self._execute("""
                CREATE TABLE IF NOT EXISTS task_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT NOT NULL,
                    workflow_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    output TEXT,
                    error TEXT,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    duration REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            await self._execute("""
                CREATE TABLE IF NOT EXISTS config (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Create indexes for better performance
            await self._execute(
                "CREATE INDEX IF NOT EXISTS idx_workflow_id ON workflow_results(workflow_id)"
            )
            await self._execute(
                "CREATE INDEX IF NOT EXISTS idx_task_workflow_id ON task_results(workflow_id)"
            )
            await self._execute("CREATE INDEX IF NOT EXISTS idx_config_key ON config(key)")

            logger.info(f"Initialized SQLite state backend at {self.db_path}")

    async def _execute(self, query: str, params: tuple = ()) -> sqlite3.Cursor:
        """Execute a SQL query."""
        if not self._connection:
            raise RuntimeError("Database not initialized")

        def _sync_execute():
            return self._connection.execute(query, params)  # type: ignore

        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _sync_execute)

    async def _fetchone(self, query: str, params: tuple = ()) -> Optional[sqlite3.Row]:
        """Fetch a single row."""
        cursor = await self._execute(query, params)
        return cursor.fetchone()

    async def _fetchall(self, query: str, params: tuple = ()) -> List[sqlite3.Row]:
        """Fetch all rows."""
        cursor = await self._execute(query, params)
        return cursor.fetchall()

    async def save_workflow_result(self, result) -> None:
        """Save a workflow result."""
        async with self._lock:
            persisted = PersistedWorkflowResult.from_workflow_result(result)
            await self._execute(
                """
                INSERT INTO workflow_results
                (workflow_id, status, started_at, completed_at, duration)
                VALUES (?, ?, ?, ?, ?)
            """,
                (
                    persisted.workflow_id,
                    persisted.status,
                    persisted.started_at.isoformat() if persisted.started_at else None,
                    persisted.completed_at.isoformat() if persisted.completed_at else None,
                    persisted.duration,
                ),
            )
            logger.debug(f"Saved workflow result for '{result.workflow_id}'")

    async def save_task_result(self, result, workflow_id: str) -> None:
        """Save a task result."""
        async with self._lock:
            persisted = PersistedTaskResult.from_task_result(result, workflow_id)
            await self._execute(
                """
                INSERT INTO task_results
                (task_id, workflow_id, status, output, error, started_at, completed_at, duration)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    persisted.task_id,
                    persisted.workflow_id,
                    persisted.status,
                    persisted.output,
                    persisted.error,
                    persisted.started_at.isoformat() if persisted.started_at else None,
                    persisted.completed_at.isoformat() if persisted.completed_at else None,
                    persisted.duration,
                ),
            )
            logger.debug(f"Saved task result for '{result.task_id}' in workflow '{workflow_id}'")

    async def get_workflow_result(self, workflow_id: str) -> Optional[PersistedWorkflowResult]:
        """Get a workflow result by ID."""
        async with self._lock:
            row = await self._fetchone(
                """
                SELECT * FROM workflow_results
                WHERE workflow_id = ?
                ORDER BY created_at DESC
                LIMIT 1
            """,
                (workflow_id,),
            )

            if row:
                return PersistedWorkflowResult(
                    id=row["id"],
                    workflow_id=row["workflow_id"],
                    status=row["status"],
                    started_at=datetime.fromisoformat(row["started_at"])
                    if row["started_at"]
                    else None,
                    completed_at=datetime.fromisoformat(row["completed_at"])
                    if row["completed_at"]
                    else None,
                    duration=row["duration"],
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
            return None

    async def get_workflow_history(self, limit: int = 100) -> List[PersistedWorkflowResult]:
        """Get recent workflow results."""
        async with self._lock:
            rows = await self._fetchall(
                """
                SELECT * FROM workflow_results
                ORDER BY created_at DESC
                LIMIT ?
            """,
                (limit,),
            )

            results = []
            for row in rows:
                results.append(
                    PersistedWorkflowResult(
                        id=row["id"],
                        workflow_id=row["workflow_id"],
                        status=row["status"],
                        started_at=datetime.fromisoformat(row["started_at"])
                        if row["started_at"]
                        else None,
                        completed_at=datetime.fromisoformat(row["completed_at"])
                        if row["completed_at"]
                        else None,
                        duration=row["duration"],
                        created_at=datetime.fromisoformat(row["created_at"]),
                    )
                )
            return results

    async def get_task_results(self, workflow_id: str) -> List[PersistedTaskResult]:
        """Get task results for a workflow."""
        async with self._lock:
            rows = await self._fetchall(
                """
                SELECT * FROM task_results
                WHERE workflow_id = ?
                ORDER BY created_at ASC
            """,
                (workflow_id,),
            )

            results = []
            for row in rows:
                results.append(
                    PersistedTaskResult(
                        id=row["id"],
                        task_id=row["task_id"],
                        workflow_id=row["workflow_id"],
                        status=row["status"],
                        output=row["output"],
                        error=row["error"],
                        started_at=datetime.fromisoformat(row["started_at"])
                        if row["started_at"]
                        else None,
                        completed_at=datetime.fromisoformat(row["completed_at"])
                        if row["completed_at"]
                        else None,
                        duration=row["duration"],
                        created_at=datetime.fromisoformat(row["created_at"]),
                    )
                )
            return results

    async def save_config(self, key: str, value: Any) -> None:
        """Save configuration value."""
        async with self._lock:
            json_value = json.dumps(value)
            await self._execute(
                """
                INSERT OR REPLACE INTO config (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            """,
                (key, json_value),
            )
            logger.debug(f"Saved config '{key}'")

    async def get_config(self, key: str) -> Optional[Any]:
        """Get configuration value."""
        async with self._lock:
            row = await self._fetchone(
                """
                SELECT value FROM config WHERE key = ?
            """,
                (key,),
            )

            if row:
                try:
                    return json.loads(row["value"])
                except json.JSONDecodeError:
                    return row["value"]  # Return as string if not JSON
            return None

    async def close(self) -> None:
        """Close the database connection."""
        async with self._lock:
            if self._connection:
                self._connection.close()
                self._connection = None
                logger.info("Closed SQLite state backend")


class StateManager:
    """Manager for state persistence with multiple backends."""

    def __init__(self, backend: StateBackend):
        self.backend = backend
        self._initialized = False

    async def initialize(self) -> None:
        """Initialize the state manager."""
        if not self._initialized:
            await self.backend.initialize()
            self._initialized = True
            logger.info("State manager initialized")

    async def save_workflow_execution(self, result) -> None:
        """Save a complete workflow execution."""
        await self.initialize()

        # Save workflow result
        await self.backend.save_workflow_result(result)

        # Save all task results
        for task_result in result.task_results.values():
            await self.backend.save_task_result(task_result, result.workflow_id)

        logger.info(
            f"Saved workflow execution '{result.workflow_id}' with {len(result.task_results)} tasks"
        )

    async def get_workflow_execution(self, workflow_id: str):
        """Get a complete workflow execution."""
        await self.initialize()

        # Get workflow result
        workflow_result = await self.backend.get_workflow_result(workflow_id)
        if not workflow_result:
            return None

        # Get task results
        task_results = await self.backend.get_task_results(workflow_id)
        task_dict = {tr.task_id: tr.to_task_result() for tr in task_results}

        # Reconstruct WorkflowResult
        from .workflow import WorkflowResult, WorkflowStatus

        return WorkflowResult(
            workflow_id=workflow_result.workflow_id,
            status=WorkflowStatus(workflow_result.status),
            task_results=task_dict,
            started_at=workflow_result.started_at,
            completed_at=workflow_result.completed_at,
        )

    async def get_recent_executions(self, limit: int = 50) -> List[PersistedWorkflowResult]:
        """Get recent workflow executions."""
        await self.initialize()
        return await self.backend.get_workflow_history(limit)

    async def save_config(self, key: str, value: Any) -> None:
        """Save configuration value."""
        await self.initialize()
        await self.backend.save_config(key, value)

    async def get_config(self, key: str, default: Any = None) -> Any:
        """Get configuration value."""
        await self.initialize()
        value = await self.backend.get_config(key)
        return value if value is not None else default

    async def close(self) -> None:
        """Close the state manager."""
        if self._initialized:
            await self.backend.close()
            self._initialized = False
            logger.info("State manager closed")

    @asynccontextmanager
    async def session(self):
        """Context manager for state operations."""
        await self.initialize()
        try:
            yield self
        finally:
            pass  # Keep connection open for reuse
