"""
Main GoblinInterface implementation for Mages Guild.

This module provides the public API for Mages Guild operations including
quality gates, vault validation, anomaly detection, and forecasting.
"""

import json
import time
from pathlib import Path
from typing import Optional

from goblinos.interface import (
    GoblinInterface,
    GoblinConfig,
    GoblinContext,
    GoblinResult,
    GoblinCapabilities,
)

from .logic import MagesGuildLogic
from .schema import MagesGuildConfig
from .types import (
    MagesGuildResult,
    QualityReport,
    VaultValidationReport,
    AnomalyReport,
    ReleaseRiskAssessment,
    Severity,
)


class MagesGuildGoblin(GoblinInterface):
    """Mages Guild goblin implementation for quality gates and vault validation."""

    def __init__(self):
        self.logic: Optional[MagesGuildLogic] = None
        self.config: Optional[MagesGuildConfig] = None

    async def initialize(self, config: GoblinConfig) -> None:
        """Initialize the Mages Guild goblin with configuration."""
        try:
            # Load configuration
            config_path = (
                Path(config.working_dir) / "config" / "default.json"
                if config.working_dir
                else Path("config/default.json")
            )
            if config_path.exists():
                with open(config_path, "r") as f:
                    config_data = json.load(f)
                self.config = MagesGuildConfig(**config_data)
            else:
                # Use default configuration
                self.config = MagesGuildConfig()

            # Override repo root if provided
            if config.working_dir:
                self.config.repo_root = str(config.working_dir)

            # Initialize logic
            self.logic = MagesGuildLogic(self.config)
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Mages Guild: {e}")

    async def execute(self, context: GoblinContext) -> GoblinResult:
        """Execute Mages Guild operations based on the command."""
        if not self.logic:
            return GoblinResult(success=False, error=RuntimeError("Mages Guild not initialized"))

        if isinstance(context.input, dict) and "command" in context.input:
            command = context.input["command"]
        elif isinstance(context.input, str):
            command = context.input
        else:
            return GoblinResult(success=False, error=ValueError("Invalid command format"))

        start_time = time.time()

        try:
            if command.startswith("quality:"):
                result = await self._execute_quality_command(command, context)
            elif command.startswith("vault:"):
                result = await self._execute_vault_command(command, context)
            elif command.startswith("anomaly:"):
                result = await self._execute_anomaly_command(command, context)
            elif command.startswith("forecast:"):
                result = await self._execute_forecast_command(command, context)
            elif command == "docs:update":
                result = await self._execute_docs_command(command, context)
            else:
                result = MagesGuildResult(
                    success=False,
                    summary=f"Unknown command: {command}",
                    execution_time_seconds=time.time() - start_time,
                )

            return GoblinResult(
                success=result.success,
                output=result,
                metadata={"command": command, "execution_time": time.time() - start_time},
            )

        except Exception as e:
            execution_time = time.time() - start_time
            error_result = MagesGuildResult(
                success=False,
                summary=f"Command failed: {str(e)}",
                execution_time_seconds=execution_time,
            )
            return GoblinResult(
                success=False,
                output=error_result,
                error=e,
                metadata={"command": command, "execution_time": execution_time},
            )

    async def shutdown(self) -> None:
        """Clean up Mages Guild resources."""
        await self.logic.shutdown()

    def get_capabilities(self) -> GoblinCapabilities:
        """Return the capabilities of the Mages Guild goblin."""
        return GoblinCapabilities(
            name="Mages Guild",
            description="Quality gates, anomaly detection, and vault validation for releases",
            version="0.1.0",
        )

    async def _execute_quality_command(
        self, command: str, context: GoblinContext
    ) -> MagesGuildResult:
        """Execute quality-related commands."""
        if command == "quality:lint":
            quality_report = await self.logic.execute_quality_gate(context)
            summary = self._format_quality_summary(quality_report)
            return MagesGuildResult(
                quality_report=quality_report,
                success=quality_report.success,
                summary=summary,
                execution_time_seconds=quality_report.execution_time_seconds,
            )
        elif command == "quality:full":
            # Alias for quality:lint for compatibility
            return await self._execute_quality_command("quality:lint", context)
        else:
            return MagesGuildResult(
                success=False,
                summary=f"Unknown quality command: {command}",
                execution_time_seconds=0.0,
            )

    async def _execute_vault_command(
        self, command: str, context: GoblinContext
    ) -> MagesGuildResult:
        """Execute vault-related commands."""
        if command == "vault:validate":
            vault_report = await self.logic.execute_vault_validation(context)
            summary = self._format_vault_summary(vault_report)
            return MagesGuildResult(
                vault_report=vault_report,
                success=vault_report.success,
                summary=summary,
                execution_time_seconds=vault_report.execution_time_seconds,
            )
        else:
            return MagesGuildResult(
                success=False,
                summary=f"Unknown vault command: {command}",
                execution_time_seconds=0.0,
            )

    async def _execute_anomaly_command(
        self, command: str, context: GoblinContext
    ) -> MagesGuildResult:
        """Execute anomaly detection commands."""
        if command == "anomaly:detect":
            anomaly_report = await self.logic.execute_anomaly_detection(context)
            summary = self._format_anomaly_summary(anomaly_report)
            return MagesGuildResult(
                anomaly_report=anomaly_report,
                success=True,  # Anomaly detection always succeeds, even if anomalies found
                summary=summary,
                execution_time_seconds=anomaly_report.execution_time_seconds,
            )
        else:
            return MagesGuildResult(
                success=False,
                summary=f"Unknown anomaly command: {command}",
                execution_time_seconds=0.0,
            )

    async def _execute_forecast_command(
        self, command: str, context: GoblinContext
    ) -> MagesGuildResult:
        """Execute forecasting commands."""
        if command == "forecast:risk":
            risk_assessment = await self.logic.execute_forecasting(context)
            summary = self._format_forecast_summary(risk_assessment)
            return MagesGuildResult(
                risk_assessment=risk_assessment,
                success=True,
                summary=summary,
                execution_time_seconds=0.0,  # Forecasting is fast
            )
        else:
            return MagesGuildResult(
                success=False,
                summary=f"Unknown forecast command: {command}",
                execution_time_seconds=0.0,
            )

    async def _execute_docs_command(self, command: str, context: GoblinContext) -> MagesGuildResult:
        """Execute documentation commands."""
        if command == "docs:update":
            # Simplified docs update - in practice would generate API docs, update READMEs, etc.
            summary = "Documentation update completed (simplified implementation)"
            return MagesGuildResult(success=True, summary=summary, execution_time_seconds=0.0)
        else:
            return MagesGuildResult(
                success=False,
                summary=f"Unknown docs command: {command}",
                execution_time_seconds=0.0,
            )

    def _format_quality_summary(self, report: QualityReport) -> str:
        """Format a quality report into a human-readable summary."""
        if report.success:
            return f"✅ Quality gates passed - checked {report.total_files_checked} files, found {len(report.issues_found)} issues"
        else:
            critical_count = report.issues_by_severity.get(Severity.CRITICAL, 0)
            high_count = report.issues_by_severity.get(Severity.HIGH, 0)
            return f"❌ Quality gates failed - {len(report.issues_found)} issues ({critical_count} critical, {high_count} high)"

    def _format_vault_summary(self, report: VaultValidationReport) -> str:
        """Format a vault validation report into a human-readable summary."""
        if report.success:
            return f"✅ Vault validation passed - checked {report.total_files_checked} files, found {len(report.issues_found)} issues"
        else:
            critical_count = report.issues_by_severity.get(Severity.CRITICAL, 0)
            high_count = report.issues_by_severity.get(Severity.HIGH, 0)
            return f"❌ Vault validation failed - {len(report.issues_found)} issues ({critical_count} critical, {high_count} high)"

    def _format_anomaly_summary(self, report: "AnomalyReport") -> str:
        """Format an anomaly report into a human-readable summary."""
        if report.anomalies_detected:
            return f"⚠️  Detected {len(report.anomalies_detected)} anomalies in {report.time_window_minutes} minute window"
        else:
            return f"✅ No anomalies detected in {report.time_window_minutes} minute window"

    def _format_forecast_summary(self, assessment: "ReleaseRiskAssessment") -> str:
        """Format a risk assessment into a human-readable summary."""
        risk_level = "LOW"
        if assessment.overall_risk_score > self.config.forecasting.risk_threshold_high:
            risk_level = "HIGH"
        elif assessment.overall_risk_score > self.config.forecasting.risk_threshold_medium:
            risk_level = "MEDIUM"

        return f"📊 Release risk assessment: {risk_level} ({assessment.overall_risk_score:.2f}) - {len(assessment.risk_factors)} risk factors identified"
