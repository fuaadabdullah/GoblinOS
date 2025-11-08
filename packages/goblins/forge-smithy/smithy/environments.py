"""Multi-environment management for Smithy."""

import subprocess
import json
import pathlib
import hashlib
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

ROOT = pathlib.Path(__file__).resolve().parents[1]

@dataclass
class EnvironmentConfig:
    """Configuration for a specific environment."""
    name: str
    python_version: str
    dependencies: List[str]
    dev_dependencies: List[str]
    environment_variables: Dict[str, str]
    description: Optional[str] = None

@dataclass
class EnvironmentLock:
    """Locked environment specification."""
    environment: str
    python_version: str
    packages: Dict[str, str]
    lock_date: str
    hash: str

@dataclass
class EnvironmentDiff:
    """Differences between two environments."""
    added_packages: List[str]
    removed_packages: List[str]
    updated_packages: Dict[str, Tuple[str, str]]  # package -> (old_version, new_version)
    added_env_vars: List[str]
    removed_env_vars: List[str]
    updated_env_vars: Dict[str, Tuple[str, str]]  # var -> (old_value, new_value)

class EnvironmentManager:
    """Multi-environment management system."""

    def __init__(self):
        self.root = ROOT
        self.environments_dir = self.root / ".smithy" / "environments"
        self.locks_dir = self.root / ".smithy" / "locks"
        self.environments_dir.mkdir(parents=True, exist_ok=True)
        self.locks_dir.mkdir(parents=True, exist_ok=True)

    def create_environment(self, config: EnvironmentConfig) -> bool:
        """Create a new environment configuration.

        Args:
            config: Environment configuration

        Returns:
            Success status
        """
        try:
            env_file = self.environments_dir / f"{config.name}.json"

            env_data = {
                "name": config.name,
                "python_version": config.python_version,
                "dependencies": config.dependencies,
                "dev_dependencies": config.dev_dependencies,
                "environment_variables": config.environment_variables,
                "description": config.description,
                "created_at": datetime.now().isoformat()
            }

            env_file.write_text(json.dumps(env_data, indent=2))
            return True

        except Exception:
            return False

    def list_environments(self) -> List[str]:
        """List all available environments.

        Returns:
            List of environment names
        """
        environments = []
        for env_file in self.environments_dir.glob("*.json"):
            environments.append(env_file.stem)
        return sorted(environments)

    def get_environment(self, name: str) -> Optional[EnvironmentConfig]:
        """Get environment configuration.

        Args:
            name: Environment name

        Returns:
            Environment configuration or None if not found
        """
        env_file = self.environments_dir / f"{name}.json"
        if not env_file.exists():
            return None

        try:
            data = json.loads(env_file.read_text())
            return EnvironmentConfig(
                name=data["name"],
                python_version=data["python_version"],
                dependencies=data.get("dependencies", []),
                dev_dependencies=data.get("dev_dependencies", []),
                environment_variables=data.get("environment_variables", {}),
                description=data.get("description")
            )
        except (json.JSONDecodeError, KeyError):
            return None

    def activate_environment(self, name: str, dev: bool = True) -> Tuple[bool, str]:
        """Activate an environment by installing its dependencies.

        Args:
            name: Environment name
            dev: Whether to install dev dependencies

        Returns:
            Tuple of (success, message)
        """
        config = self.get_environment(name)
        if not config:
            return False, f"Environment '{name}' not found"

        try:
            # Create virtual environment if it doesn't exist
            venv_path = self.root / ".venv"
            if not venv_path.exists():
                subprocess.run(["uv", "venv", ".venv"], check=True, cwd=self.root)

            # Install dependencies
            if config.dependencies:
                deps_str = " ".join(config.dependencies)
                subprocess.run(
                    ["uv", "pip", "install", deps_str],
                    check=True,
                    cwd=self.root
                )

            # Install dev dependencies
            if dev and config.dev_dependencies:
                dev_deps_str = " ".join(config.dev_dependencies)
                subprocess.run(
                    ["uv", "pip", "install", dev_deps_str],
                    check=True,
                    cwd=self.root
                )

            # Set environment variables
            if config.environment_variables:
                env_file = self.root / ".env"
                existing_env = {}
                if env_file.exists():
                    for line in env_file.read_text().split('\n'):
                        if '=' in line and not line.startswith('#'):
                            key, value = line.split('=', 1)
                            existing_env[key.strip()] = value.strip()

                # Update with environment variables
                existing_env.update(config.environment_variables)

                # Write back to .env
                env_content = "\n".join(f"{k}={v}" for k, v in existing_env.items())
                env_file.write_text(env_content)

            return True, f"Environment '{name}' activated successfully"

        except subprocess.CalledProcessError as e:
            return False, f"Failed to activate environment: {e}"

    def lock_environment(self, name: str) -> Tuple[bool, Optional[EnvironmentLock]]:
        """Lock current environment state.

        Args:
            name: Environment name to lock

        Returns:
            Tuple of (success, lock data)
        """
        try:
            # Get current installed packages
            result = subprocess.run(
                ["uv", "pip", "list", "--format", "json"],
                capture_output=True,
                text=True,
                cwd=self.root,
                check=True
            )

            packages = {}
            if result.stdout.strip():
                packages_data = json.loads(result.stdout)
                for pkg in packages_data:
                    packages[pkg["name"]] = pkg["version"]

            # Get Python version
            result = subprocess.run(
                ["python", "--version"],
                capture_output=True,
                text=True,
                cwd=self.root,
                check=True
            )
            python_version = result.stdout.strip().split()[1]

            # Create lock data
            lock_data = {
                "environment": name,
                "python_version": python_version,
                "packages": packages,
                "lock_date": datetime.now().isoformat()
            }

            # Generate hash for integrity checking
            lock_content = json.dumps(lock_data, sort_keys=True)
            lock_hash = hashlib.sha256(lock_content.encode()).hexdigest()
            lock_data["hash"] = lock_hash

            # Save lock file
            lock_file = self.locks_dir / f"{name}.lock"
            lock_file.write_text(json.dumps(lock_data, indent=2))

            lock_obj = EnvironmentLock(**lock_data)
            return True, lock_obj

        except (subprocess.CalledProcessError, json.JSONDecodeError):
            return False, None

    def verify_lock(self, name: str) -> Tuple[bool, str]:
        """Verify environment matches its lock file.

        Args:
            name: Environment name

        Returns:
            Tuple of (matches, message)
        """
        lock_file = self.locks_dir / f"{name}.lock"
        if not lock_file.exists():
            return False, f"No lock file found for environment '{name}'"

        try:
            # Load lock data
            lock_data = json.loads(lock_file.read_text())

            # Get current state
            success, current_lock = self.lock_environment(name)
            if not success or not current_lock:
                return False, "Failed to get current environment state"

            # Compare
            if lock_data["hash"] == current_lock.hash:
                return True, "Environment matches lock file"
            else:
                return False, "Environment does not match lock file"

        except json.JSONDecodeError:
            return False, "Invalid lock file format"

    def diff_environments(self, env1: str, env2: str) -> Optional[EnvironmentDiff]:
        """Compare two environments.

        Args:
            env1: First environment name
            env2: Second environment name

        Returns:
            Environment differences or None if comparison fails
        """
        config1 = self.get_environment(env1)
        config2 = self.get_environment(env2)

        if not config1 or not config2:
            return None

        # Compare packages
        packages1 = set(config1.dependencies + config1.dev_dependencies)
        packages2 = set(config2.dependencies + config2.dev_dependencies)

        added_packages = list(packages2 - packages1)
        removed_packages = list(packages1 - packages2)

        # For updated packages, we'd need version info from lock files
        updated_packages = {}

        # Compare environment variables
        env_vars1 = set(config1.environment_variables.keys())
        env_vars2 = set(config2.environment_variables.keys())

        added_env_vars = list(env_vars2 - env_vars1)
        removed_env_vars = list(env_vars1 - env_vars2)

        updated_env_vars = {}
        for var in env_vars1 & env_vars2:
            val1 = config1.environment_variables[var]
            val2 = config2.environment_variables[var]
            if val1 != val2:
                updated_env_vars[var] = (val1, val2)

        return EnvironmentDiff(
            added_packages=added_packages,
            removed_packages=removed_packages,
            updated_packages=updated_packages,
            added_env_vars=added_env_vars,
            removed_env_vars=removed_env_vars,
            updated_env_vars=updated_env_vars
        )

    def export_environment(self, name: str, output_file: pathlib.Path) -> bool:
        """Export environment configuration to a file.

        Args:
            name: Environment name
            output_file: Output file path

        Returns:
            Success status
        """
        config = self.get_environment(name)
        if not config:
            return False

        try:
            env_data = {
                "name": config.name,
                "python_version": config.python_version,
                "dependencies": config.dependencies,
                "dev_dependencies": config.dev_dependencies,
                "environment_variables": config.environment_variables,
                "description": config.description,
                "exported_at": datetime.now().isoformat()
            }

            output_file.write_text(json.dumps(env_data, indent=2))
            return True

        except Exception:
            return False

    def import_environment(self, input_file: pathlib.Path) -> bool:
        """Import environment configuration from a file.

        Args:
            input_file: Input file path

        Returns:
            Success status
        """
        if not input_file.exists():
            return False

        try:
            data = json.loads(input_file.read_text())

            config = EnvironmentConfig(
                name=data["name"],
                python_version=data["python_version"],
                dependencies=data.get("dependencies", []),
                dev_dependencies=data.get("dev_dependencies", []),
                environment_variables=data.get("environment_variables", {}),
                description=data.get("description")
            )

            return self.create_environment(config)

        except (json.JSONDecodeError, KeyError):
            return False

