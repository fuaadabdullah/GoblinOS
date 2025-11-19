"""
GoblinOS Shared Interfaces

Base interfaces and classes for GoblinOS goblins.
Provides standardized lifecycle management for modular goblin architecture.
"""

from .interface import (
    GoblinInterface,
    BaseGoblin,
    GoblinConfig,
    GoblinContext,
    GoblinResult,
    GoblinCapabilities,
)

__version__ = "0.1.0"

__all__ = [
    "GoblinInterface",
    "BaseGoblin",
    "GoblinConfig",
    "GoblinContext",
    "GoblinResult",
    "GoblinCapabilities",
]
