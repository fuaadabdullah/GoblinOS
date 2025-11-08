"""Tests for smithy controls module."""

import json
from unittest.mock import patch, MagicMock
from smithy.controls import (
    PolicyEngine, UpdateManager, ComplianceManager,
    DependencyPolicy, UpdateSchedule, UpdateResult, PolicyViolation,
    create_dependency_policy, check_compliance, schedule_updates
)


class TestPolicyEngine:
    """Test PolicyEngine functionality."""

    def test_policy_creation(self):
        """Test creating dependency policies."""
        engine = PolicyEngine()

        # Check default policies are loaded
        assert "security_updates" in engine.policies
        assert "license_compliance" in engine.policies
        assert "version_stability" in engine.policies
        assert "maintenance_status" in engine.policies

    def test_add_custom_policy(self, tmp_path):
        """Test adding a custom policy."""
        with patch('smithy.controls.ROOT', tmp_path):
            engine = PolicyEngine()

            policy = DependencyPolicy(
                name="test_policy",
                description="Test policy",
                rules={"test": "value"}
            )

            success = engine.add_policy(policy)
            assert success is True
            assert "test_policy" in engine.policies

            # Check policy was saved to file
            policy_file = tmp_path / ".smithy" / "policies" / "test_policy.json"
            assert policy_file.exists()

            data = json.loads(policy_file.read_text())
            assert data["name"] == "test_policy"
            assert data["rules"]["test"] == "value"

    def test_remove_policy(self, tmp_path):
        """Test removing a policy."""
        with patch('smithy.controls.ROOT', tmp_path):
            engine = PolicyEngine()

            policy = DependencyPolicy(
                name="test_policy",
                description="Test policy",
                rules={"test": "value"}
            )

            engine.add_policy(policy)
            assert "test_policy" in engine.policies

            success = engine.remove_policy("test_policy")
            assert success is True
            assert "test_policy" not in engine.policies

    def test_check_policy_violations_security(self):
        """Test security policy violation checking."""
        engine = PolicyEngine()

        # Mock package info with security issues
        class MockPackageInfo:
            has_security_issues = True

        violations = engine.check_policy_violations("test-pkg", MockPackageInfo())
        security_violations = [v for v in violations if v.policy_name == "security_updates"]
        assert len(security_violations) == 1
        assert "security vulnerabilities" in security_violations[0].violation

    def test_check_policy_violations_license(self):
        """Test license policy violation checking."""
        engine = PolicyEngine()

        # Mock package info with blocked license
        class MockPackageInfo:
            license = "GPL-3.0"

        violations = engine.check_policy_violations("test-pkg", MockPackageInfo())
        license_violations = [v for v in violations if v.policy_name == "license_compliance"]
        assert len(license_violations) == 1
        assert "GPL-3.0" in license_violations[0].violation

    def test_check_policy_violations_version_stability(self):
        """Test version stability policy violation checking."""
        engine = PolicyEngine()

        # Mock package info with major version update
        class MockPackageInfo:
            version = "1.0.0"
            latest_version = "2.0.0"

        violations = engine.check_policy_violations("test-pkg", MockPackageInfo())
        version_violations = [v for v in violations if v.policy_name == "version_stability"]
        assert len(version_violations) == 1
        assert "Major version update" in version_violations[0].violation


