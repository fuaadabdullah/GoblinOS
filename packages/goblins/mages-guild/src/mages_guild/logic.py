"""
Core business logic for Mages Guild operations.

This module contains the core implementation for quality gates, vault validation,
anomaly detection, and forecasting operations.
"""

import asyncio
import os
import re
import subprocess
import time
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
import yaml
import json

from goblinos.interface import GoblinConfig, GoblinContext, GoblinResult
from .schema import MagesGuildConfig
from .types import (
    QualityReport,
    QualityIssue,
    Severity,
    QualityCheckType,
    VaultValidationReport,
    VaultIssue,
    VaultValidationType,
    AnomalyReport,
    AnomalyDetectionResult,
    AnomalyType,
    ReleaseRiskAssessment,
    ForecastingMetric,
    MagesGuildResult,
)


class MagesGuildLogic:
    """Core business logic for Mages Guild operations."""

    def __init__(self, config: MagesGuildConfig):
        self.config = config
        self.repo_root = Path(config.repo_root) if config.repo_root else Path.cwd()

    async def execute_quality_gate(self, context: GoblinContext) -> QualityReport:
        """Execute quality gate checks (linting, type checking, etc.)."""
        start_time = time.time()

        issues: List[QualityIssue] = []
        total_files = 0

        # Run Python linting
        if "lint" in self.config.quality_gate.enabled_checks:
            python_issues, python_files = await self._run_python_linting()
            issues.extend(python_issues)
            total_files += python_files

        # Run TypeScript linting
        if "type_check" in self.config.quality_gate.enabled_checks:
            ts_issues, ts_files = await self._run_typescript_linting()
            issues.extend(ts_issues)
            total_files += ts_files

        # Run security checks
        if "security" in self.config.quality_gate.enabled_checks:
            security_issues, security_files = await self._run_security_checks()
            issues.extend(security_issues)
            total_files += security_files

        # Calculate statistics
        issues_by_severity = {}
        issues_by_type = {}

        for issue in issues:
            issues_by_severity[issue.severity] = issues_by_severity.get(issue.severity, 0) + 1
            issues_by_type[issue.check_type] = issues_by_type.get(issue.check_type, 0) + 1

        execution_time = time.time() - start_time

        # Determine success based on configuration
        success = True
        if self.config.quality_gate.fail_on_warnings:
            success = len(issues) == 0
        elif self.config.quality_gate.max_issues_threshold is not None:
            success = len(issues) <= self.config.quality_gate.max_issues_threshold

        return QualityReport(
            total_files_checked=total_files,
            issues_found=issues,
            issues_by_severity=issues_by_severity,
            issues_by_type=issues_by_type,
            execution_time_seconds=execution_time,
            success=success,
        )

    async def execute_vault_validation(self, context: GoblinContext) -> VaultValidationReport:
        """Execute Obsidian vault validation checks."""
        start_time = time.time()

        vault_path = self.repo_root / self.config.vault_validation.vault_path
        issues: List[VaultIssue] = []
        total_files = 0

        if not vault_path.exists():
            return VaultValidationReport(
                total_files_checked=0,
                issues_found=[],
                execution_time_seconds=time.time() - start_time,
                success=False,
            )

        # Check YAML frontmatter
        if self.config.vault_validation.require_frontmatter:
            frontmatter_issues, frontmatter_files = await self._validate_frontmatter(vault_path)
            issues.extend(frontmatter_issues)
            total_files += frontmatter_files

        # Check linguist attributes
        if self.config.vault_validation.validate_linguist_attributes:
            linguist_issues, linguist_files = await self._validate_linguist_attributes(vault_path)
            issues.extend(linguist_issues)
            total_files += linguist_files

        # Check file structure
        structure_issues, structure_files = await self._validate_file_structure(vault_path)
        issues.extend(structure_issues)
        total_files += structure_files

        # Check broken links
        if self.config.vault_validation.check_broken_links:
            link_issues, link_files = await self._validate_links(vault_path)
            issues.extend(link_issues)
            total_files += link_files

        # Calculate statistics
        issues_by_severity = {}
        issues_by_type = {}

        for issue in issues:
            issues_by_severity[issue.severity] = issues_by_severity.get(issue.severity, 0) + 1
            issues_by_type[issue.issue_type] = issues_by_type.get(issue.issue_type, 0) + 1

        execution_time = time.time() - start_time
        success = len([i for i in issues if i.severity in [Severity.HIGH, Severity.CRITICAL]]) == 0

        return VaultValidationReport(
            total_files_checked=total_files,
            issues_found=issues,
            issues_by_severity=issues_by_severity,
            issues_by_type=issues_by_type,
            execution_time_seconds=execution_time,
            success=success,
        )

    async def execute_anomaly_detection(self, context: GoblinContext) -> AnomalyReport:
        """Execute anomaly detection on metrics and logs."""
        start_time = time.time()

        anomalies: List[AnomalyDetectionResult] = []

        # This is a simplified implementation - in practice, this would analyze
        # actual metrics from monitoring systems, logs, etc.

        # Simulate anomaly detection for demonstration
        if "metric_spike" in self.config.anomaly_detection.enabled_detectors:
            spike_anomalies = await self._detect_metric_spikes()
            anomalies.extend(spike_anomalies)

        if "error_rate" in self.config.anomaly_detection.enabled_detectors:
            error_anomalies = await self._detect_error_rate_anomalies()
            anomalies.extend(error_anomalies)

        # Calculate statistics
        anomalies_by_type = {}
        for anomaly in anomalies:
            anomalies_by_type[anomaly.anomaly_type] = (
                anomalies_by_type.get(anomaly.anomaly_type, 0) + 1
            )

        execution_time = time.time() - start_time

        return AnomalyReport(
            time_window_minutes=self.config.anomaly_detection.time_window_minutes,
            anomalies_detected=anomalies,
            anomalies_by_type=anomalies_by_type,
            execution_time_seconds=execution_time,
        )

    async def execute_forecasting(self, context: GoblinContext) -> ReleaseRiskAssessment:
        """Execute release risk forecasting."""
        # Simplified forecasting implementation
        # In practice, this would use historical data and ML models

        metrics = [
            ForecastingMetric(name="build_time", value=45.2, unit="seconds", trend="stable"),
            ForecastingMetric(name="test_coverage", value=87.5, unit="percent", trend="up"),
            ForecastingMetric(name="error_rate", value=0.02, unit="percent", trend="down"),
        ]

        # Calculate risk score based on metrics
        risk_score = 0.3  # Low risk for this example

        risk_factors = []
        if any(m.trend == "down" for m in metrics if m.name == "test_coverage"):
            risk_factors.append("Declining test coverage")
        if any(m.value > 60 for m in metrics if m.name == "build_time"):
            risk_factors.append("Slow build times")

        return ReleaseRiskAssessment(
            overall_risk_score=risk_score,
            risk_factors=risk_factors,
            confidence_interval={"low": 0.2, "high": 0.4},
            recommended_actions=["Monitor build times", "Increase test coverage"],
            forecast_horizon_days=self.config.forecasting.forecast_horizon_days,
            metrics_analyzed=metrics,
        )

    async def shutdown(self) -> None:
        """Clean up resources."""
        pass

    # Private helper methods for quality gates

    async def _run_python_linting(self) -> Tuple[List[QualityIssue], int]:
        """Run Python linting and return issues."""
        issues = []
        files_checked = 0

        for path in self.config.quality_gate.lint_paths:
            full_path = self.repo_root / path
            if not full_path.exists():
                continue

            # Run ruff check
            try:
                result = await asyncio.create_subprocess_exec(
                    "ruff",
                    "check",
                    str(full_path),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=self.repo_root,
                )
                stdout, stderr = await result.communicate()

                if result.returncode != 0:
                    # Parse ruff output
                    output = stdout.decode() + stderr.decode()
                    parsed_issues = self._parse_ruff_output(output, path)
                    issues.extend(parsed_issues)

                # Count Python files
                python_files = list(full_path.rglob("*.py"))
                files_checked += len([f for f in python_files if self._should_check_file(f)])

            except FileNotFoundError:
                issues.append(
                    QualityIssue(
                        file_path=str(full_path),
                        rule_id="missing-linter",
                        message="ruff not found in PATH",
                        severity=Severity.HIGH,
                        check_type=QualityCheckType.LINT,
                    )
                )

        return issues, files_checked

    async def _run_typescript_linting(self) -> Tuple[List[QualityIssue], int]:
        """Run TypeScript linting and return issues."""
        issues = []
        files_checked = 0

        for path in self.config.quality_gate.lint_paths:
            full_path = self.repo_root / path
            if not full_path.exists():
                continue

            # Check if this is a TypeScript project
            if not (full_path / "package.json").exists():
                continue

            try:
                # Run pnpm lint
                result = await asyncio.create_subprocess_exec(
                    "pnpm",
                    "lint",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=full_path,
                )
                stdout, stderr = await result.communicate()

                if result.returncode != 0:
                    # Parse eslint output (simplified)
                    output = stdout.decode() + stderr.decode()
                    parsed_issues = self._parse_eslint_output(output, path)
                    issues.extend(parsed_issues)

                # Count TypeScript files
                ts_files = list(full_path.rglob("*.ts")) + list(full_path.rglob("*.tsx"))
                files_checked += len([f for f in ts_files if self._should_check_file(f)])

            except FileNotFoundError:
                issues.append(
                    QualityIssue(
                        file_path=str(full_path),
                        rule_id="missing-linter",
                        message="pnpm not found in PATH",
                        severity=Severity.HIGH,
                        check_type=QualityCheckType.LINT,
                    )
                )

        return issues, files_checked

    async def _run_security_checks(self) -> Tuple[List[QualityIssue], int]:
        """Run security checks and return issues."""
        issues = []
        files_checked = 0

        # Simple security checks - in practice, this would use tools like bandit, safety, etc.
        for path in self.config.quality_gate.lint_paths:
            full_path = self.repo_root / path
            if not full_path.exists():
                continue

            for py_file in full_path.rglob("*.py"):
                if not self._should_check_file(py_file):
                    continue

                files_checked += 1
                content = py_file.read_text()

                # Check for hardcoded secrets (simplified)
                if re.search(r'password\s*=\s*["\'][^"\']*["\']', content, re.IGNORECASE):
                    issues.append(
                        QualityIssue(
                            file_path=str(py_file),
                            rule_id="hardcoded-password",
                            message="Potential hardcoded password detected",
                            severity=Severity.CRITICAL,
                            check_type=QualityCheckType.SECURITY,
                        )
                    )

        return issues, files_checked

    # Private helper methods for vault validation

    async def _validate_frontmatter(self, vault_path: Path) -> Tuple[List[VaultIssue], int]:
        """Validate YAML frontmatter in vault files."""
        issues = []
        files_checked = 0

        for md_file in vault_path.rglob("*.md"):
            files_checked += 1
            content = md_file.read_text()

            # Check if file has frontmatter
            if not content.startswith("---"):
                if self.config.vault_validation.require_frontmatter:
                    issues.append(
                        VaultIssue(
                            file_path=str(md_file),
                            issue_type=VaultValidationType.YAML_FRONTMATTER,
                            message="Missing YAML frontmatter",
                            severity=Severity.MEDIUM,
                        )
                    )
                continue

            # Parse frontmatter
            try:
                end_pos = content.find("---", 3)
                if end_pos == -1:
                    issues.append(
                        VaultIssue(
                            file_path=str(md_file),
                            issue_type=VaultValidationType.YAML_FRONTMATTER,
                            message="Malformed YAML frontmatter - missing closing ---",
                            severity=Severity.HIGH,
                        )
                    )
                    continue

                frontmatter_text = content[3:end_pos]
                frontmatter = yaml.safe_load(frontmatter_text)

                # Check required fields
                for field in self.config.vault_validation.required_frontmatter_fields:
                    if field not in frontmatter:
                        issues.append(
                            VaultIssue(
                                file_path=str(md_file),
                                issue_type=VaultValidationType.YAML_FRONTMATTER,
                                message=f"Missing required frontmatter field: {field}",
                                severity=Severity.MEDIUM,
                            )
                        )

            except yaml.YAMLError as e:
                issues.append(
                    VaultIssue(
                        file_path=str(md_file),
                        issue_type=VaultValidationType.YAML_FRONTMATTER,
                        message=f"Invalid YAML frontmatter: {str(e)}",
                        severity=Severity.HIGH,
                    )
                )

        return issues, files_checked

    async def _validate_linguist_attributes(self, vault_path: Path) -> Tuple[List[VaultIssue], int]:
        """Validate linguist attributes in frontmatter."""
        issues = []
        files_checked = 0

        # This would check for linguist language/vendor attributes
        # Simplified implementation
        return issues, files_checked

    async def _validate_file_structure(self, vault_path: Path) -> Tuple[List[VaultIssue], int]:
        """Validate vault file structure."""
        issues = []
        files_checked = 0

        for file_path in vault_path.rglob("*"):
            if file_path.is_file():
                files_checked += 1

                # Check file extension
                if file_path.suffix not in self.config.vault_validation.allowed_file_extensions:
                    issues.append(
                        VaultIssue(
                            file_path=str(file_path),
                            issue_type=VaultValidationType.FILE_STRUCTURE,
                            message=f"File extension '{file_path.suffix}' not allowed",
                            severity=Severity.LOW,
                        )
                    )

                # Check file size
                size_kb = file_path.stat().st_size / 1024
                if size_kb > self.config.vault_validation.max_file_size_kb:
                    issues.append(
                        VaultIssue(
                            file_path=str(file_path),
                            issue_type=VaultValidationType.FILE_STRUCTURE,
                            message=f"File size {size_kb:.1f}KB exceeds limit of {self.config.vault_validation.max_file_size_kb}KB",
                            severity=Severity.MEDIUM,
                        )
                    )

        return issues, files_checked

    async def _validate_links(self, vault_path: Path) -> Tuple[List[VaultIssue], int]:
        """Validate internal links in vault files."""
        issues = []
        files_checked = 0

        # Simplified link validation - would need more sophisticated parsing
        return issues, files_checked

    # Private helper methods for anomaly detection

    async def _detect_metric_spikes(self) -> List[AnomalyDetectionResult]:
        """Detect metric spikes (simplified implementation)."""
        # In practice, this would analyze real metrics
        return []

    async def _detect_error_rate_anomalies(self) -> List[AnomalyDetectionResult]:
        """Detect error rate anomalies (simplified implementation)."""
        # In practice, this would analyze error logs/metrics
        return []

    # Utility methods

    def _should_check_file(self, file_path: Path) -> bool:
        """Check if a file should be included in quality checks."""
        for pattern in self.config.quality_gate.exclude_patterns:
            if pattern in str(file_path):
                return False
        return True

    def _parse_ruff_output(self, output: str, base_path: str) -> List[QualityIssue]:
        """Parse ruff output into QualityIssue objects."""
        issues = []
        for line in output.split("\n"):
            if not line.strip():
                continue
            # Simplified parsing - real implementation would be more robust
            parts = line.split(":")
            if len(parts) >= 3:
                file_path = f"{base_path}/{parts[0]}"
                line_num = int(parts[1]) if parts[1].isdigit() else None
                message = ":".join(parts[2:]).strip()

                issues.append(
                    QualityIssue(
                        file_path=file_path,
                        line_number=line_num,
                        rule_id="ruff-violation",
                        message=message,
                        severity=Severity.MEDIUM,
                        check_type=QualityCheckType.LINT,
                    )
                )
        return issues

    def _parse_eslint_output(self, output: str, base_path: str) -> List[QualityIssue]:
        """Parse eslint output into QualityIssue objects."""
        issues = []
        # Simplified parsing - real implementation would handle eslint format
        return issues
