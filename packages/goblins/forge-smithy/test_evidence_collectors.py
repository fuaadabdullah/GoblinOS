"""
Test Evidence Collectors

Tests for the evidence collector implementations including:
- FileSystemEvidenceCollector: File system evidence collection
- DatabaseEvidenceCollector: Database query evidence collection
- APIEvidenceCollector: API endpoint evidence collection
- ConfigurationEvidenceCollector: Configuration file evidence collection
- SecurityScanEvidenceCollector: Security scan results evidence collection
- CommandEvidenceCollector: System command evidence collection
"""

import asyncio
import json

import pytest

from smithy.automation.compliance import ComplianceFramework, ComplianceRequirement, PolicySeverity
from smithy.automation.evidence_collectors import (
    APIEvidenceCollector,
    CommandEvidenceCollector,
    ConfigurationEvidenceCollector,
    DatabaseEvidenceCollector,
    FileSystemEvidenceCollector,
    SecurityScanEvidenceCollector,
)


class TestFileSystemEvidenceCollector:
    """Test the File System Evidence Collector"""

    @pytest.fixture
    def collector(self, tmp_path):
        """Create a file system evidence collector"""
        return FileSystemEvidenceCollector(base_path=tmp_path)

    @pytest.fixture
    def file_requirement(self):
        """Create a requirement that checks for files"""
        return ComplianceRequirement(
            id="test-file-check",
            framework=ComplianceFramework.GDPR,
            title="File Existence Check",
            description="Check for required files",
            severity=PolicySeverity.MEDIUM,
            category="data_protection",
            controls=["GDPR-5.1"],
            evidence_required=["file_existence"],
            remediation_steps=["Create missing files"],
            metadata={
                "required_files": ["test_file.txt", "config.json"],
                "required_directories": ["data"],
                "content_check": "required_content",
            },
        )

    def test_collect_file_evidence_exists(self, collector, file_requirement, tmp_path):
        """Test collecting evidence for existing files"""
        # Create test files
        test_file = tmp_path / "test_file.txt"
        test_file.write_text("This is a test file with required_content")

        config_file = tmp_path / "config.json"
        config_file.write_text('{"setting": "value"}')

        # Create directory
        data_dir = tmp_path / "data"
        data_dir.mkdir()

        evidence = asyncio.run(collector.collect_evidence(file_requirement))

        assert len(evidence) == 3  # 2 files + 1 directory

        # Check file evidence
        file_evidence = [e for e in evidence if e.evidence_type == "file_system"]
        assert len(file_evidence) == 2

        # Check first file
        test_file_evidence = next(
            e for e in file_evidence if "test_file.txt" in e.evidence_data["file_path"]
        )
        assert test_file_evidence.evidence_data["exists"] is True
        assert test_file_evidence.evidence_data["content_contains"] is True
        assert test_file_evidence.verified is True

        # Check directory evidence
        dir_evidence = [e for e in evidence if e.evidence_type == "directory_permissions"]
        assert len(dir_evidence) == 1
        assert dir_evidence[0].evidence_data["exists"] is True

    def test_collect_file_evidence_missing(self, collector, file_requirement):
        """Test collecting evidence for missing files"""
        evidence = asyncio.run(collector.collect_evidence(file_requirement))

        assert len(evidence) == 3  # 2 files + 1 directory

        # All should show as not found
        for e in evidence:
            if e.evidence_type == "file_system":
                assert e.evidence_data["exists"] is False
            elif e.evidence_type == "directory_permissions":
                assert e.evidence_data["exists"] is False


class TestDatabaseEvidenceCollector:
    """Test the Database Evidence Collector"""

    @pytest.fixture
    def collector(self):
        """Create a database evidence collector"""
        return DatabaseEvidenceCollector(connection_string="test_db")

    @pytest.fixture
    def db_requirement(self):
        """Create a requirement that checks database"""
        return ComplianceRequirement(
            id="test-db-check",
            framework=ComplianceFramework.SOC2,
            title="Database Check",
            description="Check database for required data",
            severity=PolicySeverity.HIGH,
            category="data_integrity",
            controls=["SOC2-CC1.1"],
            evidence_required=["database_query"],
            remediation_steps=["Fix database issues"],
            metadata={
                "database_queries": [
                    {"query": "SELECT COUNT(*) FROM users", "expected_result": 42},
                    {"query": "SELECT EXISTS(SELECT 1 FROM audit_log)", "expected_result": True},
                ]
            },
        )

    def test_collect_database_evidence(self, collector, db_requirement):
        """Test collecting database evidence"""
        evidence = asyncio.run(collector.collect_evidence(db_requirement))

        assert len(evidence) == 2

        for e in evidence:
            assert e.evidence_type == "database_query"
            assert "query" in e.evidence_data
            assert "result" in e.evidence_data
            assert e.verified is True

        # Check first query (count)
        count_evidence = next(e for e in evidence if "COUNT" in e.evidence_data["query"])
        assert count_evidence.evidence_data["result"] == 42
        assert count_evidence.evidence_data["matches_expected"] is True

        # Check second query (exists)
        exists_evidence = next(e for e in evidence if "EXISTS" in e.evidence_data["query"])
        assert exists_evidence.evidence_data["result"] is True
        assert exists_evidence.evidence_data["matches_expected"] is True


