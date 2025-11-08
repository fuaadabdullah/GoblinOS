"""Plugin ecosystem primitives for Smithy automation."""

from .base import (
    ExtensionPoint,
    ExtensionRegistry,
    PluginCapability,
    PluginContext,
    PluginManifest,
    PluginMetadata,
    SmithyPlugin,
)
from .manager import PluginManager
from .registry import PluginRecord, PluginRegistry
from .sandbox import PluginSandbox, SandboxPolicy
from .templates import PluginTemplateGenerator

__all__ = [
    "PluginCapability",
    "PluginManifest",
    "PluginMetadata",
    "PluginContext",
    "ExtensionPoint",
    "ExtensionRegistry",
    "SmithyPlugin",
    "PluginManager",
    "PluginRegistry",
    "PluginRecord",
    "PluginSandbox",
    "SandboxPolicy",
    "PluginTemplateGenerator",
]
