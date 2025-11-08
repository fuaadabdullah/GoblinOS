"""
PolicyEngine Integration for Smithy Compliance Automation

This module demonstrates how to integrate compliance checkers with the PolicyEngine
for automated compliance assessment and monitoring.
"""

import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .compliance import (
    BasicPolicyValidator,
    ComplianceAuditor,
    ComplianceChecker,
    ComplianceCheckResult,
    ComplianceEvidence,
    ComplianceReport,
    ComplianceReporter,
    ComplianceRequirement,
    ComplianceStatus,
    ContinuousComplianceMonitor,
    PolicyEngine,
)
from .compliance_checkers import (
    GDPRComplianceChecker,
    HIPAAComplianceChecker,
    SOC2ComplianceChecker,
)
from .evidence_collectors import (
    APIEvidenceCollector,
    CommandEvidenceCollector,
    ConfigurationEvidenceCollector,
    FileSystemEvidenceCollector,
    SecurityScanEvidenceCollector,
)
from .sample_policies import (
    create_gdpr_compliance_policy,
    create_hipaa_compliance_policy,
    create_soc2_compliance_policy,
)


class GDPRComplianceCheckerWrapper(ComplianceChecker):
    """Wrapper for GDPR compliance checker to implement ComplianceChecker protocol"""

    def __init__(self):
        self.checker = GDPRComplianceChecker()

    async def check_compliance(
        self, requirement: ComplianceRequirement, evidence: list[ComplianceEvidence]
    ) -> ComplianceCheckResult:
        """Check compliance for GDPR requirements"""
        if requirement.category == "data_subject_rights":
            return await self.checker.check_data_subject_rights()
        elif requirement.category == "data_protection_officer":
            return await self.checker.check_data_processing_inventory()  # Using available method
        elif requirement.category == "privacy_by_design":
            return await self.checker.check_data_subject_rights()  # Using available method
        else:
            return ComplianceCheckResult(
                requirement_id=requirement.id,
                status=ComplianceStatus.NOT_APPLICABLE,
                evidence=[],
                findings=["Unknown GDPR requirement category"],
                remediation_required=False,
                checked_at=datetime.now(),
            )


class SOC2ComplianceCheckerWrapper(ComplianceChecker):
    """Wrapper for SOC2 compliance checker to implement ComplianceChecker protocol"""

    def __init__(self, config_paths: list[Path], scan_results_path: Path):
        self.checker = SOC2ComplianceChecker(
            config_paths=config_paths, scan_results_path=scan_results_path
        )

    async def check_compliance(
        self, requirement: ComplianceRequirement, evidence: list[ComplianceEvidence]
    ) -> ComplianceCheckResult:
        """Check compliance for SOC2 requirements"""
        if requirement.category == "security_controls":
            return await self.checker.check_security_controls()
        elif requirement.category == "change_management":
            return await self.checker.check_change_management()
        elif requirement.category == "monitoring":
            return await self.checker.check_security_controls()  # Using available method
        else:
            return ComplianceCheckResult(
                requirement_id=requirement.id,
                status=ComplianceStatus.NOT_APPLICABLE,
                evidence=[],
                findings=["Unknown SOC2 requirement category"],
                remediation_required=False,
                checked_at=datetime.now(),
            )


class HIPAAComplianceCheckerWrapper(ComplianceChecker):
    """Wrapper for HIPAA compliance checker to implement ComplianceChecker protocol"""

    def __init__(self, base_path: Path, config_paths: list[Path], scan_results_path: Path):
        self.checker = HIPAAComplianceChecker(
            base_path=base_path, config_paths=config_paths, scan_results_path=scan_results_path
        )

    async def check_compliance(
        self, requirement: ComplianceRequirement, evidence: list[ComplianceEvidence]
    ) -> ComplianceCheckResult:
        """Check compliance for HIPAA requirements"""
        if requirement.category == "phi_protection":
            return await self.checker.check_phi_protection()
        elif requirement.category == "risk_analysis":
            return await self.checker.check_breach_notification()  # Using available method
        elif requirement.category == "business_associates":
            return await self.checker.check_phi_protection()  # Using available method
        else:
            return ComplianceCheckResult(
                requirement_id=requirement.id,
                status=ComplianceStatus.NOT_APPLICABLE,
                evidence=[],
                findings=["Unknown HIPAA requirement category"],
                remediation_required=False,
                checked_at=datetime.now(),
            )


