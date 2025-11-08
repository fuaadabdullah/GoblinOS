from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from smithy.automation.plugins import ExtensionRegistry, PluginContext, PluginManifest, SmithyPlugin


class TypeScriptLanguagePlugin(SmithyPlugin):
    def __init__(self, manifest: PluginManifest):
        self.manifest = manifest
        self.context: PluginContext | None = None

    def activate(self, context: PluginContext) -> None:
        self.context = context

    def deactivate(self) -> None:
        self.context = None

    def register_extensions(self, registry: ExtensionRegistry) -> None:
        registry.register("language.detect", self.detect_language)
        registry.register("language.tooling", self.provide_tooling)
        registry.register("language.scaffold.tests", self.scaffold_tests)

    def detect_language(self, project_root: str) -> Dict[str, Any]:
        root = Path(project_root)
        markers = ["package.json", "tsconfig.json", "pnpm-lock.yaml"]
        detected = any((root / marker).exists() for marker in markers)
        return {
            "language": "typescript" if detected else "unknown",
            "markers": markers,
            "project_root": project_root,
        }

    def provide_tooling(self, *_args, **_kwargs) -> Dict[str, List[str]]:
        return {
            "formatters": ["pnpm biome format", "pnpm prettier"],
            "linters": ["pnpm biome check", "pnpm eslint"],
            "test_commands": ["pnpm test", "pnpm vitest run"],
            "build": ["pnpm build"],
        }

    def scaffold_tests(self, file: str, framework: str = "vitest") -> Dict[str, str]:
        template = """import { describe, it, expect } from '{framework}';

describe('{suite}', () => {{
  it('should work', () => {{
    expect(true).toBe(true);
  }});
}});
"""
        suite = Path(file).stem
        return {"path": f"{suite}.test.ts", "content": template.format(framework=framework, suite=suite)}
