from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from smithy.automation.plugins import (
    ExtensionRegistry,
    PluginContext,
    PluginManifest,
    SmithyPlugin,
)


@dataclass
class DockerConfigTemplate:
    metrics_addr: str = "127.0.0.1:9323"
    insecure_registries: Iterable[str] = tuple()
    registries_mirrors: Iterable[str] = tuple()
    default_ulimits: Dict[str, str] = field(
        default_factory=lambda: {"nofile": "1024:2048", "nproc": "4096:4096"}
    )
    experimental: bool = False
    debug: bool = False

    def to_dict(self) -> Dict[str, Any]:
        config: Dict[str, Any] = {
            "log-driver": "json-file",
            "log-opts": {"max-size": "10m", "max-file": "3"},
            "metrics-addr": self.metrics_addr,
            "default-ulimits": self.default_ulimits,
            "icc": False,
            "live-restore": True,
        }
        if self.insecure_registries:
            config["insecure-registries"] = list(self.insecure_registries)
        if self.registries_mirrors:
            config["registry-mirrors"] = list(self.registries_mirrors)
        if self.experimental:
            config["experimental"] = True
        if self.debug:
            config["debug"] = True
        return config


class DockerDaemonPlugin(SmithyPlugin):
    def __init__(self, manifest: PluginManifest):
        self.manifest = manifest
        self.context: Optional[PluginContext] = None
        self.config_path = Path(self.manifest.config.get("default_config_path", "/etc/docker/daemon.json"))

    def activate(self, context: PluginContext) -> None:
        self.context = context

    def deactivate(self) -> None:
        self.context = None

    def register_extensions(self, registry: ExtensionRegistry) -> None:
        registry.register("docker.daemon.status", self.inspect_daemon)
        registry.register("docker.daemon.config.generate", self.generate_config)
        registry.register("docker.daemon.config.audit", self.audit_config)
        registry.register("docker.daemon.config.write", self.write_config)

    # Extension handlers
    def inspect_daemon(self, *, with_systemd: bool = False) -> Dict[str, Any]:
        dockerd_path = shutil.which("dockerd")
        docker_cli_path = shutil.which("docker")
        version_output = self._run_cmd([dockerd_path, "--version"]) if dockerd_path else None
        docker_info = self._run_cmd([docker_cli_path, "info", "--format", "{{json .}}"])
        status: Dict[str, Any] = {
            "dockerd": {
                "installed": dockerd_path is not None,
                "path": dockerd_path,
                "version": version_output,
            },
            "docker": {
                "installed": docker_cli_path is not None,
                "path": docker_cli_path,
                "info": self._safe_json_parse(docker_info),
            },
        }
        if with_systemd:
            status["systemd"] = self._systemd_status()
        return status

    def generate_config(
        self,
        *,
        metrics_addr: str = "127.0.0.1:9323",
        insecure_registries: Optional[List[str]] = None,
        registry_mirrors: Optional[List[str]] = None,
        experimental: bool = False,
        debug: bool = False,
    ) -> Dict[str, Any]:
        template = DockerConfigTemplate(
            metrics_addr=metrics_addr,
            insecure_registries=insecure_registries or [],
            registries_mirrors=registry_mirrors or [],
            experimental=experimental,
            debug=debug,
        )
        return template.to_dict()

    def audit_config(self, path: Optional[str] = None) -> Dict[str, Any]:
        config_path = Path(path) if path else self.config_path
        findings: List[str] = []
        if not config_path.exists():
            return {"status": "missing", "path": str(config_path)}

        try:
            config = json.loads(config_path.read_text())
        except Exception as exc:
            return {"status": "error", "path": str(config_path), "error": str(exc)}

        if config.get("debug"):
            findings.append("Debug logging enabled")
        if not config.get("live-restore", False):
            findings.append("live-restore disabled")
        if config.get("icc", True):
            findings.append("Inter-container communication (icc) is enabled")
        if not config.get("metrics-addr"):
            findings.append("Metrics endpoint not configured")
        if "insecure-registries" in config:
            findings.append("Insecure registries configured")

        return {
            "status": "ok" if not findings else "warnings",
            "path": str(config_path),
            "findings": findings,
        }

    def write_config(self, config: Dict[str, Any], path: Optional[str] = None, backup: bool = True) -> Dict[str, Any]:
        config_path = Path(path) if path else self.config_path
        config_path.parent.mkdir(parents=True, exist_ok=True)
        if backup and config_path.exists():
            backup_path = config_path.with_suffix(".bak")
            backup_path.write_text(config_path.read_text())
        config_path.write_text(json.dumps(config, indent=2))
        return {"status": "written", "path": str(config_path)}

    # Helpers
    def _run_cmd(self, cmd: List[Optional[str]]) -> Optional[str]:
        if not cmd[0]:
            return None
        try:
            res = subprocess.run(
                cmd,
                check=False,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if res.returncode != 0:
                return res.stderr.strip() or res.stdout.strip()
            return res.stdout.strip()
        except Exception:
            return None

    def _safe_json_parse(self, payload: Optional[str]) -> Optional[Dict[str, Any]]:
        if not payload:
            return None
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            return None

    def _systemd_status(self) -> Dict[str, Any]:
        systemctl = shutil.which("systemctl")
        if not systemctl:
            return {"supported": False}
        output = self._run_cmd([systemctl, "is-active", "docker"])
        return {"supported": True, "active": output == "active"}