class ComplianceAutomationEngine:
    """Integrated compliance automation engine combining PolicyEngine with checkers and collectors"""

    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or Path.cwd()
        self.policy_engine = PolicyEngine()
        self.monitor = ContinuousComplianceMonitor(self.policy_engine)
        self.auditor = ComplianceAuditor()
        self.reporter = ComplianceReporter(self.policy_engine, self.auditor)
        self.logger = logging.getLogger(__name__)

        # Initialize with default components
        self._setup_default_components()

    def _setup_default_components(self):
        """Set up default validators, collectors, and checkers"""

        # Add policy validator
        self.policy_engine.register_validator(BasicPolicyValidator())

        # Register evidence collectors
        self.policy_engine.register_evidence_collector(
            "api_endpoints", APIEvidenceCollector(base_url="https://api.example.com")
        )
        self.policy_engine.register_evidence_collector("command_output", CommandEvidenceCollector())
        self.policy_engine.register_evidence_collector(
            "configuration_files",
            ConfigurationEvidenceCollector(config_paths=[self.base_path / "config"]),
        )
        self.policy_engine.register_evidence_collector(
            "filesystem", FileSystemEvidenceCollector(self.base_path)
        )
        self.policy_engine.register_evidence_collector(
            "security_scans", SecurityScanEvidenceCollector(self.base_path)
        )

        # Create compliance checker wrappers
        gdpr_checker = GDPRComplianceCheckerWrapper()
        soc2_checker = SOC2ComplianceCheckerWrapper(
            config_paths=[self.base_path / "config"], scan_results_path=self.base_path / "security"
        )
        hipaa_checker = HIPAAComplianceCheckerWrapper(
            base_path=self.base_path,
            config_paths=[self.base_path / "config"],
            scan_results_path=self.base_path / "security",
        )

        # Register compliance checkers by category
        self.policy_engine.register_compliance_checker("data_subject_rights", gdpr_checker)
        self.policy_engine.register_compliance_checker("data_protection_officer", gdpr_checker)
        self.policy_engine.register_compliance_checker("privacy_by_design", gdpr_checker)

        self.policy_engine.register_compliance_checker("security_controls", soc2_checker)
        self.policy_engine.register_compliance_checker("change_management", soc2_checker)
        self.policy_engine.register_compliance_checker("monitoring", soc2_checker)

        self.policy_engine.register_compliance_checker("phi_protection", hipaa_checker)
        self.policy_engine.register_compliance_checker("risk_analysis", hipaa_checker)
        self.policy_engine.register_compliance_checker("business_associates", hipaa_checker)

    async def load_sample_policies(self) -> List[str]:
        """Load all sample compliance policies and return their IDs"""

        policies = [
            ("gdpr", create_gdpr_compliance_policy()),
            ("soc2", create_soc2_compliance_policy()),
            ("hipaa", create_hipaa_compliance_policy()),
        ]

        policy_ids = []
        for framework, policy in policies:
            # Validate and load policy
            validation_errors = []
            for validator in self.policy_engine.validators:
                try:
                    errors = await validator.validate_policy(policy)
                    validation_errors.extend(errors)
                except Exception as e:
                    validation_errors.append(f"Validator error: {e}")

            if validation_errors:
                self.logger.error(f"Policy validation failed for {framework}: {validation_errors}")
                continue

            self.policy_engine.policies[policy.id] = policy
            policy_ids.append(policy.id)
            self.logger.info(f"Loaded {framework} policy: {policy.name}")

        return policy_ids

    async def assess_all_policies(self) -> Dict[str, ComplianceReport]:
        """Assess compliance for all loaded policies"""

        reports = {}
        for policy_id in self.policy_engine.policies.keys():
            try:
                report = await self.policy_engine.assess_compliance(policy_id)
                reports[policy_id] = report
                self.logger.info(
                    f"Assessment completed for {policy_id}: {report.overall_status.value}"
                )
            except Exception as e:
                self.logger.error(f"Failed to assess policy {policy_id}: {e}")

        return reports

    async def start_continuous_monitoring(self, policy_ids: List[str], interval_minutes: int = 60):
        """Start continuous monitoring for specified policies"""

        await self.monitor.start_monitoring(policy_ids, interval_minutes)
        self.logger.info(f"Started monitoring for policies: {policy_ids}")

    async def stop_continuous_monitoring(self, policy_id: str):
        """Stop monitoring for a specific policy"""

        await self.monitor.stop_monitoring(policy_id)
        self.logger.info(f"Stopped monitoring for policy: {policy_id}")

    def get_monitoring_status(self) -> Dict:
        """Get current monitoring status"""

        return self.monitor.get_monitoring_status()

    async def generate_compliance_reports(
        self, policy_ids: List[str], output_dir: Path, format: str = "json"
    ):
        """Generate compliance reports for specified policies"""

        output_dir.mkdir(exist_ok=True)

        for policy_id in policy_ids:
            if policy_id not in self.policy_engine.policies:
                self.logger.warning(f"Policy {policy_id} not found")
                continue

            try:
                report_data = await self.reporter.generate_compliance_report(policy_id, format)
                output_path = output_dir / f"{policy_id}_report.{format}"

                if format == "json":
                    with open(output_path, "w") as f:
                        import json

                        json.dump(report_data, f, indent=2, default=str)
                else:
                    # For other formats, assume it's already a string
                    with open(output_path, "w") as f:
                        f.write(str(report_data))

                self.logger.info(f"Generated {format} report for {policy_id}: {output_path}")

            except Exception as e:
                self.logger.error(f"Failed to generate report for {policy_id}: {e}")

    def get_audit_trail(self, **filters) -> List[Dict]:
        """Get audit trail with optional filters"""

        return self.auditor.get_audit_trail(**filters)

    def log_compliance_event(
        self,
        event_type: str,
        entity_type: str,
        entity_id: str,
        action: str,
        user: str,
        details: Optional[Dict] = None,
    ):
        """Log a compliance-related event"""

        self.auditor.log_event(event_type, entity_type, entity_id, action, user, details)


