"""
Comprehensive test suite for Mages Guild functionality.

This module tests all aspects of the Mages Guild package including
quality gates, vault validation, anomaly detection, and forecasting.
"""

import asyncio
import sys
import unittest
from pathlib import Path

# Add the src directory to Python path for local development
src_path = Path(__file__).parent / "src"
if src_path.exists():
    sys.path.insert(0, str(src_path))

from goblinos.interface import GoblinConfig, GoblinContext, GoblinResult

from mages_guild.goblin import MagesGuildGoblin
from mages_guild.logic import MagesGuildLogic
from mages_guild.schema import MagesGuildConfig
from mages_guild.types import (
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
    MagesGuildResult,
)


class TestMagesGuildLogic(unittest.IsolatedAsyncioTestCase):
    """Test the core business logic of Mages Guild."""

    async def asyncSetUp(self):
        """Set up test fixtures."""
        self.config = MagesGuildConfig()
        self.logic = MagesGuildLogic(self.config)

    def test_initialization(self):
        """Test that logic initializes correctly."""
        self.assertIsNotNone(self.logic.config)
        self.assertIsInstance(self.logic.config, MagesGuildConfig)

    async def test_quality_gate_execution(self):
        """Test quality gate execution."""
        context = GoblinContext(input={"command": "quality:lint"})
        report = await self.logic.execute_quality_gate(context)

        self.assertIsInstance(report, QualityReport)
        self.assertIsInstance(report.success, bool)
        self.assertIsInstance(report.total_files_checked, int)
        self.assertIsInstance(report.issues_found, list)
        self.assertIsInstance(report.execution_time_seconds, float)

    async def test_vault_validation_execution(self):
        """Test vault validation execution."""
        context = GoblinContext(input={"command": "vault:validate"})
        report = await self.logic.execute_vault_validation(context)

        self.assertIsInstance(report, VaultValidationReport)
        self.assertIsInstance(report.success, bool)
        self.assertIsInstance(report.total_files_checked, int)
        self.assertIsInstance(report.issues_found, list)

    async def test_anomaly_detection_execution(self):
        """Test anomaly detection execution."""
        context = GoblinContext(input={"command": "anomaly:detect"})
        report = await self.logic.execute_anomaly_detection(context)

        self.assertIsInstance(report, AnomalyReport)
        self.assertEqual(report.time_window_minutes, 60)
        self.assertIsInstance(report.anomalies_detected, list)

    async def test_forecasting_execution(self):
        """Test forecasting execution."""
        context = GoblinContext(input={"command": "forecast:risk"})
        assessment = await self.logic.execute_forecasting(context)

        self.assertIsInstance(assessment, ReleaseRiskAssessment)
        self.assertIsInstance(assessment.overall_risk_score, float)
        self.assertIsInstance(assessment.risk_factors, list)
        self.assertIsInstance(assessment.metrics_analyzed, list)

    async def test_shutdown(self):
        """Test shutdown functionality."""
        await self.logic.shutdown()
        # Should not raise any exceptions


