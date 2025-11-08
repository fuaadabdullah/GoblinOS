import asyncio
import json
from typing import List, Optional

import typer  # type: ignore
from rich.console import Console  # type: ignore

from . import biome, bootstrap, config, controls, doctor, tasks
from .automation import env_validator

try:
    from .agent import get_smithy_agent  # type: ignore

    AGENT_AVAILABLE = True
except ImportError:
    AGENT_AVAILABLE = False

app = typer.Typer(help="Smithy — your Forge Guild environment goblin 🛠️")
console = Console()


@app.command()
def doctor_cmd():
    """Run full environment diagnostics."""
    doctor.run()


@app.command()
def bootstrap_cmd(dev: bool = True):
    """Create Python env via uv, install deps, pre-commit, devcontainer."""
    bootstrap.run(dev=dev)


@app.command()
def sync_config():
    """Sync .env with .env.example; verify required keys."""
    config.sync()


@app.command()
def check():
    """Lint + test — enforce repo hygiene."""
    tasks.check()


@app.command()
def agents():
    """List available AI agents."""
    if not AGENT_AVAILABLE:
        console.print(
            "[red]❌ Agent functionality not available. Install with: uv sync --extra agent[/red]"
        )
        return

    try:
        agent = get_smithy_agent()
        available_agents = agent.list_agents()
        console.print("[green]🤖 Available Agents:[/green]")
        for agent_name in available_agents:
            info = agent.get_agent_info(agent_name)
            if info:
                console.print(f"  • [bold]{agent_name}[/bold]: {info['role']}")
                console.print(f"    Goal: {info['goal']}")
    except Exception as e:
        console.print(f"[red]❌ Failed to load agents: {e}[/red]")


@app.command()
def doctor_agent():
    """Run environment diagnostics using AI agent."""
    if not AGENT_AVAILABLE:
        console.print(
            "[red]❌ Agent functionality not available. Install with: uv sync --extra agent[/red]"
        )
        return

    try:
        agent = get_smithy_agent()
        console.print("[blue]🤖 Running AI-powered environment diagnostics...[/blue]")
        result = asyncio.run(agent.run_doctor_crew())

        if "error" in result:
            console.print(f"[red]❌ {result['error']}[/red]")
        else:
            console.print("[green]✅ AI Diagnostics Complete:[/green]")
            console.print(result.get("diagnosis", "No diagnosis available"))
    except Exception as e:
        console.print(f"[red]❌ Agent diagnostics failed: {e}[/red]")


@app.command()
def bootstrap_agent():
    """Bootstrap environment using AI agent."""
    if not AGENT_AVAILABLE:
        console.print(
            "[red]❌ Agent functionality not available. Install with: uv sync --extra agent[/red]"
        )
        return

    try:
        agent = get_smithy_agent()
        console.print("[blue]🤖 Running AI-powered environment bootstrapping...[/blue]")
        result = asyncio.run(agent.run_bootstrap_crew())

        if "error" in result:
            console.print(f"[red]❌ {result['error']}[/red]")
        else:
            console.print("[green]✅ AI Bootstrapping Complete:[/green]")
            console.print(result.get("bootstrap_result", "No result available"))
    except Exception as e:
        console.print(f"[red]❌ Agent bootstrapping failed: {e}[/red]")


@app.command()
def quality_agent():
    """Run code quality checks using AI agent."""
    if not AGENT_AVAILABLE:
        console.print(
            "[red]❌ Agent functionality not available. Install with: uv sync --extra agent[/red]"
        )
        return

    try:
        agent = get_smithy_agent()
        console.print("[blue]🤖 Running AI-powered code quality analysis...[/blue]")
        result = asyncio.run(agent.run_quality_crew())

        if "error" in result:
            console.print(f"[red]❌ {result['error']}[/red]")
        else:
            console.print("[green]✅ AI Quality Analysis Complete:[/green]")
            console.print(result.get("quality_report", "No report available"))
    except Exception as e:
        console.print(f"[red]❌ Agent quality check failed: {e}[/red]")


@app.command()
def compliance():
    """Check dependency compliance against policies."""
    try:
        compliant, violations = controls.check_compliance()

        if compliant:
            console.print("[green]✅ All dependencies are compliant![/green]")
        else:
            console.print("[red]❌ Compliance violations found:[/red]")
            for violation in violations:
                console.print(
                    f"  • [{violation.severity.upper()}] {violation.package}: {violation.violation}"
                )
                if violation.suggestion:
                    console.print(f"    💡 {violation.suggestion}")

    except Exception as e:
        console.print(f"[red]❌ Compliance check failed: {e}[/red]")


