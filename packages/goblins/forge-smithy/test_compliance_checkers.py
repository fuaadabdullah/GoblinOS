"""
Tests for Smithy Compliance Checkers

Tests for the concrete compliance checker implementations.
"""

import asyncio
import json

import pytest

from smithy.automation.compliance_checkers import (
    GDPRComplianceChecker,
    HIPAAComplianceChecker,
    SOC2ComplianceChecker,
)


class TestGDPRComplianceChecker:
    """Test the GDPR Compliance Checker"""

    @pytest.fixture
    def checker(self):
        """Create a GDPR compliance checker"""
        return GDPRComplianceChecker()

    def test_check_data_processing_inventory_compliant(self, checker, tmp_path):
        """Test GDPR data processing inventory check when compliant"""
        # Create required files
        inventory_file = tmp_path / "data_processing_inventory.json"
        inventory_file.write_text('{"processing_activities": ["user_data_collection"]}')

        records_file = tmp_path / "processing_records.csv"
        records_file.write_text("activity,purpose,legal_basis\nuser_collection,analytics,consent")

        data_dir = tmp_path / "data_inventory"
        data_dir.mkdir()

        # Temporarily change base path
        checker.file_collector.base_path = tmp_path

        result = asyncio.run(checker.check_data_processing_inventory())

        assert result.status.name == "COMPLIANT"
        assert not result.remediation_required
        assert len(result.evidence) == 3  # 2 files + 1 directory

    def test_check_data_processing_inventory_non_compliant(self, checker, tmp_path):
        """Test GDPR data processing inventory check when non-compliant"""
        # Don't create any files
        checker.file_collector.base_path = tmp_path

        result = asyncio.run(checker.check_data_processing_inventory())

        assert result.status.name == "NON_COMPLIANT"
        assert result.remediation_required
        assert len(result.evidence) == 3  # 2 files + 1 directory (all missing)

    def test_check_data_subject_rights_compliant(self, checker):
        """Test GDPR data subject rights check when compliant"""
        result = asyncio.run(checker.check_data_subject_rights())

        # Since we're using simulated API calls, this should be compliant
        assert result.status.name == "COMPLIANT"
        assert not result.remediation_required
        assert len(result.evidence) == 5  # 3 API endpoints + 2 commands


class TestSOC2ComplianceChecker:
    """Test the SOC2 Compliance Checker"""

    @pytest.fixture
    def checker(self, tmp_path):
        """Create a SOC2 compliance checker"""
        return SOC2ComplianceChecker(config_paths=[tmp_path], scan_results_path=str(tmp_path))

    def test_check_security_controls_compliant(self, checker, tmp_path):
        """Test SOC2 security controls check when compliant"""
        # Create config files
        security_config = tmp_path / "security.json"
        security_config.write_text('{"enabled": true}')

        app_config = tmp_path / "app.conf"
        app_config.write_text("security.encryption=AES256")

        # Create security scan results
        scan_file = tmp_path / "vulnerability_scan.json"
        scan_file.write_text(
            json.dumps(
                {
                    "scan_date": "2025-10-26T10:00:00",
                    "findings": [{"severity": "low", "status": "passed"}],
                }
            )
        )

        result = asyncio.run(checker.check_security_controls())

        assert result.status.name == "COMPLIANT"
        assert not result.remediation_required
        assert len(result.evidence) == 3  # 2 config + 1 scan

    def test_check_security_controls_non_compliant(self, checker, tmp_path):
        """Test SOC2 security controls check when non-compliant"""
        # Create config with wrong values
        security_config = tmp_path / "security.json"
        security_config.write_text('{"enabled": false}')

        result = asyncio.run(checker.check_security_controls())

        assert result.status.name == "NON_COMPLIANT"
        assert result.remediation_required

    def test_check_change_management_compliant(self, checker):
        """Test SOC2 change management check when compliant"""
        result = asyncio.run(checker.check_change_management())

        # Database queries are simulated to return success
        assert result.status.name == "COMPLIANT"
        assert not result.remediation_required
        assert len(result.evidence) == 2  # 2 database queries


class TestHIPAAComplianceChecker:
    """Test the HIPAA Compliance Checker"""

    @pytest.fixture
    def checker(self, tmp_path):
        """Create a HIPAA compliance checker"""
        return HIPAAComplianceChecker(
            base_path=str(tmp_path), config_paths=[tmp_path], scan_results_path=str(tmp_path)
        )

    def test_check_phi_protection_compliant(self, checker, tmp_path):
        """Test HIPAA PHI protection check when compliant"""
        # Create config files
        security_config = tmp_path / "security.json"
        security_config.write_text('{"phi": {"encryption": {"enabled": true}}}')

        access_config = tmp_path / "access.conf"
        access_config.write_text("phi.access_control=role_based")

        # Create required files
        audit_file = tmp_path / "phi_audit.log"
        audit_file.write_text("2025-10-26: PHI access logged")

        keys_file = tmp_path / "encryption_keys.json"
        keys_file.write_text('{"keys": ["key1", "key2"]}')

        # Create security scan results
        scan_file = tmp_path / "phi_security_scan.json"
        scan_file.write_text(json.dumps({"scan_date": "2025-10-26T10:00:00", "findings": []}))

        result = asyncio.run(checker.check_phi_protection())

        assert result.status.name == "COMPLIANT"
        assert not result.remediation_required
        assert len(result.evidence) == 5  # 2 config + 2 files + 1 scan

    def test_check_phi_protection_non_compliant(self, checker, tmp_path):
        """Test HIPAA PHI protection check when non-compliant"""
        # Create config with wrong values
        security_config = tmp_path / "security.json"
        security_config.write_text('{"phi": {"encryption": {"enabled": false}}}')

        result = asyncio.run(checker.check_phi_protection())

        assert result.status.name == "NON_COMPLIANT"
        assert result.remediation_required

    def test_check_breach_notification_compliant(self, checker, tmp_path):
        """Test HIPAA breach notification check when compliant"""
        # Create required files
        procedures_file = tmp_path / "breach_notification_procedures.pdf"
        procedures_file.write_text("%PDF-1.4 mock content")

        plan_file = tmp_path / "incident_response_plan.pdf"
        plan_file.write_text("%PDF-1.4 mock content")

        templates_file = tmp_path / "notification_templates.docx"
        templates_file.write_text("Mock DOCX content")

        # Create directory
        breach_dir = tmp_path / "breach_notifications"
        breach_dir.mkdir()

        result = asyncio.run(checker.check_breach_notification())

        assert result.status.name == "COMPLIANT"
        assert not result.remediation_required
        assert len(result.evidence) == 4  # 3 files + 1 directory

    def test_check_breach_notification_non_compliant(self, checker, tmp_path):
        """Test HIPAA breach notification check when non-compliant"""
        # Don't create any files
        result = asyncio.run(checker.check_breach_notification())

        assert result.status.name == "NON_COMPLIANT"
        assert result.remediation_required
        assert len(result.evidence) == 4  # 3 files + 1 directory (all missing)


if __name__ == "__main__":
    pytest.main([__file__])
