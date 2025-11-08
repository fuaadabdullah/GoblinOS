from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Protocol

logger = logging.getLogger(__name__)


class PluginCapability(str):
    """Predefined capability identifiers a plugin may request."""

    CONFIG_READ = "config:read"
    CONFIG_WRITE = "config:write"
    NETWORK_OUTBOUND = "network:outbound"
    FILE_SYSTEM = "filesystem"
    EXECUTE_WORKFLOW = "workflow:invoke"
    REGISTER_EXTENSION = "extensions:register"


@dataclass
class PluginMetadata:
    name: str
    version: str
    author: str = ""
    license: str = ""
    description: str = ""
    homepage: Optional[str] = None


@dataclass
class PluginManifest:
    """Declarative manifest required for every plugin."""

    name: str
    version: str
    entry_point: str
    description: str = ""
    author: str = ""
    license: str = ""
    categories: List[str] = field(default_factory=list)
    capabilities: List[str] = field(default_factory=list)
    extension_points: List[str] = field(default_factory=list)
    homepage: Optional[str] = None
    config: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def load(cls, manifest_path: Path) -> "PluginManifest":
        data = json.loads(manifest_path.read_text())
        data.setdefault("categories", [])
        data.setdefault("capabilities", [])
        data.setdefault("extension_points", [])
        data.setdefault("config", {})
        return cls(**data)

    def metadata(self) -> PluginMetadata:
        return PluginMetadata(
            name=self.name,
            version=self.version,
            author=self.author,
            license=self.license,
            description=self.description,
            homepage=self.homepage,
        )


@dataclass
class PluginContext:
    """Runtime context passed to plugins when activated."""

    project_root: Path
    config_manager: Any = None
    extension_registry: "ExtensionRegistry" | None = None
    state_manager: Any = None
    shared_services: Dict[str, Any] = field(default_factory=dict)


class ExtensionPoint(Protocol):
    name: str
    description: str
    handler: Callable[..., Any]


class ExtensionRegistry:
    """Lightweight extension registry that plugins can register handlers with."""

    def __init__(self) -> None:
        self._extensions: Dict[str, List[Callable[..., Any]]] = {}

    def register(self, extension: str, handler: Callable[..., Any]) -> None:
        self._extensions.setdefault(extension, []).append(handler)
        logger.debug("Registered extension %s -> %s", extension, handler)

    def get(self, extension: str) -> List[Callable[..., Any]]:
        return self._extensions.get(extension, [])

    def available(self) -> Dict[str, int]:
        return {name: len(handlers) for name, handlers in self._extensions.items()}


class SmithyPlugin(Protocol):
    """Plugins must implement this interface."""

    manifest: PluginManifest

    def activate(self, context: PluginContext) -> None:
        ...

    def deactivate(self) -> None:
        ...

    def register_extensions(self, registry: ExtensionRegistry) -> None:
        ...
