"""
Forge Smithy Goblin - Main Implementation

Implements the GoblinInterface for environment management and tooling.
"""

import json
import pathlib
from typing import Optional

from goblinos.interface import (
    GoblinInterface,
    GoblinConfig,
    GoblinContext,
    GoblinResult,
    GoblinCapabilities,
)
from .logic import ForgeSmithyLogic
from .schema import ConfigSchema


class ForgeSmithyGoblin(GoblinInterface):
    """Forge Smithy Goblin for environment management and development tooling."""

    def __init__(self):
        self.logic = ForgeSmithyLogic()
        self.config: Optional[GoblinConfig] = None

    async def initialize(self, config: GoblinConfig) -> None:
        """Initialize the goblin with configuration."""
        self.config = config

        # Load and validate configuration
        goblin_config = self._load_config(config)

        # Initialize the logic
        await self.logic.initialize(config)

    async def execute(self, context: GoblinContext) -> GoblinResult:
        """Execute a smithy operation."""
        return await self.logic.execute(context)

    async def shutdown(self) -> None:
        """Shutdown the goblin."""
        await self.logic.shutdown()

    def get_capabilities(self) -> GoblinCapabilities:
        """Get goblin capabilities."""
        return GoblinCapabilities(
            name="Forge Smithy",
            description="Environment management, bootstrapping, and development tooling goblin",
            version="0.1.0",
            input_schema={
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "enum": ["bootstrap", "doctor", "check", "sync_config"],
                        "description": "The smithy command to execute",
                    },
                    "mode": {
                        "type": "string",
                        "enum": ["full", "minimal", "dev"],
                        "description": "Bootstrap mode (for bootstrap command)",
                    },
                    "environment": {
                        "type": "string",
                        "enum": ["development", "production", "testing"],
                        "description": "Target environment",
                    },
                    "options": {"type": "object", "description": "Additional command options"},
                },
                "required": ["command"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "command": {"type": "string"},
                    "success": {"type": "boolean"},
                    "result": {"type": "object"},
                    "message": {"type": "string"},
                    "execution_time": {"type": "number"},
                },
                "required": ["command", "success", "message", "execution_time"],
            },
        )

    def _load_config(self, config: GoblinConfig) -> ConfigSchema:
        """Load and validate goblin configuration."""
        # Load default config
        config_dir = pathlib.Path(__file__).parent.parent / "config"
        default_config_path = config_dir / "default.json"

        with open(default_config_path, "r") as f:
            default_config = json.load(f)

        # Merge with provided config
        if config.config:
            default_config.update(config.config)

        # Validate against schema
        schema_path = config_dir / "schema.json"
        if schema_path.exists():
            # TODO: Add JSON schema validation
            pass

        return ConfigSchema(**default_config)
