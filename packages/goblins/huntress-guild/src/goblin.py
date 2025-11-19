"""
Huntress Guild Goblin Implementation

Implements the GoblinInterface for flaky test hunts, regression triage, and signal scouting.
"""

import logging
from typing import Optional

from goblinos.interface import (
    GoblinConfig,
    GoblinContext,
    GoblinResult,
    GoblinCapabilities,
)
from .logic import HuntressGuildLogic
from .schema import HuntressGuildConfig


class HuntressGuildGoblin:
    """Huntress Guild Goblin - Test analysis and incident management."""

    def __init__(self):
        self.logic: Optional[HuntressGuildLogic] = None
        self._config: Optional[GoblinConfig] = None
        self._logger: Optional[logging.Logger] = None

    async def initialize(self, config: GoblinConfig) -> None:
        """Initialize the huntress guild goblin."""
        self._config = config
        self._logger = config.logger or logging.getLogger("huntress-guild")

        if self._logger:
            self._logger.info("Initializing Huntress Guild Goblin")

        # Load goblin-specific configuration
        goblin_config = HuntressGuildConfig()
        if config.config:
            goblin_config = HuntressGuildConfig(**config.config)

        self.logic = HuntressGuildLogic(goblin_config)
        await self.logic.initialize(config)

    async def execute(self, context: GoblinContext) -> GoblinResult:
        """Execute huntress guild operations."""
        if not self.logic:
            raise RuntimeError("Huntress Guild Goblin not initialized")

        try:
            if self._logger:
                self._logger.info(
                    "Executing Huntress Guild operation", extra={"input": context.input}
                )

            result = await self.logic.execute(context)

            if self._logger:
                self._logger.info(
                    "Huntress Guild operation completed",
                    extra={"success": result.success},
                )

            return result

        except Exception as error:
            if self._logger:
                self._logger.error("Huntress Guild operation failed", exc_info=error)

            return GoblinResult(
                success=False, error=error, metadata={"execution_time": None}
            )

    async def shutdown(self) -> None:
        """Shutdown the huntress guild goblin."""
        if self._logger:
            self._logger.info("Shutting down Huntress Guild Goblin")

        if self.logic:
            await self.logic.shutdown()

        self.logic = None
        self._config = None
        self._logger = None

    def get_capabilities(self) -> GoblinCapabilities:
        """Get huntress guild capabilities."""
        return GoblinCapabilities(
            name="Huntress Guild",
            description="Flaky test hunts, regression triage, incident tagging; early-signal scouting, log mining, trend surfacing",
            version="0.1.0",
            input_schema={
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "enum": [
                            "analyze_tests",
                            "triage_regression",
                            "scout_signals",
                            "report_incidents",
                        ],
                    },
                    "test_results": {"type": "object"},
                    "commit_hash": {"type": "string"},
                    "log_files": {"type": "array", "items": {"type": "string"}},
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
                    "incidents": {"type": "array"},
                },
            },
            tags=["testing", "analysis", "monitoring", "incident-management"],
        )
