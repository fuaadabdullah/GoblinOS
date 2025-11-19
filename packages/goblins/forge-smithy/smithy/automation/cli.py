"""
CLI integration for smithy automation.

Provides command-line interface for managing automations, workflows,
schedules, and configuration.
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Optional

import typer
from rich.console import Console
from rich.table import Table

from .config import ConfigManager
from .pipelines import PipelineGenerator, PipelineTemplateLibrary
from .plugins import PluginManager, PluginTemplateGenerator
from .scheduler import Scheduler
from .secrets import DEFAULT_KEY_NAMES, EnvBackend, SecretsManager
from .state import SQLiteBackend, StateManager
from .triggers import TriggerManager
from .workflow import Task, Workflow, WorkflowEngine

logger = logging.getLogger(__name__)
console = Console()
app = typer.Typer(help="Smithy Automation Framework")


class AutomationCLI:
    """CLI manager for automation commands."""

    def __init__(self, project_root: Optional[Path] = None):
        self.project_root = project_root or Path.cwd()
        self.config_manager = ConfigManager(self.project_root)
        self.state_manager: Optional[StateManager] = None
        self.scheduler: Optional[Scheduler] = None
        self.trigger_manager: Optional[TriggerManager] = None
        self.workflow_engine: Optional[WorkflowEngine] = None

    async def initialize(self) -> None:
        """Initialize automation components."""
        # Initialize state manager
        db_path = self.project_root / ".smithy" / "automation.db"
        backend = SQLiteBackend(db_path)
        self.state_manager = StateManager(backend)
        await self.state_manager.initialize()

        # Initialize other components
        self.scheduler = Scheduler()
        self.trigger_manager = TriggerManager()
        self.workflow_engine = WorkflowEngine()

        logger.info("Automation CLI initialized")

    async def close(self) -> None:
        """Close automation components."""
        if self.state_manager:
            await self.state_manager.close()


# Global CLI instance
cli = AutomationCLI()


def get_plugin_manager() -> PluginManager:
    return PluginManager(project_root=cli.project_root, config_manager=cli.config_manager)


def get_pipeline_generator() -> PipelineGenerator:
    return PipelineGenerator(workspace_root=cli.project_root)


@app.callback()
def callback():
    """Smithy Automation Framework - Advanced development workflow automation."""
    pass


# Configuration commands
config_app = typer.Typer(help="Manage automation configuration")
app.add_typer(config_app, name="config")


secrets_app = typer.Typer(help="Manage secrets and API keys")
app.add_typer(secrets_app, name="secrets")


plugins_app = typer.Typer(help="Manage Smithy plugins")
app.add_typer(plugins_app, name="plugins")

pipeline_app = typer.Typer(help="CI/CD pipeline automation")
app.add_typer(pipeline_app, name="pipeline")


@secrets_app.command("list")
def secrets_list(env_file: Optional[str] = typer.Option(None, help="Optional .env file path")):
    """List known secrets (redacted)."""
    env_backend = EnvBackend(Path(env_file)) if env_file else None
    mgr = SecretsManager(env_backend=env_backend)
    rows = mgr.list()
    table = Table(title="Secrets (redacted)")
    table.add_column("Key", style="cyan")
    table.add_column("Value", style="green")
    table.add_column("Source", style="magenta")
    for key, (value, source) in sorted(rows.items()):
        table.add_row(key, value, source)
    console.print(table)


@secrets_app.command("get")
def secrets_get(
    key: str, env_file: Optional[str] = typer.Option(None, help="Optional .env file path")
):
    """Display a secret value."""
    env_backend = EnvBackend(Path(env_file)) if env_file else None
    mgr = SecretsManager(env_backend=env_backend)
    record = mgr.get(key)
    if not record:
        console.print(f"[red]Secret '{key}' not found[/red]")
        raise typer.Exit(code=1)
    console.print(f"{key}={record.value}")


@secrets_app.command("set")
def secrets_set(
    key: str,
    value: str,
    env_file: Optional[str] = typer.Option(None, help="Write to .env file as well"),
    keyring_store: bool = typer.Option(True, help="Persist in OS keyring when available"),
):
    """Store/update a secret."""
    env_backend = EnvBackend(Path(env_file)) if env_file else None
    mgr = SecretsManager(env_backend=env_backend)
    targets = ["keyring"] if keyring_store else []
    results = mgr.set(key, value, targets=targets)
    if env_file:
        EnvBackend(Path(env_file)).set(key, value)
    console.print({"stored": results, "env_file": env_file})


@secrets_app.command("delete")
def secrets_delete(key: str):
    """Delete a secret from all backends."""
    mgr = SecretsManager()
    results = mgr.delete(key)
    console.print({"deleted": results})


@secrets_app.command("sync-env")
def secrets_sync_env(
    env_file: str = typer.Argument(..., help="Destination .env file"),
    keys: str = typer.Option(",".join(DEFAULT_KEY_NAMES), help="Comma separated list of keys"),
):
    """Materialize secrets into an .env file."""
    mgr = SecretsManager()
    env_path = Path(env_file)
    key_list = [k.strip() for k in keys.split(",") if k.strip()]
    results = mgr.sync_env_file(key_list, env_path)
    console.print({"synced": results, "env_file": env_file})


@plugins_app.command("list")
def plugins_list():
    """List discovered plugins."""
    manager = get_plugin_manager()
    records = manager.list_plugins()
    if not records:
        console.print("[yellow]No plugins discovered[/yellow]")
        return
    table = Table(title="Smithy Plugins")
    table.add_column("Name", style="cyan")
    table.add_column("Version", style="green")
    table.add_column("Categories", style="magenta")
    table.add_column("Status", style="yellow")
    table.add_column("Source", style="blue")
    for record in records.values():
        categories = ", ".join(record.manifest.categories)
        table.add_row(
            record.manifest.name,
            record.manifest.version,
            categories or "-",
            record.status.value,
            record.source,
        )
    console.print(table)


@plugins_app.command("enable")
def plugins_enable(name: str):
    manager = get_plugin_manager()
    manager.enable(name)
    console.print(f"[green]Plugin '{name}' enabled[/green]")


@plugins_app.command("disable")
def plugins_disable(name: str):
    manager = get_plugin_manager()
    manager.disable(name)
    console.print(f"[yellow]Plugin '{name}' disabled[/yellow]")


@plugins_app.command("install")
def plugins_install(path: str):
    manager = get_plugin_manager()
    record = manager.install(Path(path))
    console.print({"installed": record.manifest.name, "path": str(record.path)})


@plugins_app.command("generate")
def plugins_generate(
    name: str = typer.Argument(..., help="Plugin slug"),
    destination: str = typer.Argument(..., help="Destination directory"),
    category: str = typer.Option("tool", help="Plugin category"),
):
    generator = PluginTemplateGenerator(
        plugin_name=name,
        destination=Path(destination),
        category=category,
    )
    output = generator.generate()
    console.print({"generated": str(output)})


@pipeline_app.command("templates")
def pipeline_templates():
    table = Table(title="Available pipeline templates")
    table.add_column("Template", style="cyan")
    table.add_column("Description", style="green")
    table.add_row("python-ci", "Python lint/test/build pipeline")
    table.add_row("node-ci", "Node/PNPM pipeline with lint/test/build")
    table.add_row("release", "Environment promotion pipeline")
    console.print(table)


def _build_pipeline(template: str, branch: str, envs: str) -> Any:
    template = template.lower()
    if template == "python-ci":
        return PipelineTemplateLibrary.python_ci(branch)
    if template == "node-ci":
        return PipelineTemplateLibrary.node_ci(branch)
    if template == "release":
        target_envs = [env.strip() for env in envs.split(",") if env.strip()]
        if not target_envs:
            raise typer.BadParameter("Provide at least one environment for release pipeline")
        return PipelineTemplateLibrary.release_pipeline(target_envs)
    raise typer.BadParameter(f"Unknown pipeline template '{template}'")


@pipeline_app.command("generate")
def pipeline_generate(
    template: str = typer.Argument(..., help="Template name (python-ci|node-ci|release)"),
    filename: str = typer.Argument(..., help="Workflow file name, e.g. python-ci.yml"),
    branch: str = typer.Option("main", help="Primary branch"),
    envs: str = typer.Option(
        "staging,production", help="Comma separated env list (release template)"
    ),
):
    pipeline = _build_pipeline(template, branch, envs)
    generator = get_pipeline_generator()
    path = generator.write_github_actions(pipeline, filename)
    console.print({"generated": str(path)})


@config_app.command("get")
def config_get(key: str):
    """Get a configuration value."""
    try:
        value = cli.config_manager.get(key)
        if value is not None:
            console.print(f"[green]{key}[/green] = [blue]{value}[/blue]")
        else:
            console.print(f"[yellow]Configuration key '{key}' not found[/yellow]")
    except Exception as e:
        console.print(f"[red]Error getting config: {e}[/red]")


@config_app.command("set")
def config_set(key: str, value: str):
    """Set a configuration value."""
    try:
        # Try to parse as JSON, otherwise treat as string
        try:
            parsed_value = json.loads(value)
        except json.JSONDecodeError:
            parsed_value = value

        cli.config_manager.set(key, parsed_value)
        console.print(f"[green]Set {key} = {parsed_value}[/green]")
    except Exception as e:
        console.print(f"[red]Error setting config: {e}[/red]")


@config_app.command("list")
def config_list():
    """List all configuration layers."""
    try:
        layers = cli.config_manager.list_layers()
        table = Table(title="Configuration Layers")
        table.add_column("Name", style="cyan")
        table.add_column("Priority", style="magenta")
        table.add_column("Source", style="green")
        table.add_column("Keys", style="yellow")

        for layer in layers:
            table.add_row(
                layer["name"],
                str(layer["priority"]),
                layer["source"] or "N/A",
                str(layer["key_count"]),
            )

        console.print(table)
    except Exception as e:
        console.print(f"[red]Error listing config: {e}[/red]")


# Workflow commands
workflow_app = typer.Typer(help="Manage automation workflows")
app.add_typer(workflow_app, name="workflow")


@workflow_app.command("create")
def workflow_create(
    name: str, file: typer.FileText = typer.Option(None, help="Workflow definition file (JSON)")
):
    """Create a new workflow."""
    try:
        if file:
            # Load from file
            workflow_data = json.load(file)
            workflow = Workflow(
                id=workflow_data["id"],
                name=workflow_data["name"],
                description=workflow_data.get("description"),
            )

            # Add tasks
            for task_data in workflow_data.get("tasks", []):
                task = Task(
                    id=task_data["id"],
                    name=task_data["name"],
                    action=lambda: asyncio.sleep(
                        0
                    ),  # Placeholder - would need proper action loading
                    dependencies=set(task_data.get("dependencies", [])),
                    timeout=task_data.get("timeout"),
                    retry_count=task_data.get("retry_count", 0),
                    retry_delay=task_data.get("retry_delay", 1.0),
                )
                workflow.add_task(task)

        else:
            # Interactive creation
            workflow_id = typer.prompt("Workflow ID")
            workflow = Workflow(id=workflow_id, name=name)

        # Validate workflow
        errors = workflow.validate()
        if errors:
            console.print("[red]Workflow validation errors:[/red]")
            for error in errors:
                console.print(f"  - {error}")
            return

        console.print(
            f"[green]Created workflow '{workflow.id}' with {len(workflow.tasks)} tasks[/green]"
        )

    except Exception as e:
        console.print(f"[red]Error creating workflow: {e}[/red]")


@workflow_app.command("list")
def workflow_list():
    """List all workflows."""
    # This would need workflow storage/retrieval
    console.print("[yellow]Workflow listing not yet implemented[/yellow]")


@workflow_app.command("run")
def workflow_run(workflow_id: str):
    """Run a workflow."""
    console.print(f"[yellow]Workflow execution not yet implemented for '{workflow_id}'[/yellow]")


# Schedule commands
schedule_app = typer.Typer(help="Manage automation schedules")
app.add_typer(schedule_app, name="schedule")


@schedule_app.command("list")
def schedule_list():
    """List all schedules."""
    try:
        if not cli.scheduler:
            console.print("[red]Scheduler not initialized[/red]")
            return

        schedules = cli.scheduler.list_schedules()
        if not schedules:
            console.print("[yellow]No schedules configured[/yellow]")
            return

        table = Table(title="Active Schedules")
        table.add_column("ID", style="cyan")
        table.add_column("Type", style="magenta")
        table.add_column("Expression/Interval", style="green")
        table.add_column("Next Run", style="yellow")

        for schedule in schedules:
            table.add_row(
                schedule["id"],
                schedule["type"],
                schedule["expression"],
                schedule.get("next_run", "N/A"),
            )

        console.print(table)

    except Exception as e:
        console.print(f"[red]Error listing schedules: {e}[/red]")


@schedule_app.command("add-cron")
def schedule_add_cron(id: str, cron_expression: str, workflow_id: str):
    """Add a cron schedule."""
    try:
        if not cli.scheduler:
            console.print("[red]Scheduler not initialized[/red]")
            return

        from .scheduler import CronSchedule

        CronSchedule(name=id, cron_expression=cron_expression)

        # This would need workflow lookup and callback setup
        console.print("[yellow]Cron schedule creation not fully implemented[/yellow]")
        console.print(f"[green]Added cron schedule '{id}': {cron_expression}[/green]")

    except Exception as e:
        console.print(f"[red]Error adding cron schedule: {e}[/red]")


# Trigger commands
trigger_app = typer.Typer(help="Manage automation triggers")
app.add_typer(trigger_app, name="trigger")


@trigger_app.command("list")
def trigger_list():
    """List all triggers."""
    try:
        if not cli.trigger_manager:
            console.print("[red]Trigger manager not initialized[/red]")
            return

        triggers = cli.trigger_manager.list_triggers()
        if not triggers:
            console.print("[yellow]No triggers configured[/yellow]")
            return

        table = Table(title="Active Triggers")
        table.add_column("ID", style="cyan")
        table.add_column("Type", style="magenta")
        table.add_column("Path/Pattern", style="green")
        table.add_column("Status", style="yellow")

        for trigger in triggers:
            table.add_row(
                trigger["id"],
                trigger["type"],
                trigger.get("path", trigger.get("pattern", "N/A")),
                trigger.get("status", "unknown"),
            )

        console.print(table)

    except Exception as e:
        console.print(f"[red]Error listing triggers: {e}[/red]")


@trigger_app.command("add-filesystem")
def trigger_add_filesystem(id: str, path: str, pattern: str = "*", workflow_id: str = ""):
    """Add a filesystem trigger."""
    try:
        if not cli.trigger_manager:
            console.print("[red]Trigger manager not initialized[/red]")
            return

        from .triggers import FileSystemTrigger

        trigger = FileSystemTrigger(name=id, watch_paths=[Path(path)], patterns=[pattern])

        cli.trigger_manager.add_trigger(trigger)
        console.print(f"[green]Added filesystem trigger '{id}' watching '{path}'[/green]")

    except Exception as e:
        console.print(f"[red]Error adding filesystem trigger: {e}[/red]")


# History commands
history_app = typer.Typer(help="View automation execution history")
app.add_typer(history_app, name="history")


@history_app.command("workflows")
async def history_workflows(limit: int = 20):
    """Show recent workflow executions."""
    try:
        await cli.initialize()
        if not cli.state_manager:
            console.print("[red]State manager not initialized[/red]")
            return

        executions = await cli.state_manager.get_recent_executions(limit)
        if not executions:
            console.print("[yellow]No workflow executions found[/yellow]")
            return

        table = Table(title=f"Recent Workflow Executions (last {limit})")
        table.add_column("Workflow ID", style="cyan")
        table.add_column("Status", style="magenta")
        table.add_column("Started", style="green")
        table.add_column("Duration", style="yellow")
        table.add_column("Tasks", style="blue")

        for execution in executions:
            status_color = {
                "completed": "green",
                "failed": "red",
                "running": "yellow",
                "cancelled": "red",
            }.get(execution.status, "white")

            duration_str = f"{execution.duration:.2f}s" if execution.duration is not None else "N/A"

            table.add_row(
                execution.workflow_id,
                f"[{status_color}]{execution.status}[/{status_color}]",
                execution.started_at.strftime("%Y-%m-%d %H:%M:%S")
                if execution.started_at
                else "N/A",
                duration_str,
                "N/A",  # Would need to count tasks
            )

        console.print(table)
    except Exception as e:
        console.print(f"[red]Error showing history: {e}[/red]")
    finally:
        await cli.close()


# Status command
@app.command("status")
async def status():
    """Show automation system status."""
    try:
        await cli.initialize()

        # Check components
        components = {
            "Configuration": cli.config_manager is not None,
            "State Manager": cli.state_manager is not None,
            "Scheduler": cli.scheduler is not None,
            "Trigger Manager": cli.trigger_manager is not None,
            "Workflow Engine": cli.workflow_engine is not None,
        }

        table = Table(title="Automation System Status")
        table.add_column("Component", style="cyan")
        table.add_column("Status", style="green")

        for component, available in components.items():
            status_icon = "✅" if available else "❌"
            status_text = "[green]Available[/green]" if available else "[red]Unavailable[/red]"
            table.add_row(component, f"{status_icon} {status_text}")

        console.print(table)

        # Show some stats
        if cli.state_manager:
            executions = await cli.state_manager.get_recent_executions(1000)
            console.print(f"\n[blue]Total workflow executions: {len(executions)}[/blue]")

        if cli.scheduler:
            schedules = cli.scheduler.list_schedules()
            console.print(f"[blue]Active schedules: {len(schedules)}[/blue]")

        if cli.trigger_manager:
            triggers = cli.trigger_manager.list_triggers()
            console.print(f"[blue]Active triggers: {len(triggers)}[/blue]")

    except Exception as e:
        console.print(f"[red]Error getting status: {e}[/red]")
    finally:
        await cli.close()


# Main entry point
def main():
    """Main CLI entry point."""
    app()


if __name__ == "__main__":
    # Typer's default runner will handle the async commands correctly
    main()
