"""
Core logic for Huntress Guild Goblin

Handles flaky test detection, regression triage, incident tagging, and signal scouting.
"""

import asyncio
import json
import pathlib
import re
import subprocess
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass

from goblinos.interface import GoblinConfig, GoblinContext, GoblinResult
from .types import (
    HuntressGuildInput,
    HuntressGuildOutput,
    TestSuiteResult,
    FlakyTestAnalysis,
    RegressionAnalysis,
    IncidentReport,
    TestRun,
    TestResult,
    IncidentSeverity,
)
from .schema import HuntressGuildConfig


class HuntressGuildLogic:
    """Core business logic for Huntress Guild operations."""

    def __init__(self, config: HuntressGuildConfig):
        self.config = config
        self._workspace_root = pathlib.Path(config.workspace_root or ".")

    async def execute(self, context: GoblinContext) -> GoblinResult:
        """Execute a huntress guild command."""
        try:
            smithy_input = self._parse_input(context.input)

            # Execute the requested command
            result = await self._execute_command(smithy_input)

            return GoblinResult(
                success=result.success,
                output=result,
                metadata={
                    "message": result.message,
                    "execution_time": result.execution_time,
                },
            )

        except Exception as e:
            return GoblinResult(
                success=False,
                error=e,
                metadata={"message": f"Huntress operation failed: {str(e)}"},
            )

    async def initialize(self, config: GoblinConfig) -> None:
        """Initialize the huntress guild logic."""
        # Load configuration from file if available
        config_path = self._workspace_root / "config" / "default.json"
        if config_path.exists():
            with open(config_path, "r") as f:
                config_data = json.load(f)
                self.config = HuntressGuildConfig(**config_data)

    async def shutdown(self) -> None:
        """Shutdown the huntress guild logic."""
        pass

    def _parse_input(self, input_data: Any) -> HuntressGuildInput:
        """Parse input data into HuntressGuildInput."""
        if isinstance(input_data, dict):
            return HuntressGuildInput(**input_data)
        elif isinstance(input_data, str):
            # Simple string command
            return HuntressGuildInput(command=input_data)
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

    async def _execute_command(
        self, huntress_input: HuntressGuildInput
    ) -> HuntressGuildOutput:
        """Execute the specified huntress command."""
        start_time = asyncio.get_event_loop().time()

        try:
            if huntress_input.command == "analyze_tests":
                result = await self._analyze_tests(huntress_input)
            elif huntress_input.command == "triage_regression":
                result = await self._triage_regression(huntress_input)
            elif huntress_input.command == "scout_signals":
                result = await self._scout_signals(huntress_input)
            elif huntress_input.command == "report_incidents":
                result = await self._report_incidents(huntress_input)
            else:
                raise ValueError(f"Unknown command: {huntress_input.command}")

            execution_time = asyncio.get_event_loop().time() - start_time

            return HuntressGuildOutput(
                command=huntress_input.command,
                success=True,
                result=result,
                message=f"Command '{huntress_input.command}' completed successfully",
                execution_time=execution_time,
            )

        except Exception as e:
            execution_time = asyncio.get_event_loop().time() - start_time
            return HuntressGuildOutput(
                command=huntress_input.command,
                success=False,
                result=None,
                message=f"Command '{huntress_input.command}' failed: {str(e)}",
                execution_time=execution_time,
            )

    async def _analyze_tests(self, input_data: HuntressGuildInput) -> FlakyTestAnalysis:
        """Analyze test results for flaky tests."""
        if not input_data.test_results:
            raise ValueError("Test results required for analysis")

        # Analyze test runs for flakiness patterns
        flaky_tests = await self._detect_flaky_tests(input_data.test_results)

        # Return the most problematic flaky test
        if flaky_tests:
            return max(flaky_tests, key=lambda x: x.confidence_score)
        else:
            return FlakyTestAnalysis(
                test_name="",
                failure_rate=0.0,
                recent_runs=[],
                patterns=[],
                recommendations=["No flaky tests detected"],
                confidence_score=0.0,
            )

    async def _triage_regression(
        self, input_data: HuntressGuildInput
    ) -> RegressionAnalysis:
        """Triage a regression from test failures."""
        if not input_data.commit_hash:
            raise ValueError("Commit hash required for regression triage")

        # Analyze git history and test results
        affected_tests = await self._find_affected_tests(input_data.commit_hash)
        root_cause = await self._analyze_root_cause(
            input_data.commit_hash, affected_tests
        )

        return RegressionAnalysis(
            commit_hash=input_data.commit_hash,
            affected_tests=affected_tests,
            severity=IncidentSeverity.HIGH,  # Default to high for regressions
            root_cause_hypothesis=root_cause,
            remediation_steps=["Revert commit", "Fix the issue", "Add regression test"],
            impact_assessment="High impact - affects core functionality",
        )

    async def _scout_signals(self, input_data: HuntressGuildInput) -> Dict[str, Any]:
        """Scout for early signals in logs and metrics."""
        signals = {}

        # Analyze log files
        if input_data.log_files:
            signals["log_analysis"] = await self._analyze_logs(input_data.log_files)

        # Look for performance trends
        signals["performance_trends"] = await self._analyze_performance_trends()

        # Check for error patterns
        signals["error_patterns"] = await self._detect_error_patterns()

        return signals

    async def _report_incidents(
        self, input_data: HuntressGuildInput
    ) -> List[IncidentReport]:
        """Generate incident reports from analysis."""
        incidents = []

        # Check for critical issues
        critical_issues = await self._scan_for_critical_issues()

        for issue in critical_issues:
            incidents.append(
                IncidentReport(
                    id=f"incident_{len(incidents) + 1}",
                    title=issue["title"],
                    severity=issue["severity"],
                    description=issue["description"],
                    affected_components=issue["components"],
                    tags=issue["tags"],
                    created_at=asyncio.get_event_loop().time().__str__(),
                )
            )

        return incidents

    async def _detect_flaky_tests(
        self, test_results: TestSuiteResult
    ) -> List[FlakyTestAnalysis]:
        """Detect potentially flaky tests from test results."""
        flaky_tests = []

        # Group tests by name
        test_groups = {}
        for run in test_results.test_runs:
            if run.name not in test_groups:
                test_groups[run.name] = []
            test_groups[run.name].append(run)

        # Analyze each test group
        for test_name, runs in test_groups.items():
            if len(runs) < self.config.test_analysis.min_runs_for_flaky_detection:
                continue

            failure_rate = sum(1 for r in runs if r.result == TestResult.FAILED) / len(
                runs
            )

            if failure_rate >= self.config.test_analysis.flaky_threshold:
                patterns = await self._identify_flaky_patterns(runs)
                recommendations = await self._generate_recommendations(
                    test_name, patterns
                )

                flaky_tests.append(
                    FlakyTestAnalysis(
                        test_name=test_name,
                        failure_rate=failure_rate,
                        recent_runs=runs[-10:],  # Last 10 runs
                        patterns=patterns,
                        recommendations=recommendations,
                        confidence_score=min(failure_rate * 2, 1.0),  # Scale confidence
                    )
                )

        return flaky_tests

    async def _identify_flaky_patterns(self, runs: List[TestRun]) -> List[str]:
        """Identify patterns in flaky test failures."""
        patterns = []

        # Check for timeout patterns
        timeout_failures = [
            r for r in runs if "timeout" in (r.error_message or "").lower()
        ]
        if len(timeout_failures) > len(runs) * 0.3:
            patterns.append("timeout_issues")

        # Check for network-related failures
        network_failures = [
            r
            for r in runs
            if "network" in (r.error_message or "").lower()
            or "connection" in (r.error_message or "").lower()
        ]
        if len(network_failures) > len(runs) * 0.2:
            patterns.append("network_issues")

        # Check for race conditions
        race_failures = [r for r in runs if "race" in (r.error_message or "").lower()]
        if race_failures:
            patterns.append("race_conditions")

        return patterns

    async def _generate_recommendations(
        self, test_name: str, patterns: List[str]
    ) -> List[str]:
        """Generate recommendations for fixing flaky tests."""
        recommendations = []

        if "timeout_issues" in patterns:
            recommendations.append("Increase timeout or optimize test performance")
        if "network_issues" in patterns:
            recommendations.append("Add network mocking or retry logic")
        if "race_conditions" in patterns:
            recommendations.append("Add proper synchronization or use await properly")

        recommendations.append("Add retry logic with exponential backoff")
        recommendations.append("Isolate test dependencies and state")

        return recommendations

    async def _find_affected_tests(self, commit_hash: str) -> List[str]:
        """Find tests affected by a specific commit."""
        # This would integrate with git and test result history
        # For now, return a placeholder
        return ["test_example.py::test_feature"]

    async def _analyze_root_cause(
        self, commit_hash: str, affected_tests: List[str]
    ) -> str:
        """Analyze the root cause of a regression."""
        # This would analyze git diff, code changes, etc.
        return "Code changes in commit introduced breaking changes to API"

    async def _analyze_logs(self, log_files: List[str]) -> Dict[str, Any]:
        """Analyze log files for patterns and issues."""
        analysis = {
            "error_count": 0,
            "warning_count": 0,
            "patterns": [],
            "critical_issues": [],
        }

        for log_file in log_files:
            if pathlib.Path(log_file).exists():
                with open(log_file, "r") as f:
                    content = f.read()

                analysis["error_count"] += len(re.findall(r"ERROR|error", content))
                analysis["warning_count"] += len(
                    re.findall(r"WARNING|warning", content)
                )

        return analysis

    async def _analyze_performance_trends(self) -> Dict[str, Any]:
        """Analyze performance trends."""
        # Placeholder for performance analysis
        return {"trend": "stable", "insights": []}

    async def _detect_error_patterns(self) -> Dict[str, Any]:
        """Detect error patterns across the system."""
        # Placeholder for error pattern detection
        return {"patterns": [], "frequency": {}}

    async def _scan_for_critical_issues(self) -> List[Dict[str, Any]]:
        """Scan for critical issues that need incident reports."""
        # Placeholder - would scan logs, metrics, etc.
        return []
