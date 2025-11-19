"""
Data Models for Smithy Automation State.

This module defines the data models for persisting the state of automation
workflows, runs, and steps. It uses SQLModel to provide a single, clear
definition for both database tables and Python objects.

These models are used by the scheduler and workflow engine to track execution
and allow for recovery and auditing.

Key Models:
- Workflow: The definition of a workflow.
- WorkflowRun: A specific execution instance of a Workflow.
- StepRun: A specific execution instance of a single step within a WorkflowRun.
"""
import enum
import uuid
from datetime import datetime
from typing import Dict, Optional

from sqlmodel import Field, JSON, SQLModel, Column


def now() -> datetime:
    return datetime.utcnow()

class RunStatus(str, enum.Enum):
    """Represents the status of a workflow or step run."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Workflow(SQLModel, table=True):
    """A workflow definition."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(unique=True, index=True)
    description: Optional[str] = None
    # The definition could be a list of step names, a script, etc.
    definition: Dict = Field(sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=now)
    updated_at: datetime = Field(default_factory=now, sa_column_kwargs={"onupdate": now})


class WorkflowRun(SQLModel, table=True):
    """An instance of a single execution of a workflow."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workflow_id: str = Field(foreign_key="workflow.id")
    status: RunStatus = Field(default=RunStatus.PENDING, index=True)
    trigger_event: Dict = Field(sa_column=Column(JSON))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    # Store results or error messages
    output: Optional[Dict] = Field(default=None, sa_column=Column(JSON))


class StepRun(SQLModel, table=True):
    """An instance of a single step execution within a workflow run."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workflow_run_id: str = Field(foreign_key="workflowrun.id")
    step_name: str
    status: RunStatus = Field(default=RunStatus.PENDING, index=True)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    # Store logs, outputs, or error messages for the step
    output: Optional[Dict] = Field(default=None, sa_column=Column(JSON))