class TestMagesGuildGoblin(unittest.IsolatedAsyncioTestCase):
    """Test the GoblinInterface implementation."""

    async def asyncSetUp(self):
        """Set up test fixtures."""
        self.goblin = MagesGuildGoblin()
        await self.goblin.initialize(
            GoblinConfig(id="test-mages-guild", working_dir=str(Path.cwd()))
        )

    def test_initialization(self):
        """Test goblin initialization."""
        self.assertIsNotNone(self.goblin.config)
        self.assertIsInstance(self.goblin.config, MagesGuildConfig)

    def test_capabilities(self):
        """Test goblin capabilities."""
        capabilities = self.goblin.get_capabilities()
        self.assertEqual(capabilities.name, "Mages Guild")
        self.assertIn("quality gates", capabilities.description.lower())

    async def test_quality_lint_command(self):
        """Test quality:lint command execution."""
        context = GoblinContext(input={"command": "quality:lint"})
        result = await self.goblin.execute(context)

        self.assertIsInstance(result, GoblinResult)
        self.assertIsInstance(result.success, bool)
        self.assertIsInstance(result.output, MagesGuildResult)

    async def test_vault_validate_command(self):
        """Test vault:validate command execution."""
        context = GoblinContext(input={"command": "vault:validate"})
        result = await self.goblin.execute(context)

        self.assertIsInstance(result, GoblinResult)
        self.assertIsInstance(result.success, bool)
        self.assertIsInstance(result.output, MagesGuildResult)

    async def test_unknown_command(self):
        """Test handling of unknown commands."""
        context = GoblinContext(input={"command": "unknown:command"})
        result = await self.goblin.execute(context)

        self.assertIsInstance(result, GoblinResult)
        self.assertFalse(result.success)
        self.assertIn("Unknown command", result.output.summary)

    async def test_shutdown(self):
        """Test goblin shutdown."""
        await self.goblin.shutdown()
        # Should not raise any exceptions


class TestConfigurationValidation(unittest.TestCase):
    """Test configuration validation and schema compliance."""

    def test_default_config_creation(self):
        """Test that default configuration can be created."""
        config = MagesGuildConfig()
        self.assertIsInstance(config, MagesGuildConfig)
        self.assertIsInstance(config.quality_gate, object)
        self.assertIsInstance(config.vault_validation, object)

    def test_config_with_custom_values(self):
        """Test configuration with custom values."""
        config = MagesGuildConfig(
            quality_gate={"enabled_checks": ["lint", "security"], "fail_on_warnings": True},
            verbose_logging=True,
        )

        self.assertEqual(config.quality_gate.enabled_checks, ["lint", "security"])
        self.assertTrue(config.quality_gate.fail_on_warnings)
        self.assertTrue(config.verbose_logging)

    def test_config_validation(self):
        """Test configuration validation."""
        # Valid config should work
        config = MagesGuildConfig()
        self.assertIsNotNone(config)

        # Invalid timeout should raise error
        with self.assertRaises(ValueError):
            MagesGuildConfig(timeout_seconds=10)  # Too low


class TestDataModels(unittest.TestCase):
    """Test data model creation and validation."""

    def test_quality_issue_creation(self):
        """Test QualityIssue model creation."""
        issue = QualityIssue(
            file_path="test.py",
            line_number=10,
            rule_id="E001",
            message="Test issue",
            severity=Severity.HIGH,
            check_type=QualityCheckType.LINT,
        )

        self.assertEqual(issue.file_path, "test.py")
        self.assertEqual(issue.severity, Severity.HIGH)
        self.assertEqual(issue.check_type, QualityCheckType.LINT)

    def test_quality_report_creation(self):
        """Test QualityReport model creation."""
        report = QualityReport(
            total_files_checked=5,
            issues_found=[],
            issues_by_severity={},
            issues_by_type={},
            execution_time_seconds=1.5,
            success=True,
        )

        self.assertEqual(report.total_files_checked, 5)
        self.assertTrue(report.success)
        self.assertEqual(report.execution_time_seconds, 1.5)

    def test_vault_issue_creation(self):
        """Test VaultIssue model creation."""
        issue = VaultIssue(
            file_path="vault/test.md",
            issue_type=VaultValidationType.YAML_FRONTMATTER,
            message="Missing frontmatter",
            severity=Severity.MEDIUM,
        )

        self.assertEqual(issue.issue_type, VaultValidationType.YAML_FRONTMATTER)
        self.assertEqual(issue.severity, Severity.MEDIUM)

    def test_anomaly_result_creation(self):
        """Test AnomalyDetectionResult model creation."""
        anomaly = AnomalyDetectionResult(
            anomaly_type=AnomalyType.METRIC_SPIKE,
            metric_name="response_time",
            current_value=150.0,
            expected_value=50.0,
            deviation_percentage=200.0,
            confidence_score=0.9,
            detection_timestamp="2024-01-01T12:00:00Z",
            historical_context={},
        )

        self.assertEqual(anomaly.anomaly_type, AnomalyType.METRIC_SPIKE)
        self.assertEqual(anomaly.confidence_score, 0.9)

    def test_forecasting_assessment_creation(self):
        """Test ReleaseRiskAssessment model creation."""
        assessment = ReleaseRiskAssessment(
            overall_risk_score=0.3,
            risk_factors=["Slow builds"],
            confidence_interval={"low": 0.2, "high": 0.4},
            recommended_actions=["Optimize build"],
            forecast_horizon_days=30,
            metrics_analyzed=[],
        )

        self.assertEqual(assessment.overall_risk_score, 0.3)
        self.assertEqual(len(assessment.risk_factors), 1)

    def test_mages_guild_result_creation(self):
        """Test MagesGuildResult model creation."""
        result = MagesGuildResult(
            success=True, summary="All checks passed", execution_time_seconds=2.5
        )

        self.assertTrue(result.success)
        self.assertEqual(result.summary, "All checks passed")
        self.assertEqual(result.execution_time_seconds, 2.5)


