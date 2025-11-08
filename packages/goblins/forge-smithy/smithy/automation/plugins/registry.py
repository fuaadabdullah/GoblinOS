from __future__ import annotations

import enum
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional

from .base import PluginManifest


class PluginStatus(enum.Enum):
    DISCOVERED = "discovered"
    INSTALLED = "installed"
    ENABLED = "enabled"
    DISABLED = "disabled"
    ERRORED = "errored"


@dataclass
class PluginRecord:
    manifest: PluginManifest
    path: Path
    status: PluginStatus = PluginStatus.DISCOVERED
    error: Optional[str] = None
    enabled: bool = False
    source: str = "local"
    metadata: Dict[str, str] = field(default_factory=dict)


class PluginRegistry:
    def __init__(self) -> None:
        self._records: Dict[str, PluginRecord] = {}

    def register(self, record: PluginRecord) -> None:
        self._records[record.manifest.name] = record

    def get(self, name: str) -> Optional[PluginRecord]:
        return self._records.get(name)

    def all(self) -> Dict[str, PluginRecord]:
        return dict(self._records)

    def enabled(self) -> Dict[str, PluginRecord]:
        return {name: rec for name, rec in self._records.items() if rec.enabled}

    def set_status(self, name: str, status: PluginStatus, error: Optional[str] = None) -> None:
        record = self._records.get(name)
        if not record:
            return
        record.status = status
        record.error = error
        record.enabled = status == PluginStatus.ENABLED