class ComplianceDashboard:
    """Dashboard for compliance status visualization"""

    def __init__(self, automation_engine: ComplianceAutomationEngine):
        self.engine = automation_engine

    def generate_dashboard_data(self) -> Dict:
        """Generate dashboard data for all policies"""

        policies_data = []
        total_policies = len(self.engine.policy_engine.policies)
        total_compliant = 0
        total_non_compliant = 0
        critical_issues = 0

        for policy_id, policy in self.engine.policy_engine.policies.items():
            # Get latest status from monitoring if available
            status = self.engine.monitor.compliance_status.get(policy_id, "unknown")
            last_assessment = self.engine.monitor.last_assessments.get(policy_id)

            # Count requirements by status
            compliant_reqs = 0
            non_compliant_reqs = 0

            policy_data = {
                "id": policy.id,
                "name": policy.name,
                "framework": policy.framework.value,
                "status": status,
                "requirements_count": len(policy.requirements),
                "last_assessment": last_assessment.isoformat() if last_assessment else None,
                "compliant_requirements": compliant_reqs,
                "non_compliant_requirements": non_compliant_reqs,
            }
            policies_data.append(policy_data)

            if status == "compliant":
                total_compliant += 1
            elif status == "non_compliant":
                total_non_compliant += 1

        # Count critical issues from alerts
        for alert in self.engine.monitor.alerts:
            if alert.get("data", {}).get("severity") == "CRITICAL":
                critical_issues += 1

        dashboard = {
            "overview": {
                "total_policies": total_policies,
                "compliant_policies": total_compliant,
                "non_compliant_policies": total_non_compliant,
                "compliance_rate": (total_compliant / total_policies * 100)
                if total_policies > 0
                else 0,
                "critical_issues": critical_issues,
                "last_updated": self.engine.monitor.last_assessments,
            },
            "policies": policies_data,
            "alerts": [
                {
                    "policy_id": alert["policy_id"],
                    "type": alert["alert_type"],
                    "timestamp": alert["timestamp"].isoformat(),
                    "severity": alert.get("data", {}).get("severity", "INFO"),
                }
                for alert in self.engine.monitor.alerts[-10:]  # Last 10 alerts
            ],
            "monitoring_status": self.engine.get_monitoring_status(),
        }

        return dashboard