class TestIntegration(unittest.IsolatedAsyncioTestCase):
    """Integration tests for end-to-end functionality."""

    async def asyncSetUp(self):
        """Set up integration test fixtures."""
        self.goblin = MagesGuildGoblin()
        self.config = GoblinConfig(
            {
                "repo_root": Path.cwd(),
                "mages_guild": {
                    "quality_gate": {
                        "enabled_checks": ["lint"],
                        "lint_paths": ["."],
                        "exclude_patterns": ["test_*"],
                    },
                    "vault_validation": {"vault_path": "vault", "require_frontmatter": True},
                    "anomaly_detection": {
                        "enabled_detectors": ["metric_spike"],
                        "time_window_minutes": 60,
                    },
                    "forecasting": {"forecast_horizon_days": 30},
                },
            }
        )
        await self.goblin.initialize(self.config)

    async def test_full_quality_gate_workflow(self):
        """Test complete quality gate workflow."""
        context = GoblinContext({"command": "quality:lint"})
        result = await self.goblin.execute(context)

        # Should complete without errors
        self.assertIsInstance(result, GoblinResult)
        self.assertIsInstance(result.success, bool)

        # Should have result data
        self.assertIsInstance(result.output, MagesGuildResult)
        if result.output.quality_report:
            report_data = result.output.quality_report
            self.assertIsInstance(report_data.success, bool)
            self.assertIsInstance(report_data.total_files_checked, int)

    async def test_multiple_command_execution(self):
        """Test executing multiple commands in sequence."""
        commands = ["quality:lint", "vault:validate", "forecast:risk"]

        for command in commands:
            context = GoblinContext(input={"command": command})
            result = await self.goblin.execute(context)

            self.assertIsInstance(result, GoblinResult)
            self.assertIsInstance(result.success, bool)


if __name__ == "__main__":
    # Run async tests
    async def run_async_tests():
        # Create test instances
        logic_test = TestMagesGuildLogic()
        await logic_test.asyncSetUp()

        goblin_test = TestMagesGuildGoblin()
        await goblin_test.asyncSetUp()

        integration_test = TestIntegration()
        await integration_test.asyncSetUp()

        # Run async test methods
        await logic_test.test_quality_gate_execution()
        await logic_test.test_vault_validation_execution()
        await logic_test.test_anomaly_detection_execution()
        await logic_test.test_forecasting_execution()
        await logic_test.test_shutdown()

        await goblin_test.test_quality_lint_command()
        await goblin_test.test_vault_validate_command()
        await goblin_test.test_unknown_command()
        await goblin_test.test_shutdown()

        await integration_test.test_full_quality_gate_workflow()
        await integration_test.test_multiple_command_execution()

        print("✅ All async tests passed!")

    # Run sync tests
    unittest.main(exit=False)

    # Run async tests
    asyncio.run(run_async_tests())
