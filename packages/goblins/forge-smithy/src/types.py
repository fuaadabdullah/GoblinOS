"""
Type definitions for Forge Smithy Goblin
"""

from typing import Any, Dict, List, Optional
from enum import Enum
from pydantic import BaseModel


class EnvironmentType(str, Enum):
    """Types of environments that can be managed."""

    DEVELOPMENT = "development"
    PRODUCTION = "production"
    TESTING = "testing"


class BootstrapMode(str, Enum):
    """Bootstrap modes for environment setup."""

    FULL = "full"
    MINIMAL = "minimal"
    DEV = "dev"


class CheckResult(BaseModel):
    """Result of a health/environment check."""

    name: str
    passed: bool
    message: str
    details: Optional[Dict[str, Any]] = None
    remediation: Optional[str] = None


class BootstrapResult(BaseModel):
    """Result of a bootstrap operation."""

    success: bool
    steps_completed: List[str]
    errors: List[str]
    warnings: List[str]


class DoctorResult(BaseModel):
    """Result of doctor diagnostics."""

    overall_health: str  # "healthy", "warning", "critical"
    checks: List[CheckResult]
    summary: str


class ForgeSmithyInput(BaseModel):
    """Input for Forge Smithy operations."""

    command: str  # "bootstrap", "doctor", "check", "sync_config"
    mode: Optional[BootstrapMode] = None
    environment: Optional[EnvironmentType] = None
    options: Optional[Dict[str, Any]] = None


class ForgeSmithyOutput(BaseModel):
    """Output from Forge Smithy operations."""

    command: str
    success: bool
    result: Optional[Any] = None  # Can be DoctorResult, BootstrapResult, etc.
    message: str
    execution_time: float
