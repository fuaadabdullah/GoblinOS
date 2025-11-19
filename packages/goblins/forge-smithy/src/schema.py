"""
Data models and validation schemas for Forge Smithy Goblin
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from .types import EnvironmentType, BootstrapMode


class ConfigSchema(BaseModel):
    """Configuration schema for Forge Smithy."""

    environment: EnvironmentType = Field(default=EnvironmentType.DEVELOPMENT)
    python_version: str = Field(default="3.10")
    uv_version: Optional[str] = None
    node_version: Optional[str] = None
    enable_pre_commit: bool = Field(default=True)
    enable_devcontainer: bool = Field(default=True)
    enable_biome: bool = Field(default=True)
    enable_ruff: bool = Field(default=True)
    enable_mypy: bool = Field(default=True)
    enable_pytest: bool = Field(default=True)
    custom_dependencies: List[str] = Field(default_factory=list)
    custom_scripts: Dict[str, str] = Field(default_factory=dict)


class BootstrapConfig(BaseModel):
    """Configuration for bootstrap operations."""

    mode: BootstrapMode = Field(default=BootstrapMode.DEV)
    skip_pre_commit: bool = Field(default=False)
    skip_devcontainer: bool = Field(default=False)
    skip_biome: bool = Field(default=False)
    additional_deps: List[str] = Field(default_factory=list)


class CheckConfig(BaseModel):
    """Configuration for check operations."""

    strict: bool = Field(default=False)
    include_optional: bool = Field(default=True)
    timeout: int = Field(default=300)  # seconds
