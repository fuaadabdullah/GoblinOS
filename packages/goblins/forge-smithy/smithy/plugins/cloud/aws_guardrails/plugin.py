from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict

from smithy.automation.plugins import ExtensionRegistry, PluginContext, PluginManifest, SmithyPlugin


@dataclass
class GuardrailResult:
    name: str
    status: str
    severity: str
    remediation: str

    def to_dict(self) -> Dict[str, str]:
        return {
            "name": self.name,
            "status": self.status,
            "severity": self.severity,
            "remediation": self.remediation,
        }


class AWSGuardrailsPlugin(SmithyPlugin):
    def __init__(self, manifest: PluginManifest):
        self.manifest = manifest
        self.context: PluginContext | None = None

    def activate(self, context: PluginContext) -> None:
        self.context = context

    def deactivate(self) -> None:
        self.context = None

    def register_extensions(self, registry: ExtensionRegistry) -> None:
        registry.register("cloud.aws.guardrails.evaluate", self.evaluate)
        registry.register("cloud.aws.guardrails.summary", self.summary)

    def evaluate(self, config: Dict[str, Any] | None = None) -> Dict[str, Any]:
        config = config or {}
        results = [
            self._check_config_service(config),
            self._check_cloudtrail(config),
            self._check_root_mfa(config),
            self._check_guardduty(config),
        ]
        return {
            "status": "ok" if all(r.status == "pass" for r in results) else "warnings",
            "results": [r.to_dict() for r in results],
        }

    def summary(self, config: Dict[str, Any] | None = None) -> str:
        evaluation = self.evaluate(config)
        status = evaluation["status"].upper()
        failed = [r for r in evaluation["results"] if r["status"] != "pass"]
        lines = [f"AWS Guardrails: {status}"]
        for result in failed:
            lines.append(f"- {result['name']}: {result['remediation']}")
        return "\n".join(lines)

    def _check_config_service(self, config: Dict[str, Any]) -> GuardrailResult:
        enabled = config.get("aws_config_enabled", True)
        return GuardrailResult(
            name="AWS Config Enabled",
            status="pass" if enabled else "fail",
            severity="critical",
            remediation="Enable AWS Config in all regions",
        )

    def _check_cloudtrail(self, config: Dict[str, Any]) -> GuardrailResult:
        trails = config.get("cloudtrail_trails", 1)
        return GuardrailResult(
            name="CloudTrail Multi-Region",
            status="pass" if trails >= 1 else "fail",
            severity="high",
            remediation="Create an organization trail covering all regions",
        )

    def _check_root_mfa(self, config: Dict[str, Any]) -> GuardrailResult:
        mfa = config.get("root_mfa_enabled", True)
        return GuardrailResult(
            name="Root MFA Enabled",
            status="pass" if mfa else "fail",
            severity="critical",
            remediation="Enable MFA on the root account",
        )

    def _check_guardduty(self, config: Dict[str, Any]) -> GuardrailResult:
        guardduty = config.get("guardduty_regions", [])
        critical = set(self.manifest.config.get("critical_regions", []))
        enabled = critical.issubset(set(guardduty))
        return GuardrailResult(
            name="GuardDuty Coverage",
            status="pass" if enabled else "warn",
            severity="medium",
            remediation="Enable GuardDuty in critical regions",
        )
