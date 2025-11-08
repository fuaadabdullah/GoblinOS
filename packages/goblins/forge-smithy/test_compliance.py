"""
Test Phase 3.3: Compliance Automation

Tests for the compliance automation system including:
- Policy Engine: Declarative compliance policy definition and validation
- Continuous Monitoring: Real-time compliance status tracking
- Audit Trails: Comprehensive audit logging for compliance
- Reporting: Automated compliance reports and dashboards
"""

import asyncio
import json
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from smithy.automation.compliance import (
    BasicPolicyValidator,
    ComplianceAuditor,
    ComplianceCheckResult,
    ComplianceEvidence,
    ComplianceFramework,
    CompliancePolicy,
    ComplianceReporter,
    ComplianceRequirement,
    ComplianceStatus,
    ContinuousComplianceMonitor,
    PolicyEngine,
    PolicySeverity,
)


class TestPolicyEngine:
    """Test the Policy Engine functionality"""

    @pytest.fixture
    def policy_engine(self):
        """Create a policy engine with basic validator"""
        engine = PolicyEngine()
        engine.register_validator(BasicPolicyValidator())
        return engine

    @pytest.fixture
    def sample_policy_data(self):
        """Sample compliance policy data"""
        return {
            "id": "test-gdpr-policy",
            "name": "Test GDPR Compliance Policy",
            "description": "Basic GDPR compliance requirements",
            "framework": "gdpr",
            "version": "1.0",
            "effective_date": datetime.now().isoformat(),
            "review_date": (datetime.now() + timedelta(days=365)).isoformat(),
            "owner": "test-owner",
            "requirements": [
                {
                    "id": "gdpr-data-protection",
                    "framework": "gdpr",
                    "title": "Data Protection Officer",
                    "description": "Appoint a Data Protection Officer",
                    "severity": "high",
                    "category": "governance",
                    "controls": ["GDPR-5.1"],
                    "evidence_required": ["dpo_appointment_letter"],
                    "remediation_steps": ["Appoint DPO", "Document appointment"],
                },
                {
                    "id": "gdpr-privacy-notice",
                    "framework": "gdpr",
                    "title": "Privacy Notice",
                    "description": "Provide clear privacy notice",
                    "severity": "medium",
                    "category": "communication",
                    "controls": ["GDPR-13"],
                    "evidence_required": ["privacy_notice_document"],
                    "remediation_steps": ["Create privacy notice", "Publish on website"],
                },
            ],
        }

    def test_policy_loading(self, policy_engine, sample_policy_data):
        """Test loading a compliance policy"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(sample_policy_data, f)
            policy_path = Path(f.name)

        try:
            policy = asyncio.run(policy_engine.load_policy(policy_path))

            assert policy.id == "test-gdpr-policy"
            assert policy.framework == ComplianceFramework.GDPR
            assert len(policy.requirements) == 2
            assert policy.requirements[0].severity == PolicySeverity.HIGH
            assert policy.requirements[1].severity == PolicySeverity.MEDIUM
        finally:
            policy_path.unlink()

    def test_policy_validation(self, policy_engine):
        """Test policy validation"""
        # Valid policy
        valid_policy = CompliancePolicy(
            id="valid-policy",
            name="Valid Policy",
            description="A valid policy",
            framework=ComplianceFramework.SOC2,
            version="1.0",
            requirements=[
                ComplianceRequirement(
                    id="req-1",
                    framework=ComplianceFramework.SOC2,
                    title="Test Requirement",
                    description="Test description",
                    severity=PolicySeverity.MEDIUM,
                    category="test",
                    controls=["TEST-1"],
                    evidence_required=["evidence1"],
                    remediation_steps=["step1"],
                )
            ],
            effective_date=datetime.now(),
        )

        errors = asyncio.run(policy_engine._validate_policy(valid_policy))
        assert len(errors) == 0

        # Invalid policy (missing ID)
        invalid_policy = CompliancePolicy(
            id="",  # Invalid
            name="Invalid Policy",
            description="An invalid policy",
            framework=ComplianceFramework.SOC2,
            version="1.0",
            requirements=[],
            effective_date=datetime.now(),
        )

        errors = asyncio.run(policy_engine._validate_policy(invalid_policy))
        assert len(errors) > 0
        assert any("Policy ID is required" in error for error in errors)

    def test_compliance_assessment(self, policy_engine, sample_policy_data):
        """Test compliance assessment"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(sample_policy_data, f)
            policy_path = Path(f.name)

        try:
            # Load policy
            policy = asyncio.run(policy_engine.load_policy(policy_path))

            # Create mock evidence collector
            class MockEvidenceCollector:
                async def collect_evidence(self, requirement):
                    return [
                        ComplianceEvidence(
                            requirement_id=requirement.id,
                            evidence_type="mock_evidence",
                            evidence_data={"collected": True},
                            collected_at=datetime.now(),
                        )
                    ]

            # Create mock compliance checker
            class MockComplianceChecker:
                async def check_compliance(self, requirement, evidence):
                    return ComplianceCheckResult(
                        requirement_id=requirement.id,
                        status=ComplianceStatus.COMPLIANT,
                        evidence=evidence,
                        findings=[],
                        remediation_required=False,
                        checked_at=datetime.now(),
                    )

            # Register collectors and checkers
            policy_engine.register_evidence_collector("mock", MockEvidenceCollector())
            policy_engine.register_compliance_checker("governance", MockComplianceChecker())
            policy_engine.register_compliance_checker("communication", MockComplianceChecker())

            # Assess compliance
            report = asyncio.run(policy_engine.assess_compliance(policy.id))

            assert report.policy_id == policy.id
            assert report.framework == ComplianceFramework.GDPR
            assert report.overall_status == ComplianceStatus.COMPLIANT
            assert len(report.results) == 2
            assert all(result.status == ComplianceStatus.COMPLIANT for result in report.results)

        finally:
            policy_path.unlink()


