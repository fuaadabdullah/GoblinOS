from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Iterable, List

from .base import PluginCapability, SmithyPlugin

logger = logging.getLogger(__name__)


@dataclass
class SandboxPolicy:
    allowed_capabilities: List[str] = field(
        default_factory=lambda: [
            PluginCapability.CONFIG_READ,
            PluginCapability.CONFIG_WRITE,
            PluginCapability.REGISTER_EXTENSION,
        ]
    )
    forbidden_modules: List[str] = field(default_factory=list)
    enforce_network_policy: bool = True


class PluginSandbox:
    """Very light sandbox enforcing declared capabilities."""

    def __init__(self, policy: SandboxPolicy | None = None) -> None:
        self.policy = policy or SandboxPolicy()

    def validate(self, plugin: SmithyPlugin) -> None:
        requested = set(plugin.manifest.capabilities)
        allowed = set(self.policy.allowed_capabilities)
        if not requested.issubset(allowed):
            diff = requested - allowed
            raise PermissionError(
                f"Plugin '{plugin.manifest.name}' requests forbidden capabilities: {sorted(diff)}"
            )
        logger.debug("Plugin %s passed capability validation", plugin.manifest.name)

    def allow_capabilities(self, capabilities: Iterable[str]) -> None:
        for capability in capabilities:
            if capability not in self.policy.allowed_capabilities:
                self.policy.allowed_capabilities.append(capability)