class TestUpdateManager:
    """Test UpdateManager functionality."""

    @patch('subprocess.run')
    def test_check_for_updates(self, mock_run, tmp_path):
        """Test checking for package updates."""
        with patch('smithy.controls.ROOT', tmp_path):
            manager = UpdateManager()

            # Mock uv pip list output
            mock_run.return_value = MagicMock(
                returncode=0,
                stdout=json.dumps([
                    {"name": "requests", "version": "2.25.0"},
                    {"name": "click", "version": "8.0.0"}
                ])
            )

            with patch.object(manager, '_check_environment_updates') as mock_check:
                mock_check.return_value = [
                    UpdateResult(
                        package="requests",
                        old_version="2.25.0",
                        new_version="2.31.0",
                        success=True
                    )
                ]

                updates = manager.check_for_updates()
                assert "dev" in updates
                assert len(updates["dev"]) == 1
                assert updates["dev"][0].package == "requests"

    def test_create_update_schedule(self, tmp_path):
        """Test creating update schedule."""
        with patch('smithy.controls.ROOT', tmp_path):
            manager = UpdateManager()

            schedule = UpdateSchedule(
                frequency="weekly",
                time_of_day="02:00",
                environments=["dev", "staging"]
            )

            success = manager.create_update_schedule(schedule)
            assert success is True

            # Check schedule was saved
            schedule_file = tmp_path / ".smithy" / "updates" / "schedule.json"
            assert schedule_file.exists()

            data = json.loads(schedule_file.read_text())
            assert data["frequency"] == "weekly"
            assert data["time_of_day"] == "02:00"
            assert data["environments"] == ["dev", "staging"]

    @patch('subprocess.run')
    def test_apply_updates_dry_run(self, mock_run, tmp_path):
        """Test applying updates in dry run mode."""
        with patch('smithy.controls.ROOT', tmp_path):
            manager = UpdateManager()

            updates = [
                UpdateResult(
                    package="requests",
                    old_version="2.25.0",
                    new_version="2.31.0",
                    success=True
                )
            ]

            success, messages = manager.apply_updates(updates, dry_run=True)
            assert success is True
            assert len(messages) == 1
            assert "Would update requests" in messages[0]

            # uv should not be called in dry run
            mock_run.assert_not_called()

    @patch('subprocess.run')
    def test_apply_updates_real(self, mock_run, tmp_path):
        """Test applying updates for real."""
        with patch('smithy.controls.ROOT', tmp_path):
            manager = UpdateManager()

            # Mock successful uv update
            mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

            updates = [
                UpdateResult(
                    package="requests",
                    old_version="2.25.0",
                    new_version="2.31.0",
                    success=True
                )
            ]

            success, messages = manager.apply_updates(updates, dry_run=False)
            assert success is True
            assert len(messages) == 1
            assert "Updated requests" in messages[0]

            # uv should be called
            mock_run.assert_called()

    def test_version_comparison(self, tmp_path):
        """Test version comparison logic."""
        with patch('smithy.controls.ROOT', tmp_path):
            manager = UpdateManager()

            # Test newer version detection
            assert manager._is_newer_version("1.0.0", "1.1.0") is True
            assert manager._is_newer_version("1.1.0", "1.0.0") is False
            assert manager._is_newer_version("1.0.0", "1.0.0") is False
            assert manager._is_newer_version("2.0.0", "1.9.9") is False


class TestComplianceManager:
    """Test ComplianceManager functionality."""

    @patch('subprocess.run')
    def test_audit_compliance(self, mock_run, tmp_path):
        """Test compliance auditing."""
        with patch('smithy.controls.ROOT', tmp_path):
            manager = ComplianceManager()

            # Mock uv pip list output
            mock_run.return_value = MagicMock(
                returncode=0,
                stdout=json.dumps([
                    {"name": "requests", "version": "2.25.0"}
                ])
            )

            with patch.object(manager.policy_engine, 'check_policy_violations') as mock_check:
                mock_check.return_value = [
                    PolicyViolation(
                        policy_name="test_policy",
                        package="requests",
                        violation="Test violation",
                        severity="warning"
                    )
                ]

                compliant, violations = manager.audit_compliance()
                assert compliant is False
                assert len(violations) == 1
                assert violations[0].policy_name == "test_policy"

    def test_generate_compliance_report(self, tmp_path):
        """Test compliance report generation."""
        with patch('smithy.controls.ROOT', tmp_path):
            manager = ComplianceManager()

            with patch.object(manager, 'audit_compliance') as mock_audit:
                mock_audit.return_value = (False, [
                    PolicyViolation(
                        policy_name="security_updates",
                        package="requests",
                        violation="Security vulnerability found",
                        severity="error",
                        suggestion="Update to latest version"
                    )
                ])

                report = manager.generate_compliance_report()

                assert "Dependency Compliance Report" in report
                assert "❌ Non-Compliant" in report
                assert "Security vulnerability found" in report
                assert "Update to latest version" in report

    def test_export_compliance_data(self, tmp_path):
        """Test exporting compliance data."""
        with patch('smithy.controls.ROOT', tmp_path):
            manager = ComplianceManager()

            with patch.object(manager, 'audit_compliance') as mock_audit:
                mock_audit.return_value = (True, [])

                output_file = tmp_path / "compliance.json"
                success = manager.export_compliance_data(output_file)

                assert success is True
                assert output_file.exists()

                data = json.loads(output_file.read_text())
                assert data["compliant"] is True
                assert len(data["violations"]) == 0