@app.command()
def compliance_report():
    """Generate detailed compliance report."""
    try:
        manager = controls.ComplianceManager()
        report = manager.generate_compliance_report()
        console.print(report)
    except Exception as e:
        console.print(f"[red]❌ Report generation failed: {e}[/red]")


@app.command()
def check_updates(environments: str = "dev"):
    """Check for available dependency updates."""
    try:
        env_list = [env.strip() for env in environments.split(",")]
        manager = controls.UpdateManager()
        updates = manager.check_for_updates(env_list)

        if not updates:
            console.print("[green]✅ All dependencies are up to date![/green]")
            return

        for env, env_updates in updates.items():
            console.print(f"[blue]📦 Updates available for {env} environment:[/blue]")
            for update in env_updates:
                breaking = " ⚠️ BREAKING" if update.breaking_changes else ""
                security = " 🔒 SECURITY" if update.security_fixes else ""
                console.print(
                    f"  • {update.package}: {update.old_version} → {update.new_version}{breaking}{security}"
                )

    except Exception as e:
        console.print(f"[red]❌ Update check failed: {e}[/red]")


@app.command()
def schedule_updates_cmd(frequency: str = "weekly", time_of_day: str = "02:00"):
    """Schedule automated dependency updates."""
    try:
        success = controls.schedule_updates(frequency, time_of_day)
        if success:
            console.print(
                f"[green]✅ Update schedule created: {frequency} at {time_of_day}[/green]"
            )
        else:
            console.print("[red]❌ Failed to create update schedule[/red]")
    except Exception as e:
        console.print(f"[red]❌ Schedule creation failed: {e}[/red]")


@app.command()
def add_policy(name: str, description: str, rules: str):
    """Add a custom dependency policy."""
    try:
        rules_dict = json.loads(rules)
        success = controls.create_dependency_policy(name, description, rules_dict)

        if success:
            console.print(f"[green]✅ Policy '{name}' added successfully[/green]")
        else:
            console.print(f"[red]❌ Failed to add policy '{name}'[/red]")

    except json.JSONDecodeError:
        console.print("[red]❌ Invalid JSON format for rules[/red]")
    except Exception as e:
        console.print(f"[red]❌ Policy creation failed: {e}[/red]")


@app.command()
def list_policies():
    """List all dependency policies."""
    try:
        engine = controls.PolicyEngine()
        console.print("[blue]📋 Active Dependency Policies:[/blue]")

        for policy_name, policy in engine.policies.items():
            status = "[green]✅ Enabled[/green]" if policy.enabled else "[red]❌ Disabled[/red]"
            console.print(f"  • [bold]{policy_name}[/bold]: {policy.description} ({status})")

    except Exception as e:
        console.print(f"[red]❌ Failed to list policies: {e}[/red]")


@app.command()
def biome_check(files: Optional[List[str]] = None, staged: bool = False, verbose: bool = False):
    """Run Biome linting and formatting checks."""
    try:
        success, output = biome.run_biome_check(files=files, staged_only=staged)

        if success:
            console.print("[green]✅ Biome check passed![/green]")
        else:
            console.print("[red]❌ Biome check failed:[/red]")
            console.print(output)

    except Exception as e:
        console.print(f"[red]❌ Biome check failed: {e}[/red]")


@app.command()
def biome_fix(files: Optional[List[str]] = None, staged: bool = False, unsafe: bool = False):
    """Auto-fix Biome linting and formatting issues."""
    try:
        success, output = biome.run_biome_fix(files=files, staged_only=staged, unsafe=unsafe)

        if success:
            console.print("[green]✅ Biome fix completed![/green]")
            if output.strip():
                console.print(output)
        else:
            console.print("[red]❌ Biome fix failed:[/red]")
            console.print(output)

    except Exception as e:
        console.print(f"[red]❌ Biome fix failed: {e}[/red]")


@app.command()
def biome_format(files: Optional[List[str]] = None, check: bool = False):
    """Format code with Biome."""
    try:
        success, output = biome.run_biome_format(files=files, check_only=check)

        if check:
            if success:
                console.print("[green]✅ Code is properly formatted![/green]")
            else:
                console.print("[red]❌ Code formatting issues found:[/red]")
                console.print(output)
        else:
            if success:
                console.print("[green]✅ Code formatting completed![/green]")
                if output.strip():
                    console.print(output)
            else:
                console.print("[red]❌ Code formatting failed:[/red]")
                console.print(output)

    except Exception as e:
        console.print(f"[red]❌ Biome format failed: {e}[/red]")