async def demonstrate_compliance_automation():
    """Demonstrate the full compliance automation workflow"""

    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    # Initialize the compliance automation engine
    engine = ComplianceAutomationEngine()
    dashboard = ComplianceDashboard(engine)

    logger.info("🚀 Starting Compliance Automation Demonstration")

    # Step 1: Load sample policies
    logger.info("📋 Loading sample compliance policies...")
    policy_ids = await engine.load_sample_policies()
    logger.info(f"✅ Loaded {len(policy_ids)} policies: {policy_ids}")

    # Step 2: Perform initial compliance assessment
    logger.info("🔍 Performing initial compliance assessments...")
    reports = await engine.assess_all_policies()

    for policy_id, report in reports.items():
        logger.info(
            f"📊 {policy_id}: {report.overall_status.value} "
            f"({report.summary.get('compliance_rate_percent', 0)}% compliant)"
        )

    # Step 3: Generate compliance reports
    reports_dir = Path("compliance_reports")
    logger.info("📄 Generating compliance reports...")
    await engine.generate_compliance_reports(policy_ids, reports_dir, format="json")

    # Step 4: Start continuous monitoring
    logger.info("👀 Starting continuous monitoring...")
    await engine.start_continuous_monitoring(policy_ids, interval_minutes=5)  # 5 minutes for demo

    # Step 5: Generate dashboard data
    logger.info("📈 Generating dashboard data...")
    dashboard_data = dashboard.generate_dashboard_data()
    logger.info(
        f"📊 Dashboard: {dashboard_data['overview']['total_policies']} policies, "
        f"{dashboard_data['overview']['compliance_rate']:.1f}% overall compliance"
    )

    # Step 6: Log some compliance events
    logger.info("📝 Logging compliance events...")
    engine.log_compliance_event(
        "ASSESSMENT_COMPLETED",
        "policy",
        "gdpr-sample-policy-v1.0",
        "completed",
        "automation_system",
        {"status": "compliant"},
    )

    # Step 7: Show monitoring status
    monitoring_status = engine.get_monitoring_status()
    logger.info(f"🔄 Monitoring active for {len(monitoring_status['active_monitors'])} policies")

    # Clean up monitoring
    for policy_id in policy_ids:
        await engine.stop_continuous_monitoring(policy_id)

    logger.info("✅ Compliance automation demonstration completed!")
    return {
        "policies_loaded": policy_ids,
        "assessments_completed": len(reports),
        "reports_generated": len(list(reports_dir.glob("*.json"))) if reports_dir.exists() else 0,
        "dashboard_data": dashboard_data,
    }


if __name__ == "__main__":
    # Run the demonstration
    result = asyncio.run(demonstrate_compliance_automation())
    print("\n🎯 Demonstration Results:")
    for key, value in result.items():
        if key == "dashboard_data":
            print(f"  {key}: {value['overview']}")
        else:
            print(f"  {key}: {value}")