class TestContinuousComplianceMonitor:
    """Test the Continuous Compliance Monitor"""

    @pytest.fixture
    def monitor(self):
        """Create a compliance monitor"""
        engine = PolicyEngine()
        return ContinuousComplianceMonitor(engine)

    def test_monitor_initialization(self, monitor):
        """Test monitor initialization"""
        assert len(monitor.monitoring_tasks) == 0
        assert len(monitor.compliance_status) == 0
        assert len(monitor.alerts) == 0

    def test_monitoring_status(self, monitor):
        """Test getting monitoring status"""
        status = monitor.get_monitoring_status()

        assert "active_monitors" in status
        assert "compliance_status" in status
        assert "last_assessments" in status
        assert "active_alerts" in status

        assert len(status["active_monitors"]) == 0
        assert len(status["compliance_status"]) == 0
        assert status["active_alerts"] == 0


class TestComplianceAuditor:
    """Test the Compliance Auditor"""

    @pytest.fixture
    def auditor(self):
        """Create a compliance auditor"""
        return ComplianceAuditor()

    def test_audit_logging(self, auditor):
        """Test audit event logging"""
        auditor.log_event(
            event_type="POLICY_UPDATE",
            entity_type="compliance_policy",
            entity_id="test-policy-1",
            action="updated",
            user="test-user",
            details={"version": "2.0"},
        )

        assert len(auditor.audit_log) == 1
        event = auditor.audit_log[0]

        assert event["event_type"] == "POLICY_UPDATE"
        assert event["entity_type"] == "compliance_policy"
        assert event["entity_id"] == "test-policy-1"
        assert event["action"] == "updated"
        assert event["user"] == "test-user"
        assert event["details"]["version"] == "2.0"

    def test_audit_trail_filtering(self, auditor):
        """Test audit trail filtering"""
        # Add multiple events
        events_data = [
            ("POLICY_UPDATE", "compliance_policy", "policy-1", "updated", "user1"),
            ("ASSESSMENT_RUN", "compliance_assessment", "assess-1", "completed", "user2"),
            ("POLICY_UPDATE", "compliance_policy", "policy-2", "created", "user1"),
        ]

        for event_data in events_data:
            auditor.log_event(*event_data, details={})

        # Filter by event type
        policy_events = auditor.get_audit_trail(event_type="POLICY_UPDATE")
        assert len(policy_events) == 2

        # Filter by user
        user1_events = auditor.get_audit_trail(user="user1")
        assert len(user1_events) == 2

        # Filter by entity type
        policy_entities = auditor.get_audit_trail(entity_type="compliance_policy")
        assert len(policy_entities) == 2

    def test_audit_report_generation(self, auditor):
        """Test audit report generation"""
        # Add some events
        base_time = datetime.now()
        events_data = [
            ("POLICY_UPDATE", "compliance_policy", "policy-1", "updated", "user1"),
            ("ASSESSMENT_RUN", "compliance_assessment", "assess-1", "completed", "user2"),
        ]

        for event_data in events_data:
            auditor.log_event(*event_data, details={})

        # Generate report
        start_date = base_time - timedelta(days=1)
        end_date = base_time + timedelta(days=1)
        report = auditor.generate_audit_report(start_date, end_date)

        assert report["total_events"] == 2
        assert len(report["events_by_type"]) == 2
        assert len(report["events_by_user"]) == 2
        assert len(report["critical_events"]) == 0  # No critical events in test data


