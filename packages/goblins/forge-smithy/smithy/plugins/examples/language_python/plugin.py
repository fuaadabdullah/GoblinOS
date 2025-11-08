from __future__ import annotations

from typing import Any, Dict

from smithy.automation.plugins import ExtensionRegistry, PluginContext, PluginManifest, SmithyPlugin


class PythonLanguagePlugin(SmithyPlugin):
    """Registers language-specific helpers for Python projects."""

    def __init__(self, manifest: PluginManifest):
        self.manifest = manifest
        self._context: PluginContext | None = None

    def activate(self, context: PluginContext) -> None:
        self._context = context

    def deactivate(self) -> None:
        self._context = None

    def register_extensions(self, registry: ExtensionRegistry) -> None:
        registry.register("language.detect", self.detect_language)
        registry.register("language.tooling", self.provide_tooling)

    def detect_language(self, project_root: str) -> Dict[str, Any]:
        return {
            "language": "python",
            "markers": ["pyproject.toml", "requirements.txt"],
            "project_root": project_root,
        }

    def provide_tooling(self, *_args, **_kwargs) -> Dict[str, Any]:
        return {
            "formatters": ["ruff format", "black"],
            "linters": ["ruff check"],
            "test_commands": ["pytest", "python -m pytest"],
        }