@app.command()
def biome_imports(files: Optional[List[str]] = None):
    """Organize imports with Biome."""
    try:
        success, output = biome.run_biome_imports(files=files)

        if success:
            console.print("[green]✅ Import organization completed![/green]")
            if output.strip():
                console.print(output)
        else:
            console.print("[red]❌ Import organization failed:[/red]")
            console.print(output)

    except Exception as e:
        console.print(f"[red]❌ Biome imports failed: {e}[/red]")


@app.command()
def biome_init_config(force: bool = False):
    """Initialize Biome configuration file."""
    try:
        manager = biome.BiomeManager()
        success = manager.init_config(force=force)

        if success:
            if force:
                console.print("[green]✅ Biome configuration updated![/green]")
            else:
                console.print("[green]✅ Biome configuration initialized![/green]")
            console.print(f"Configuration file: {manager.config_file}")
        else:
            console.print("[red]❌ Failed to initialize Biome configuration[/red]")

    except Exception as e:
        console.print(f"[red]❌ Biome config initialization failed: {e}[/red]")


@app.command()
def biome_diagnostics():
    """Show Biome diagnostics and status."""
    try:
        manager = biome.BiomeManager()
        diagnostics = manager.get_diagnostics()

        console.print("[blue]🔍 Biome Diagnostics:[/blue]")
        console.print(f"  Available: {'✅ Yes' if diagnostics['available'] else '❌ No'}")
        console.print(f"  Version: {diagnostics['version'] or 'N/A'}")
        console.print(f"  Config Valid: {'✅ Yes' if diagnostics['config_valid'] else '❌ No'}")
        console.print(f"  Config Path: {diagnostics['config_path']}")
        console.print(f"  Workspace Root: {diagnostics['workspace_root']}")

        if not diagnostics["available"]:
            console.print("\n[yellow]💡 To install Biome:[/yellow]")
            console.print("  pip install biome>=1.9.4")
            console.print("  # or")
            console.print("  npm install -g @biomejs/biome")

    except Exception as e:
        console.print(f"[red]❌ Failed to get Biome diagnostics: {e}[/red]")


@app.command()
def env_validate(service: Optional[str] = None):
    """Validate environment configuration and secrets for services."""
    try:
        validator = env_validator.EnvironmentValidator()
        if service:
            result = validator.validate_service(service)
            if result.errors:
                console.print(f"[red]❌ {service} validation failed:[/red]")
                for error in result.errors:
                    console.print(f"  • {error.key}: {error.message}")
                    if error.suggestion:
                        console.print(f"    💡 {error.suggestion}")
                raise typer.Exit(1)
            else:
                console.print(f"[green]✅ {service} validation passed[/green]")
                if result.warnings:
                    console.print("[yellow]⚠️  Warnings:[/yellow]")
                    for warning in result.warnings:
                        console.print(f"  • {warning.key}: {warning.message}")
                        if warning.suggestion:
                            console.print(f"    💡 {warning.suggestion}")
        else:
            results = validator.validate_all_services()
            has_errors = False

            for svc, result in results.items():
                status = "✅" if result.is_valid else "❌"
                console.print(
                    f"{status} {svc}: {len(result.errors)} errors, {len(result.warnings)} warnings"
                )

                if result.errors:
                    has_errors = True
                    for error in result.errors:
                        console.print(f"  ❌ {error.key}: {error.message}")

                if result.warnings:
                    for warning in result.warnings:
                        console.print(f"  ⚠️  {warning.key}: {warning.message}")

            if has_errors:
                console.print("\n[red]❌ Some services have validation errors[/red]")
                raise typer.Exit(1)
            else:
                console.print("\n[green]🎉 All services validated successfully![/green]")

    except Exception as e:
        console.print(f"[red]❌ Environment validation failed: {e}[/red]")
        raise typer.Exit(1)


@app.command()
def env_sync(services: Optional[List[str]] = None):
    """Sync .env.example files with available secrets."""
    try:
        validator = env_validator.EnvironmentValidator()
        results = validator.sync_env_examples(services)

        console.print("[blue]🔄 Syncing .env.example files...[/blue]")
        for service, success in results.items():
            status = "✅" if success else "❌"
            console.print(f"{status} {service}")

    except Exception as e:
        console.print(f"[red]❌ Environment sync failed: {e}[/red]")
        raise typer.Exit(1)


@app.command()
def env_report():
    """Generate CI-friendly environment validation report."""
    try:
        validator = env_validator.EnvironmentValidator()
        report = validator.generate_ci_secrets_report()
        console.print(report)

        # Check if validation passed
        results = validator.validate_all_services()
        has_errors = any(not result.is_valid for result in results.values())
        if has_errors:
            raise typer.Exit(1)

    except Exception as e:
        console.print(f"[red]❌ Report generation failed: {e}[/red]")
        raise typer.Exit(1)


if __name__ == "__main__":
    app()