class TestAPIEvidenceCollector:
    """Test the API Evidence Collector"""

    @pytest.fixture
    def collector(self):
        """Create an API evidence collector"""
        return APIEvidenceCollector(base_url="https://api.example.com")

    @pytest.fixture
    def api_requirement(self):
        """Create a requirement that checks APIs"""
        return ComplianceRequirement(
            id="test-api-check",
            framework=ComplianceFramework.GDPR,
            title="API Health Check",
            description="Check API endpoints are responding",
            severity=PolicySeverity.CRITICAL,
            category="system_availability",
            controls=["GDPR-5.1"],
            evidence_required=["api_health"],
            remediation_steps=["Restart API services"],
            metadata={
                "api_endpoints": [
                    {"endpoint": "/health", "method": "GET", "expected_status": 200},
                    {
                        "endpoint": "/status",
                        "method": "GET",
                        "expected_response": {"status": "healthy"},
                    },
                ]
            },
        )

    def test_collect_api_evidence(self, collector, api_requirement):
        """Test collecting API evidence"""
        evidence = asyncio.run(collector.collect_evidence(api_requirement))

        assert len(evidence) == 2

        for e in evidence:
            assert e.evidence_type == "api_call"
            assert "endpoint" in e.evidence_data
            assert "status_code" in e.evidence_data
            assert e.evidence_data["status_code"] == 200
            assert e.verified is True

        # Check health endpoint
        health_evidence = next(e for e in evidence if e.evidence_data["endpoint"] == "/health")
        assert health_evidence.evidence_data["status_matches"] is True

        # Check status endpoint
        status_evidence = next(e for e in evidence if e.evidence_data["endpoint"] == "/status")
        assert "response_matches" in status_evidence.evidence_data


class TestConfigurationEvidenceCollector:
    """Test the Configuration Evidence Collector"""

    @pytest.fixture
    def collector(self, tmp_path):
        """Create a configuration evidence collector"""
        return ConfigurationEvidenceCollector(config_paths=[tmp_path])

    @pytest.fixture
    def config_requirement(self):
        """Create a requirement that checks configuration"""
        return ComplianceRequirement(
            id="test-config-check",
            framework=ComplianceFramework.SOC2,
            title="Configuration Check",
            description="Check configuration settings",
            severity=PolicySeverity.MEDIUM,
            category="configuration",
            controls=["SOC2-CC1.1"],
            evidence_required=["config_check"],
            remediation_steps=["Update configuration"],
            metadata={
                "config_checks": [
                    {"file": "app.json", "key": "security.enabled", "expected_value": True},
                    {"file": "settings.conf", "key": "timeout", "expected_value": 30},
                ]
            },
        )

    def test_collect_config_evidence(self, collector, config_requirement, tmp_path):
        """Test collecting configuration evidence"""
        # Create test config files
        app_config = tmp_path / "app.json"
        app_config.write_text('{"security": {"enabled": true}, "database": {"host": "localhost"}}')

        settings_config = tmp_path / "settings.conf"
        settings_config.write_text("timeout=30\nmax_connections=100")

        evidence = asyncio.run(collector.collect_evidence(config_requirement))

        assert len(evidence) == 2

        for e in evidence:
            assert e.evidence_type == "config_check"
            assert e.verified is True

        # Check JSON config
        json_evidence = next(e for e in evidence if "app.json" in e.evidence_data["config_file"])
        assert json_evidence.evidence_data["actual_value"] is True
        assert json_evidence.evidence_data["matches_expected"] is True

        # Check key=value config
        conf_evidence = next(
            e for e in evidence if "settings.conf" in e.evidence_data["config_file"]
        )
        assert conf_evidence.evidence_data["actual_value"] == "30"
        assert conf_evidence.evidence_data["matches_expected"] is True


