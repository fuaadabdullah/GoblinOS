"""
Workflow Engine for Smithy Automation.

This module defines the core components for executing workflows. It includes the
logic for a DAG-based workflow runner that processes a series of steps, manages
their state, and orchestrates their execution.

Key Components:
- WorkflowStep: An individual, atomic task within a workflow.
- WorkflowDefinition: Defines the structure (DAG) of a workflow.
- WorkflowRunner: Executes an instance of a workflow definition.
"""
import asyncio
from typing import Any, Awaitable, Callable, Dict, NamedTuple

from smithy.automation.models import WorkflowRun, StepRun, RunStatus

# In a real implementation, this would be a proper database session.
# For now, it's a placeholder for state management.
STATE_DB: Dict[str, Any] = {
    "workflow_runs": {},
    "step_runs": {},
}


class WorkflowStep(NamedTuple):
    """Represents a single step in a workflow."""
    name: str
    action: Callable[..., Awaitable[Any]] # The async function to execute
    # Future additions: dependencies, inputs, outputs


class WorkflowDefinition(NamedTuple):
    """Defines the structure and steps of a workflow."""
    name: str
    steps: list[WorkflowStep] # For now, a linear sequence of steps


class WorkflowRunner:
    """Orchestrates the execution of a single workflow run."""

    def __init__(self, workflow_def: WorkflowDefinition, trigger_event: Dict[str, Any]):
        self.workflow_def = workflow_def
        self.trigger_event = trigger_event
        self.run_id = self._create_workflow_run()

    def _create_workflow_run(self) -> str:
        """Creates and persists the initial WorkflowRun state."""
        run = WorkflowRun(
            workflow_id=self.workflow_def.name, # Simplified: using name as ID
            status=RunStatus.PENDING,
            trigger_event=self.trigger_event,
        )
        STATE_DB["workflow_runs"][run.id] = run
        print(f"Created WorkflowRun '{run.id}' for workflow '{self.workflow_def.name}'.")
        return run.id

    async def run(self):
        """Executes the workflow's steps in sequence."""
        print(f"Starting workflow run '{self.run_id}'.")
        self._update_run_status(RunStatus.RUNNING)

        for step in self.workflow_def.steps:
            step_run_id = self._create_step_run(step.name)
            try:
                self._update_step_status(step_run_id, RunStatus.RUNNING)
                print(f"Executing step '{step.name}'...")
                
                # Execute the step's action
                result = await step.action(context=self.trigger_event)
                
                print(f"Step '{step.name}' completed successfully.")
                self._update_step_status(step_run_id, RunStatus.COMPLETED, output={"result": str(result)})
            except Exception as e:
                print(f"Step '{step.name}' failed: {e}")
                self._update_step_status(step_run_id, RunStatus.FAILED, output={"error": str(e)})
                self._update_run_status(RunStatus.FAILED)
                return # Stop the workflow on failure

        print(f"Workflow run '{self.run_id}' completed successfully.")
        self._update_run_status(RunStatus.COMPLETED)

    def _create_step_run(self, step_name: str) -> str:
        step_run = StepRun(workflow_run_id=self.run_id, step_name=step_name)
        STATE_DB["step_runs"][step_run.id] = step_run
        return step_run.id

    def _update_run_status(self, status: RunStatus):
        run = STATE_DB["workflow_runs"][self.run_id]
        run.status = status
        # In a real DB, would also set started_at/completed_at

    def _update_step_status(self, step_run_id: str, status: RunStatus, output: Dict = None):
        step_run = STATE_DB["step_runs"][step_run_id]
        step_run.status = status
        if output:
            step_run.output = output


# --- Example Usage ---

async def example_step_one(context: Dict) -> str:
    print("Running step one!")
    await asyncio.sleep(1)
    return "Step one is done."

async def example_step_two(context: Dict) -> str:
    print("Running step two!")
    await asyncio.sleep(1)
    return "Step two is done."

def get_example_workflow() -> WorkflowDefinition:
    """Returns a sample workflow definition."""
    return WorkflowDefinition(
        name="example_workflow",
        steps=[
            WorkflowStep(name="step_one", action=example_step_one),
            WorkflowStep(name="step_two", action=example_step_two),
        ]
    )
