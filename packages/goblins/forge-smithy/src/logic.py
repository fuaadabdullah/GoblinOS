"""
Core logic for Forge Smithy Goblin

Contains the business logic for environment management, bootstrapping, diagnostics, and tooling.
"""

import asyncio
import json
import pathlib
import shutil
import subprocess
import sys
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass

from goblinos.interface import GoblinConfig, GoblinContext, GoblinResult
from .types import (
    CheckResult,
    BootstrapResult,
    DoctorResult,
    ForgeSmithyInput,
    ForgeSmithyOutput,
    BootstrapMode,
)


@dataclass
class ForgeSmithyLogic:
    """Core logic implementation for Forge Smithy Goblin."""

    config: Optional[GoblinConfig] = None

    async def initialize(self, config: GoblinConfig) -> None:
        """Initialize the goblin logic with configuration."""
        self.config = config

    async def execute(self, context: GoblinContext) -> GoblinResult:
        """Execute the requested smithy operation."""
        try:
            if not context.input:
                return GoblinResult(
                    success=False,
                    error=ValueError("No input provided"),
                    message="Input is required for smithy operations",
                )

            # Parse input
            smithy_input = self._parse_input(context.input)

            # Execute the requested command
            result = await self._execute_command(smithy_input)

            return GoblinResult(
                success=result.success,
                output=result,
                metadata={"message": result.message, "execution_time": result.execution_time},
            )

        except Exception as e:
            return GoblinResult(
                success=False, error=e, metadata={"message": f"Smithy operation failed: {str(e)}"}
            )

    async def shutdown(self) -> None:
        """Shutdown the goblin logic."""
        pass

    def _parse_input(self, input_data: Any) -> ForgeSmithyInput:
        """Parse input data into ForgeSmithyInput."""
        if isinstance(input_data, dict):
            return ForgeSmithyInput(**input_data)
        elif isinstance(input_data, str):
            # Simple string command
            return ForgeSmithyInput(command=input_data)
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def _execute_command(self, smithy_input: ForgeSmithyInput) -> ForgeSmithyOutput:
        """Execute the specified smithy command."""
        start_time = asyncio.get_event_loop().time()

        try:
            if smithy_input.command == "bootstrap":
                result = await self._bootstrap(smithy_input)
            elif smithy_input.command == "doctor":
                result = await self._doctor(smithy_input)
            elif smithy_input.command == "check":
                result = await self._check(smithy_input)
            elif smithy_input.command == "sync_config":
                result = await self._sync_config(smithy_input)
            else:
                raise ValueError(f"Unknown command: {smithy_input.command}")

            execution_time = asyncio.get_event_loop().time() - start_time

            # Determine success and message based on result type
            if isinstance(result, BootstrapResult):
                success = result.success
                message = f"Bootstrap completed with {len(result.steps_completed)} steps"
            elif isinstance(result, DoctorResult):
                success = result.overall_health == "healthy"
                message = result.summary
            elif isinstance(result, dict):
                # For check command
                success = all(
                    v.get("passed", False) for v in result.values() if isinstance(v, dict)
                )
                message = f"Check completed with {len(result)} checks"
            else:
                success = True
                message = "Command completed successfully"

            return ForgeSmithyOutput(
                command=smithy_input.command,
                success=success,
                result=result,
                message=message,
                execution_time=execution_time,
            )

        except Exception as e:
            execution_time = asyncio.get_event_loop().time() - start_time
            return ForgeSmithyOutput(
                command=smithy_input.command,
                success=False,
                result=None,
                message=f"Command failed: {str(e)}",
                execution_time=execution_time,
            )

    async def _bootstrap(self, smithy_input: ForgeSmithyInput) -> BootstrapResult:
        """Bootstrap the development environment."""
        mode = smithy_input.mode or BootstrapMode.DEV
        root = self._get_project_root()

        steps_completed = []
        errors = []
        warnings = []

        try:
            # 1) Create Python virtual environment via uv
            print("📦 Creating virtual environment...")
            await self._run_command(["uv", "venv", ".venv"], cwd=root)
            steps_completed.append("Created virtual environment")

            # 2) Install dependencies via uv
            print("📦 Installing dependencies...")
            if mode == BootstrapMode.DEV:
                await self._run_command(["uv", "sync", "--dev"], cwd=root)
            else:
                await self._run_command(["uv", "sync"], cwd=root)
            steps_completed.append("Installed dependencies")

            # 3) Install pre-commit hooks (if enabled)
            if mode != BootstrapMode.MINIMAL:
                print("🔗 Installing pre-commit hooks...")
                await self._run_command(["pre-commit", "install"], cwd=root)
                steps_completed.append("Installed pre-commit hooks")

            # 4) Create .devcontainer (if enabled)
            if mode == BootstrapMode.FULL:
                await self._create_devcontainer(root)
                steps_completed.append("Created devcontainer")

            # 5) Create .env from template
            await self._create_env_file(root)
            steps_completed.append("Created environment file")

            return BootstrapResult(
                success=True, steps_completed=steps_completed, errors=errors, warnings=warnings
            )

        except Exception as e:
            errors.append(str(e))
            return BootstrapResult(
                success=False, steps_completed=steps_completed, errors=errors, warnings=warnings
            )

    async def _doctor(self, smithy_input: ForgeSmithyInput) -> DoctorResult:
        """Run comprehensive environment diagnostics."""
        checks = await self._run_diagnostic_checks()

        # Determine overall health
        failed_checks = [c for c in checks if not c.passed]
        if any(c.name in ["python", "python_version"] for c in failed_checks):
            overall_health = "critical"
        elif failed_checks:
            overall_health = "warning"
        else:
            overall_health = "healthy"

        summary = f"Found {len(failed_checks)} failed checks out of {len(checks)} total checks"

        return DoctorResult(overall_health=overall_health, checks=checks, summary=summary)

    async def _check(self, smithy_input: ForgeSmithyInput) -> Dict[str, Any]:
        """Run repo hygiene checks."""
        results = {}

        # Run linting
        results["lint"] = await self._run_lint_check()

        # Run type checking
        results["type_check"] = await self._run_type_check()

        # Run tests
        results["tests"] = await self._run_test_check()

        # Check dependencies
        results["dependencies"] = await self._run_dependency_check()

        # Check biome (if available)
        results["biome"] = await self._run_biome_check()

        success = all(r.get("passed", False) for r in results.values())

        return {
            "success": success,
            "results": results,
            "message": "All checks passed" if success else "Some checks failed",
        }

    async def _sync_config(self, smithy_input: ForgeSmithyInput) -> Dict[str, Any]:
        """Sync configuration files."""
        root = self._get_project_root()

        # Sync .env with .env.example
        env_path = root / ".env"
        example_env = root / ".env.example"

        if example_env.exists() and not env_path.exists():
            env_path.write_text(example_env.read_text())
            return {"success": True, "message": "Created .env from template"}
        elif env_path.exists():
            return {"success": True, "message": ".env already exists"}
        else:
            return {"success": False, "message": ".env.example not found"}

    async def _run_diagnostic_checks(self) -> List[CheckResult]:
        """Run all diagnostic checks."""
        checks = []

        # Required tools
        required_tools = {
            "python": ["python3", "--version"],
            "uv": ["uv", "--version"],
            "git": ["git", "--version"],
            "pre-commit": ["pre-commit", "--version"],
            "ruff": ["ruff", "--version"],
            "pytest": ["pytest", "--version"],
        }

        for tool_name, cmd in required_tools.items():
            passed, message = await self._check_tool(tool_name, cmd)
            checks.append(
                CheckResult(
                    name=tool_name,
                    passed=passed,
                    message=message,
                    remediation=f"Install {tool_name}" if not passed else None,
                )
            )

        # Python version check
        passed, message = await self._check_python_version()
        checks.append(
            CheckResult(
                name="python_version",
                passed=passed,
                message=message,
                remediation="Upgrade to Python 3.10+" if not passed else None,
            )
        )

        return checks

    async def _check_tool(self, name: str, cmd: List[str]) -> Tuple[bool, str]:
        """Check if a tool is available."""
        if not shutil.which(cmd[0]):
            return False, f"Command '{cmd[0]}' not found in PATH"

        try:
            result = await self._run_command(cmd, capture_output=True)
            return True, result.stdout.strip() or result.stderr.strip()
        except Exception as e:
            return False, str(e)

    async def _check_python_version(self) -> Tuple[bool, str]:
        """Check Python version compatibility."""
        try:
            result = await self._run_command(
                [
                    "python3",
                    "-c",
                    "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')",
                ],
                capture_output=True,
            )
            version = result.stdout.strip()
            major, minor = map(int, version.split("."))
            if major >= 3 and minor >= 10:
                return True, f"Python {version} (compatible)"
            else:
                return False, f"Python {version} (requires Python 3.10+)"
        except Exception as e:
            return False, str(e)

    async def _run_lint_check(self) -> Dict[str, Any]:
        """Run linting checks."""
        try:
            root = self._get_project_root()
            result = await self._run_command(
                ["ruff", "check", "--fix", "."], cwd=root, capture_output=True
            )
            return {"passed": result.returncode == 0, "output": result.stdout + result.stderr}
        except Exception as e:
            return {"passed": False, "error": str(e)}

    async def _run_type_check(self) -> Dict[str, Any]:
        """Run type checking."""
        try:
            root = self._get_project_root()
            result = await self._run_command(["mypy", "."], cwd=root, capture_output=True)
            return {"passed": result.returncode == 0, "output": result.stdout + result.stderr}
        except FileNotFoundError:
            return {"passed": True, "output": "mypy not available (skipping)"}
        except Exception as e:
            return {"passed": False, "error": str(e)}

    async def _run_test_check(self) -> Dict[str, Any]:
        """Run test suite."""
        try:
            root = self._get_project_root()
            result = await self._run_command(
                [sys.executable, "-m", "pytest", "-v"], cwd=root, capture_output=True
            )
            return {"passed": result.returncode == 0, "output": result.stdout + result.stderr}
        except Exception as e:
            return {"passed": False, "error": str(e)}

    async def _run_dependency_check(self) -> Dict[str, Any]:
        """Check dependencies."""
        try:
            root = self._get_project_root()
            result = await self._run_command(["uv", "pip", "check"], cwd=root, capture_output=True)
            return {"passed": result.returncode == 0, "output": result.stdout + result.stderr}
        except FileNotFoundError:
            return {"passed": True, "output": "uv not available (skipping)"}
        except Exception as e:
            return {"passed": False, "error": str(e)}

    async def _run_biome_check(self) -> Dict[str, Any]:
        """Run biome checks if available."""
        try:
            from .biome import run_biome_check

            success, output = run_biome_check()
            return {"passed": success, "output": output}
        except ImportError:
            return {"passed": True, "output": "Biome not available (skipping)"}
        except Exception as e:
            return {"passed": False, "error": str(e)}

    async def _create_devcontainer(self, root: pathlib.Path) -> None:
        """Create .devcontainer configuration."""
        devc_path = root / ".devcontainer" / "devcontainer.json"
        if not devc_path.exists():
            devc_path.parent.mkdir(parents=True, exist_ok=True)
            devcontainer_config = {
                "name": "GoblinOS Forge Smithy",
                "image": "mcr.microsoft.com/devcontainers/python:3.11",
                "features": {
                    "ghcr.io/devcontainers/features/python:1": {},
                    "ghcr.io/devcontainers/features/node:1": {},
                },
                "customizations": {
                    "vscode": {
                        "extensions": [
                            "ms-python.python",
                            "ms-python.black-formatter",
                            "ms-python.mypy-type-checker",
                            "ms-python.pylint",
                            "ms-toolsai.jupyter",
                        ]
                    }
                },
                "postCreateCommand": "uv sync --dev",
            }
            devc_path.write_text(json.dumps(devcontainer_config, indent=2))

    async def _create_env_file(self, root: pathlib.Path) -> None:
        """Create .env file from template."""
        env_path = root / ".env"
        example_env = root / ".env.example"
        if example_env.exists() and not env_path.exists():
            env_path.write_text(example_env.read_text())

    def _get_project_root(self) -> pathlib.Path:
        """Get the project root directory."""
        if self.config and self.config.working_dir:
            return pathlib.Path(self.config.working_dir)
        # Default to the directory containing this file's parent
        return pathlib.Path(__file__).resolve().parents[2]

    async def _run_command(
        self,
        cmd: List[str],
        cwd: Optional[pathlib.Path] = None,
        capture_output: bool = False,
        timeout: int = 60,
    ) -> subprocess.CompletedProcess:
        """Run a command asynchronously."""
        if cwd is None:
            cwd = self._get_project_root()

        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: subprocess.run(
                cmd, cwd=cwd, capture_output=capture_output, text=True, check=True, timeout=timeout
            ),
        )
