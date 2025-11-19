"""
GoblinOS Shared Interfaces

Base interfaces and classes for GoblinOS goblins.
Provides standardized lifecycle management for modular goblin architecture.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Protocol
from dataclasses import dataclass
import logging
from pydantic import BaseModel


@dataclass
class GoblinConfig:
    """Configuration for a goblin instance."""
    id: str
    config: Optional[Dict[str, Any]] = None
    logger: Optional[logging.Logger] = None
    working_dir: Optional[str] = None


@dataclass
class GoblinContext:
    """Execution context for a goblin."""
    input: Optional[Any] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class GoblinResult:
    """Result of a goblin execution."""
    success: bool
    output: Optional[Any] = None
    error: Optional[Exception] = None
    metadata: Optional[Dict[str, Any]] = None


class GoblinCapabilities(BaseModel):
    """Capabilities and metadata for a goblin."""
    name: str
    description: str
    version: str
    input_schema: Optional[Dict[str, Any]] = None
    output_schema: Optional[Dict[str, Any]] = None
    tags: Optional[list[str]] = None


class GoblinInterface(Protocol):
    """
    Protocol that all goblins must implement.

    Provides standardized lifecycle management and execution.
    """

    @abstractmethod
    async def initialize(self, config: GoblinConfig) -> None:
        """
        Initialize the goblin with configuration.

        Called once when the goblin is first loaded.

        Args:
            config: Configuration for the goblin
        """
        ...

    @abstractmethod
    async def execute(self, context: GoblinContext) -> GoblinResult:
        """
        Execute the goblin's primary function.

        Can be called multiple times with different inputs.

        Args:
            context: Execution context including input data

        Returns:
            Result of the execution
        """
        ...

    @abstractmethod
    async def shutdown(self) -> None:
        """
        Shutdown the goblin and clean up resources.

        Called when the goblin is no longer needed.
        """
        ...

    @abstractmethod
    def get_capabilities(self) -> GoblinCapabilities:
        """
        Get information about the goblin's capabilities.

        Used for discovery and validation.

        Returns:
            Capabilities metadata
        """
        ...


class BaseGoblin(ABC):
    """
    Abstract base class providing common goblin functionality.

    Goblins can inherit from this class instead of implementing the protocol directly.
    """

    def __init__(self):
        self._config: Optional[GoblinConfig] = None
        self._logger: Optional[logging.Logger] = None

    async def initialize(self, config: GoblinConfig) -> None:
        """Initialize the goblin with configuration."""
        self._config = config
        self._logger = config.logger

        if self._logger:
            self._logger.info(f"Initializing goblin {config.id}")

        await self.on_initialize(config)

    async def execute(self, context: GoblinContext) -> GoblinResult:
        """Execute the goblin with error handling."""
        try:
            if self._logger:
                self._logger.info(f"Executing goblin {self._config.id if self._config else 'unknown'}",
                                extra={"input": context.input})

            result = await self.on_execute(context)

            if self._logger:
                self._logger.info(f"Goblin {self._config.id if self._config else 'unknown'} execution completed",
                                extra={"success": result.success, "has_output": result.output is not None})

            return result

        except Exception as error:
            if self._logger:
                self._logger.error(f"Goblin {self._config.id if self._config else 'unknown'} execution failed",
                                 exc_info=error)

            return GoblinResult(
                success=False,
                error=error,
                metadata={"execution_time": None}  # Could add timing here
            )

    async def shutdown(self) -> None:
        """Shutdown the goblin."""
        if self._logger:
            self._logger.info(f"Shutting down goblin {self._config.id if self._config else 'unknown'}")

        await self.on_shutdown()
        self._config = None
        self._logger = None

    @abstractmethod
    def get_capabilities(self) -> GoblinCapabilities:
        """Get goblin capabilities."""
        ...

    @abstractmethod
    async def on_initialize(self, config: GoblinConfig) -> None:
        """Subclass-specific initialization logic."""
        ...

    @abstractmethod
    async def on_execute(self, context: GoblinContext) -> GoblinResult:
        """Subclass-specific execution logic."""
        ...

    async def on_shutdown(self) -> None:
        """Subclass-specific shutdown logic."""
        pass


__all__ = [
    "GoblinInterface",
    "BaseGoblin",
    "GoblinConfig",
    "GoblinContext",
    "GoblinResult",
    "GoblinCapabilities"
]