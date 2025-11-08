from __future__ import annotations

import importlib
import inspect
import logging
from pathlib import Path
from typing import Dict, Iterable, Optional

from ..config import ConfigManager
from .base import ExtensionRegistry, PluginContext, PluginManifest, SmithyPlugin
from .registry import PluginRecord, PluginRegistry, PluginStatus
from .sandbox import PluginSandbox

logger = logging.getLogger(__name__)


class PluginManager:
    """Discovers, installs, and manages Smithy plugins."""

    def __init__(
        self,
        project_root: Path,
        config_manager: Optional[ConfigManager] = None,
        search_paths: Optional[Iterable[Path]] = None,
        sandbox: Optional[PluginSandbox] = None,
    ) -> None:
        self.project_root = project_root
        self.config_manager = config_manager
        self.search_paths = list(search_paths or self._default_paths())
        self.registry = PluginRegistry()
        self.extension_registry = ExtensionRegistry()
        self.loaded_plugins: Dict[str, SmithyPlugin] = {}
        self.sandbox = sandbox or PluginSandbox()

    def _default_paths(self) -> Iterable[Path]:
        pkg_plugins = Path(__file__).resolve().parents[3] / "plugins"
        return [
            self.project_root / "smithy" / "plugins",
            self.project_root / ".smithy" / "plugins",
            pkg_plugins,
        ]

    def discover(self) -> Dict[str, PluginRecord]:
        for search_path in self.search_paths:
            if not search_path.exists():
                continue
            for manifest_path in search_path.glob("**/smithy-plugin.json"):
                try:
                    manifest = PluginManifest.load(manifest_path)
                    record = PluginRecord(manifest=manifest, path=manifest_path.parent)
                    self.registry.register(record)
                except Exception as exc:
                    logger.error("Failed to load manifest %s: %s", manifest_path, exc)
        return self.registry.all()

    def list_plugins(self) -> Dict[str, PluginRecord]:
        if not self.registry.all():
            self.discover()
        return self.registry.all()

    def install(self, path: Path) -> PluginRecord:
        manifest_path = path / "smithy-plugin.json"
        manifest = PluginManifest.load(manifest_path)
        record = PluginRecord(manifest=manifest, path=path, status=PluginStatus.INSTALLED)
        self.registry.register(record)
        return record

    def enable(self, name: str) -> None:
        record = self.registry.get(name)
        if not record:
            self.discover()
            record = self.registry.get(name)
        if not record:
            raise KeyError(f"Unknown plugin '{name}'")
        plugin = self._load_plugin(record)
        context = PluginContext(
            project_root=self.project_root,
            config_manager=self.config_manager,
            extension_registry=self.extension_registry,
        )
        plugin.activate(context)
        plugin.register_extensions(self.extension_registry)
        self.loaded_plugins[name] = plugin
        self.registry.set_status(name, PluginStatus.ENABLED)

    def disable(self, name: str) -> None:
        plugin = self.loaded_plugins.get(name)
        if plugin:
            plugin.deactivate()
            self.registry.set_status(name, PluginStatus.DISABLED)
            self.loaded_plugins.pop(name, None)

    def _load_plugin(self, record: PluginRecord) -> SmithyPlugin:
        module_path, class_name = record.manifest.entry_point.split(":", 1)
        try:
            plugin_module = self._import_module(module_path, record.path)
            plugin_cls = getattr(plugin_module, class_name)
            if not inspect.isclass(plugin_cls):
                raise TypeError(f"Entry point {record.manifest.entry_point} is not a class")
            plugin: SmithyPlugin = plugin_cls(record.manifest)
            self.sandbox.validate(plugin)
            return plugin
        except Exception as exc:
            self.registry.set_status(record.manifest.name, PluginStatus.ERRORED, str(exc))
            raise

    def _import_module(self, module_path: str, file_root: Path):
        try:
            return importlib.import_module(module_path)
        except ModuleNotFoundError:
            # attempt namespace package by temporarily adjusting sys.path
            import sys

            sys.path.insert(0, str(file_root))
            try:
                return importlib.import_module(module_path)
            finally:
                sys.path.remove(str(file_root))
