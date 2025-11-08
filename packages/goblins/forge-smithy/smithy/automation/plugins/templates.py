from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from textwrap import dedent
from typing import Dict


@dataclass
class PluginTemplateGenerator:
    """Create boilerplate directories for new plugins."""

    plugin_name: str
    destination: Path
    version: str = "0.1.0"
    category: str = "tool"

    def generate(self) -> Path:
        plugin_dir = self.destination / self.plugin_name
        plugin_dir.mkdir(parents=True, exist_ok=True)
        manifest = self._manifest_template()
        (plugin_dir / "smithy-plugin.json").write_text(json.dumps(manifest, indent=2))
        module_content = self._module_template(manifest["entry_point"].split(":")[-1])
        module_path = plugin_dir / "plugin.py"
        module_path.write_text(module_content)
        return plugin_dir

    def _manifest_template(self) -> Dict[str, object]:
        entry_class = f"{self.plugin_name.title().replace('-', '')}Plugin"
        return {
            "name": self.plugin_name,
            "version": self.version,
            "description": "Sample Smithy plugin",
            "author": "Smithy Developer",
            "license": "MIT",
            "categories": [self.category],
            "capabilities": ["config:read", "extensions:register"],
            "entry_point": f"plugin:{entry_class}",
        }

    def _module_template(self, class_name: str) -> str:
        return dedent(
            f"""
            from smithy.automation.plugins import ExtensionRegistry, PluginContext, PluginManifest, SmithyPlugin


            class {class_name}(SmithyPlugin):
                def __init__(self, manifest: PluginManifest):
                    self.manifest = manifest

                def activate(self, context: PluginContext) -> None:
                    context.shared_services.setdefault("events", []).append(
                        f"Plugin {{self.manifest.name}} activated"
                    )

                def deactivate(self) -> None:
                    pass

                def register_extensions(self, registry: ExtensionRegistry) -> None:
                    registry.register("sample.extension", self.handle_extension)

                def handle_extension(self, *args, **kwargs):
                    return {{"plugin": self.manifest.name, "args": args, "kwargs": kwargs}}
            """
        ).strip()