class TestSecurityScanEvidenceCollector:
    """Test the Security Scan Evidence Collector"""

    @pytest.fixture
    def collector(self, tmp_path):
        """Create a security scan evidence collector"""
        return SecurityScanEvidenceCollector(scan_results_path=tmp_path)

    @pytest.fixture
    def scan_requirement(self):
        """Create a requirement that checks security scans"""
        return ComplianceRequirement(
            id="test-scan-check",
            framework=ComplianceFramework.SOC2,
            title="Security Scan Check",
            description="Check security scan results",
            severity=PolicySeverity.HIGH,
            category="security",
            controls=["SOC2-CC1.1"],
            evidence_required=["security_scan"],
            remediation_steps=["Fix security issues"],
            metadata={
                "security_scans": ["vulnerability_scan", "compliance_scan"],
                "scan_thresholds": {"max_critical": 0, "max_high": 2},
            },
        )

    def test_collect_scan_evidence(self, collector, scan_requirement, tmp_path):
        """Test collecting security scan evidence"""
        # Create mock scan results
        vuln_scan = tmp_path / "vulnerability_scan.json"
        vuln_scan.write_text(
            json.dumps(
                {
                    "scan_date": "2025-10-26T10:00:00",
                    "findings": [
                        {"severity": "high", "status": "failed"},
                        {"severity": "medium", "status": "failed"},
                        {"severity": "low", "status": "passed"},
                    ],
                }
            )
        )

        compliance_scan = tmp_path / "compliance_scan.json"
        compliance_scan.write_text(
            json.dumps(
                {
                    "scan_date": "2025-10-26T10:00:00",
                    "findings": [{"severity": "low", "status": "passed"}],
                }
            )
        )

        evidence = asyncio.run(collector.collect_evidence(scan_requirement))

        assert len(evidence) == 2

        for e in evidence:
            assert e.evidence_type == "security_scan"
            assert e.verified is True

        # Check vulnerability scan
        vuln_evidence = next(
            e for e in evidence if e.evidence_data["scan_type"] == "vulnerability_scan"
        )
        assert vuln_evidence.evidence_data["vulnerabilities_found"] == 3
        assert vuln_evidence.evidence_data["high_issues"] == 1
        assert vuln_evidence.evidence_data["passed_checks"] == 1
        assert vuln_evidence.evidence_data["failed_checks"] == 2
        assert vuln_evidence.evidence_data["meets_thresholds"] is True  # 1 high <= 2 max_high


class TestCommandEvidenceCollector:
    """Test the Command Evidence Collector"""

    @pytest.fixture
    def collector(self):
        """Create a command evidence collector"""
        return CommandEvidenceCollector()

    @pytest.fixture
    def command_requirement(self):
        """Create a requirement that runs commands"""
        return ComplianceRequirement(
            id="test-command-check",
            framework=ComplianceFramework.GDPR,
            title="System Check",
            description="Check system configuration via commands",
            severity=PolicySeverity.MEDIUM,
            category="system_integrity",
            controls=["GDPR-5.1"],
            evidence_required=["system_check"],
            remediation_steps=["Fix system configuration"],
            metadata={
                "commands": [
                    {
                        "command": "echo 'test output'",
                        "expected_output": "test output",
                        "expected_exit_code": 0,
                    },
                    {"command": "whoami", "expected_exit_code": 0},
                ]
            },
        )

    def test_collect_command_evidence(self, collector, command_requirement):
        """Test collecting command evidence"""
        evidence = asyncio.run(collector.collect_evidence(command_requirement))

        assert len(evidence) == 2

        for e in evidence:
            assert e.evidence_type == "command_execution"
            assert "command" in e.evidence_data
            assert "exit_code" in e.evidence_data
            assert e.evidence_data["exit_code"] == 0
            assert e.verified is True

        # Check echo command
        echo_evidence = next(e for e in evidence if "echo" in e.evidence_data["command"])
        assert echo_evidence.evidence_data["output_contains"] is True
        assert echo_evidence.evidence_data["exit_code_matches"] is True

        # Check whoami command
        whoami_evidence = next(e for e in evidence if "whoami" in e.evidence_data["command"])
        assert whoami_evidence.evidence_data["exit_code_matches"] is True
        assert "stdout" in whoami_evidence.evidence_data

    def test_collect_command_evidence_blocked(self, collector):
        """Test that blocked commands are not executed"""
        blocked_requirement = ComplianceRequirement(
            id="test-blocked-command",
            framework=ComplianceFramework.GDPR,
            title="Blocked Command",
            description="Try to run a blocked command",
            severity=PolicySeverity.LOW,
            category="test",
            controls=["TEST-1"],
            evidence_required=["blocked_test"],
            remediation_steps=["Don't run blocked commands"],
            metadata={
                "commands": [
                    {
                        "command": "rm -rf /",  # This should be blocked
                        "expected_exit_code": 0,
                    }
                ]
            },
        )

        evidence = asyncio.run(collector.collect_evidence(blocked_requirement))

        assert len(evidence) == 1
        e = evidence[0]
        assert e.evidence_type == "command_execution"
        assert "not in allowed list" in e.evidence_data["error"]
        assert e.verified is False


if __name__ == "__main__":
    pytest.main([__file__])