def create_environment(name: str, python_version: str = "3.11",
                      dependencies: Optional[List[str]] = None,
                      dev_dependencies: Optional[List[str]] = None,
                      environment_variables: Optional[Dict[str, str]] = None,
                      description: Optional[str] = None) -> bool:
    """Convenience function to create an environment.

    Args:
        name: Environment name
        python_version: Python version requirement
        dependencies: List of dependencies
        dev_dependencies: List of dev dependencies
        environment_variables: Environment variables
        description: Environment description

    Returns:
        Success status
    """
    if dependencies is None:
        dependencies = []
    if dev_dependencies is None:
        dev_dependencies = []
    if environment_variables is None:
        environment_variables = {}

    config = EnvironmentConfig(
        name=name,
        python_version=python_version,
        dependencies=dependencies,
        dev_dependencies=dev_dependencies,
        environment_variables=environment_variables,
        description=description
    )

    manager = EnvironmentManager()
    return manager.create_environment(config)

def activate_environment(name: str, dev: bool = True) -> Tuple[bool, str]:
    """Convenience function to activate an environment.

    Args:
        name: Environment name
        dev: Whether to install dev dependencies

    Returns:
        Tuple of (success, message)
    """
    manager = EnvironmentManager()
    return manager.activate_environment(name, dev)

def list_environments() -> List[str]:
    """Convenience function to list environments.

    Returns:
        List of environment names
    """
    manager = EnvironmentManager()
    return manager.list_environments()