class TestComplianceReporter:
    """Test the Compliance Reporter"""

    @pytest.fixture
    def reporter(self):
        """Create a compliance reporter"""
        engine = PolicyEngine()
        auditor = ComplianceAuditor()
        return ComplianceReporter(engine, auditor)

    def test_dashboard_data_generation(self, reporter):
        """Test dashboard data generation"""
        dashboard = reporter.generate_dashboard_data([])

        assert "overview" in dashboard
        assert "policies" in dashboard
        assert "trends" in dashboard
        assert "alerts" in dashboard

        assert dashboard["overview"]["total_policies"] == 0
        assert len(dashboard["policies"]) == 0

    def test_html_report_generation(self, reporter):
        """Test HTML report generation"""
        # Create a mock report
        report_data = {
            "compliance_assessment": {
                "policy_id": "test-policy",
                "framework": "gdpr",
                "assessment_date": datetime.now().isoformat(),
                "overall_status": "compliant",
                "compliance_rate": 95.0,
                "summary": {"total": 10, "compliant": 9, "non_compliant": 1},
                "recommendations": ["Address non-compliant requirement"],
            },
            "detailed_results": [
                {
                    "requirement_id": "req-1",
                    "status": "compliant",
                    "evidence_count": 2,
                    "findings": [],
                    "remediation_required": False,
                }
            ],
        }

        html = reporter._generate_html_report(report_data)

        assert "<!DOCTYPE html>" in html
        assert "Compliance Report" in html
        assert "test-policy" in html
        assert "gdpr" in html
        assert "95.0%" in html


class TestBasicPolicyValidator:
    """Test the Basic Policy Validator"""

    @pytest.fixture
    def validator(self):
        """Create a basic policy validator"""
        return BasicPolicyValidator()

    def test_valid_policy_validation(self, validator):
        """Test validation of a valid policy"""
        valid_policy = CompliancePolicy(
            id="valid-policy",
            name="Valid Policy",
            description="A valid policy",
            framework=ComplianceFramework.SOC2,
            version="1.0",
            requirements=[
                ComplianceRequirement(
                    id="req-1",
                    framework=ComplianceFramework.SOC2,
                    title="Test Requirement",
                    description="Test description",
                    severity=PolicySeverity.MEDIUM,
                    category="test",
                    controls=["TEST-1"],
                    evidence_required=["evidence1"],
                    remediation_steps=["step1"],
                )
            ],
            effective_date=datetime.now(),
        )

        errors = asyncio.run(validator.validate_policy(valid_policy))
        assert len(errors) == 0

    def test_invalid_policy_validation(self, validator):
        """Test validation of invalid policies"""
        # Policy with no ID
        invalid_policy = CompliancePolicy(
            id="",  # Invalid
            name="Invalid Policy",
            description="An invalid policy",
            framework=ComplianceFramework.SOC2,
            version="1.0",
            requirements=[],
            effective_date=datetime.now(),
        )

        errors = asyncio.run(validator.validate_policy(invalid_policy))
        assert len(errors) > 0

        # Policy with duplicate requirement IDs
        duplicate_req_policy = CompliancePolicy(
            id="duplicate-policy",
            name="Duplicate Policy",
            description="Policy with duplicate requirements",
            framework=ComplianceFramework.SOC2,
            version="1.0",
            requirements=[
                ComplianceRequirement(
                    id="req-1",
                    framework=ComplianceFramework.SOC2,
                    title="Requirement 1",
                    description="First requirement",
                    severity=PolicySeverity.MEDIUM,
                    category="test",
                    controls=["TEST-1"],
                    evidence_required=["evidence1"],
                    remediation_steps=["step1"],
                ),
                ComplianceRequirement(
                    id="req-1",  # Duplicate
                    framework=ComplianceFramework.SOC2,
                    title="Requirement 1 Duplicate",
                    description="Duplicate requirement",
                    severity=PolicySeverity.MEDIUM,
                    category="test",
                    controls=["TEST-1"],
                    evidence_required=["evidence1"],
                    remediation_steps=["step1"],
                ),
            ],
            effective_date=datetime.now(),
        )

        errors = asyncio.run(validator.validate_policy(duplicate_req_policy))
        assert len(errors) > 0
        assert any("Duplicate requirement ID" in error for error in errors)


if __name__ == "__main__":
    pytest.main([__file__])