class TestConvenienceFunctions:
    """Test convenience functions."""

    def test_create_dependency_policy(self, tmp_path):
        """Test create_dependency_policy convenience function."""
        with patch('smithy.controls.ROOT', tmp_path):
            success = create_dependency_policy(
                "test_policy",
                "Test policy description",
                {"rule": "value"}
            )
            assert success is True

    @patch('subprocess.run')
    def test_check_compliance_function(self, mock_run, tmp_path):
        """Test check_compliance convenience function."""
        with patch('smithy.controls.ROOT', tmp_path):
            mock_run.return_value = MagicMock(
                returncode=0,
                stdout=json.dumps([])
            )

            compliant, violations = check_compliance()
            assert compliant is True
            assert len(violations) == 0

    def test_schedule_updates_function(self, tmp_path):
        """Test schedule_updates convenience function."""
        with patch('smithy.controls.ROOT', tmp_path):
            success = schedule_updates("daily", "03:00")
            assert success is True


class TestDataClasses:
    """Test data class definitions."""

    def test_dependency_policy_creation(self):
        """Test DependencyPolicy creation."""
        policy = DependencyPolicy(
            name="test",
            description="Test policy",
            rules={"key": "value"},
            enabled=False,
            severity="error"
        )

        assert policy.name == "test"
        assert policy.description == "Test policy"
        assert policy.rules["key"] == "value"
        assert policy.enabled is False
        assert policy.severity == "error"

    def test_update_schedule_creation(self):
        """Test UpdateSchedule creation."""
        schedule = UpdateSchedule(
            frequency="monthly",
            time_of_day="01:00",
            days_of_week=[1, 15],
            environments=["prod"],
            auto_merge=True,
            notify_on_failure=False
        )

        assert schedule.frequency == "monthly"
        assert schedule.time_of_day == "01:00"
        assert schedule.days_of_week == [1, 15]
        assert schedule.environments == ["prod"]
        assert schedule.auto_merge is True
        assert schedule.notify_on_failure is False

    def test_update_result_creation(self):
        """Test UpdateResult creation."""
        result = UpdateResult(
            package="requests",
            old_version="2.25.0",
            new_version="2.31.0",
            success=True,
            changelog="Fixed security issue",
            breaking_changes=False,
            security_fixes=True,
            errors=[]
        )

        assert result.package == "requests"
        assert result.old_version == "2.25.0"
        assert result.new_version == "2.31.0"
        assert result.success is True
        assert result.changelog == "Fixed security issue"
        assert result.breaking_changes is False
        assert result.security_fixes is True
        assert len(result.errors) == 0

    def test_policy_violation_creation(self):
        """Test PolicyViolation creation."""
        violation = PolicyViolation(
            policy_name="license_compliance",
            package="bad-package",
            violation="GPL license not allowed",
            severity="error",
            suggestion="Use MIT licensed alternative"
        )

        assert violation.policy_name == "license_compliance"
        assert violation.package == "bad-package"
        assert violation.violation == "GPL license not allowed"
        assert violation.severity == "error"
        assert violation.suggestion == "Use MIT licensed alternative"
