# forge-smithy: environment goblin core

from . import doctor, bootstrap, tasks, config, cli, dependencies, environments, packages, integration, controls, biome

# Optional agent imports
try:
    from . import agent
except ImportError:
    agent = None  # type: ignore

__version__ = "0.1.0"
__all__ = ["doctor", "bootstrap", "tasks", "config", "cli", "dependencies", "environments", "packages", "integration", "controls", "biome", "agent"]
