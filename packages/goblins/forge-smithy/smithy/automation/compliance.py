"""
Smithy Compliance Automation Module

This module provides comprehensive compliance automation capabilities including:
- Policy Engine: Declarative compliance policy definition and validation
- Continuous Monitoring: Real-time compliance status tracking
- Audit Trails: Comprehensive audit logging for compliance
- Reporting: Automated compliance reports and dashboards
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Protocol, Set, Union


class ComplianceFramework(Enum):
    """Supported compliance frameworks"""

    SOC2 = "soc2"
    GDPR = "gdpr"
    HIPAA = "hipaa"
    PCI_DSS = "pci_dss"
    ISO27001 = "iso27001"
    NIST = "nist"
    CUSTOM = "custom"


class ComplianceStatus(Enum):
    """Compliance status levels"""

    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    PARTIALLY_COMPLIANT = "partially_compliant"
    NOT_APPLICABLE = "not_applicable"
    UNDER_REVIEW = "under_review"


class PolicySeverity(Enum):
    """Policy severity levels"""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class ComplianceRequirement:
    """Individual compliance requirement"""

    id: str
    framework: ComplianceFramework
    title: str
    description: str
    severity: PolicySeverity
    category: str
    controls: List[str]
    evidence_required: List[str]
    remediation_steps: List[str]
    tags: Set[str] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CompliancePolicy:
    """Compliance policy definition"""

    id: str
    name: str
    description: str
    framework: ComplianceFramework
    version: str
    requirements: List[ComplianceRequirement]
    effective_date: datetime
    review_date: Optional[datetime] = None
    owner: str = ""
    tags: Set[str] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ComplianceEvidence:
    """Evidence for compliance requirement"""

    requirement_id: str
    evidence_type: str
    evidence_data: Dict[str, Any]
    collected_at: datetime
    expires_at: Optional[datetime] = None
    source: str = ""
    verified: bool = False
    verification_method: str = ""


@dataclass
class ComplianceCheckResult:
    """Result of a compliance check"""

    requirement_id: str
    status: ComplianceStatus
    evidence: List[ComplianceEvidence]
    findings: List[str]
    remediation_required: bool
    checked_at: datetime
    next_check: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ComplianceReport:
    """Compliance assessment report"""

    policy_id: str
    framework: ComplianceFramework
    assessment_date: datetime
    overall_status: ComplianceStatus
    results: List[ComplianceCheckResult]
    summary: Dict[str, Any]
    recommendations: List[str]
    generated_at: datetime
    valid_until: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)


class PolicyValidator(Protocol):
    """Protocol for policy validation"""

    async def validate_policy(self, policy: CompliancePolicy) -> List[str]:
        """Validate a compliance policy. Returns list of validation errors."""
        ...


class EvidenceCollector(Protocol):
    """Protocol for evidence collection"""

    async def collect_evidence(
        self, requirement: ComplianceRequirement
    ) -> List[ComplianceEvidence]:
        """Collect evidence for a compliance requirement"""
        ...


class ComplianceChecker(Protocol):
    """Protocol for compliance checking"""

    async def check_compliance(
        self, requirement: ComplianceRequirement, evidence: List[ComplianceEvidence]
    ) -> ComplianceCheckResult:
        """Check compliance for a requirement with provided evidence"""
        ...


class PolicyEngine:
    """Core policy engine for compliance automation"""

    def __init__(self):
        self.policies: Dict[str, CompliancePolicy] = {}
        self.validators: List[PolicyValidator] = []
        self.collectors: Dict[str, EvidenceCollector] = {}
        self.checkers: Dict[str, ComplianceChecker] = {}
        self.logger = logging.getLogger(__name__)

    def register_validator(self, validator: PolicyValidator):
        """Register a policy validator"""
        self.validators.append(validator)

    def register_evidence_collector(self, evidence_type: str, collector: EvidenceCollector):
        """Register an evidence collector for a specific type"""
        self.collectors[evidence_type] = collector

    def register_compliance_checker(self, requirement_type: str, checker: ComplianceChecker):
        """Register a compliance checker for a specific requirement type"""
        self.checkers[requirement_type] = checker

    async def load_policy(self, policy_path: Path) -> CompliancePolicy:
        """Load a compliance policy from file"""
        with open(policy_path, "r") as f:
            policy_data = json.load(f)

        # Convert requirements
        requirements = []
        for req_data in policy_data["requirements"]:
            requirement = ComplianceRequirement(
                id=req_data["id"],
                framework=ComplianceFramework(req_data["framework"]),
                title=req_data["title"],
                description=req_data["description"],
                severity=PolicySeverity(req_data["severity"]),
                category=req_data["category"],
                controls=req_data["controls"],
                evidence_required=req_data["evidence_required"],
                remediation_steps=req_data["remediation_steps"],
                tags=set(req_data.get("tags", [])),
                metadata=req_data.get("metadata", {}),
            )
            requirements.append(requirement)

        policy = CompliancePolicy(
            id=policy_data["id"],
            name=policy_data["name"],
            description=policy_data["description"],
            framework=ComplianceFramework(policy_data["framework"]),
            version=policy_data["version"],
            requirements=requirements,
            effective_date=datetime.fromisoformat(policy_data["effective_date"]),
            review_date=datetime.fromisoformat(policy_data["review_date"])
            if policy_data.get("review_date")
            else None,
            owner=policy_data.get("owner", ""),
            tags=set(policy_data.get("tags", [])),
            metadata=policy_data.get("metadata", {}),
        )

        # Validate policy
        validation_errors = await self._validate_policy(policy)
        if validation_errors:
            raise ValueError(f"Policy validation failed: {validation_errors}")

        self.policies[policy.id] = policy
        self.logger.info(f"Loaded compliance policy: {policy.name} ({policy.id})")
        return policy

    async def _validate_policy(self, policy: CompliancePolicy) -> List[str]:
        """Validate a policy using all registered validators"""
        errors = []
        for validator in self.validators:
            try:
                validator_errors = await validator.validate_policy(policy)
                errors.extend(validator_errors)
            except Exception as e:
                errors.append(f"Validator error: {e}")
        return errors

    async def assess_compliance(self, policy_id: str) -> ComplianceReport:
        """Assess compliance for a specific policy"""
        if policy_id not in self.policies:
            raise ValueError(f"Policy {policy_id} not found")

        policy = self.policies[policy_id]
        results = []

        # Assess each requirement
        for requirement in policy.requirements:
            try:
                result = await self._assess_requirement(requirement)
                results.append(result)
            except Exception as e:
                self.logger.error(f"Failed to assess requirement {requirement.id}: {e}")
                # Create failed result
                result = ComplianceCheckResult(
                    requirement_id=requirement.id,
                    status=ComplianceStatus.UNDER_REVIEW,
                    evidence=[],
                    findings=[f"Assessment failed: {e}"],
                    remediation_required=True,
                    checked_at=datetime.now(),
                    metadata={"error": str(e)},
                )
                results.append(result)

        # Calculate overall status
        overall_status = self._calculate_overall_status(results)

        # Generate summary
        summary = self._generate_summary(results)

        # Generate recommendations
        recommendations = self._generate_recommendations(results, policy)

        report = ComplianceReport(
            policy_id=policy_id,
            framework=policy.framework,
            assessment_date=datetime.now(),
            overall_status=overall_status,
            results=results,
            summary=summary,
            recommendations=recommendations,
            generated_at=datetime.now(),
            valid_until=datetime.now() + timedelta(days=30),  # Valid for 30 days
            metadata={"policy_version": policy.version},
        )

        self.logger.info(
            f"Completed compliance assessment for policy {policy_id}: {overall_status.value}"
        )
        return report

    async def _assess_requirement(
        self, requirement: ComplianceRequirement
    ) -> ComplianceCheckResult:
        """Assess compliance for a single requirement"""
        # Collect evidence
        evidence = []
        for evidence_type in requirement.evidence_required:
            if evidence_type in self.collectors:
                try:
                    collected = await self.collectors[evidence_type].collect_evidence(requirement)
                    evidence.extend(collected)
                except Exception as e:
                    self.logger.warning(f"Failed to collect evidence {evidence_type}: {e}")

        # Check compliance
        checker_key = requirement.category
        if checker_key in self.checkers:
            result = await self.checkers[checker_key].check_compliance(requirement, evidence)
        else:
            # Default checker - check if we have required evidence
            has_required_evidence = len(evidence) >= len(requirement.evidence_required)
            status = (
                ComplianceStatus.COMPLIANT
                if has_required_evidence
                else ComplianceStatus.NON_COMPLIANT
            )
            result = ComplianceCheckResult(
                requirement_id=requirement.id,
                status=status,
                evidence=evidence,
                findings=[] if has_required_evidence else ["Required evidence not collected"],
                remediation_required=not has_required_evidence,
                checked_at=datetime.now(),
                next_check=datetime.now() + timedelta(days=7),
            )

        return result

    def _calculate_overall_status(self, results: List[ComplianceCheckResult]) -> ComplianceStatus:
        """Calculate overall compliance status from individual results"""
        if not results:
            return ComplianceStatus.NOT_APPLICABLE

        # Count statuses
        status_counts = {}
        for result in results:
            status_counts[result.status] = status_counts.get(result.status, 0) + 1

        # Determine overall status
        if status_counts.get(ComplianceStatus.NON_COMPLIANT, 0) > 0:
            return ComplianceStatus.NON_COMPLIANT
        elif status_counts.get(ComplianceStatus.UNDER_REVIEW, 0) > 0:
            return ComplianceStatus.UNDER_REVIEW
        elif status_counts.get(ComplianceStatus.PARTIALLY_COMPLIANT, 0) > 0:
            return ComplianceStatus.PARTIALLY_COMPLIANT
        else:
            return ComplianceStatus.COMPLIANT

    def _generate_summary(self, results: List[ComplianceCheckResult]) -> Dict[str, Any]:
        """Generate summary statistics from results"""
        total = len(results)
        compliant = sum(1 for r in results if r.status == ComplianceStatus.COMPLIANT)
        non_compliant = sum(1 for r in results if r.status == ComplianceStatus.NON_COMPLIANT)
        partial = sum(1 for r in results if r.status == ComplianceStatus.PARTIALLY_COMPLIANT)
        under_review = sum(1 for r in results if r.status == ComplianceStatus.UNDER_REVIEW)

        compliance_rate = (compliant / total * 100) if total > 0 else 0

        return {
            "total_requirements": total,
            "compliant": compliant,
            "non_compliant": non_compliant,
            "partially_compliant": partial,
            "under_review": under_review,
            "compliance_rate_percent": round(compliance_rate, 2),
        }

    def _generate_recommendations(
        self, results: List[ComplianceCheckResult], policy: CompliancePolicy
    ) -> List[str]:
        """Generate recommendations based on assessment results"""
        recommendations = []

        # Check for non-compliant requirements
        non_compliant = [r for r in results if r.status == ComplianceStatus.NON_COMPLIANT]
        if non_compliant:
            recommendations.append(
                f"Address {len(non_compliant)} non-compliant requirements immediately"
            )

        # Check for items under review
        under_review = [r for r in results if r.status == ComplianceStatus.UNDER_REVIEW]
        if under_review:
            recommendations.append(f"Review {len(under_review)} requirements that are under review")

        # Check for evidence gaps
        evidence_gaps = sum(1 for r in results if not r.evidence)
        if evidence_gaps > 0:
            recommendations.append(
                f"Collect evidence for {evidence_gaps} requirements lacking documentation"
            )

        # Framework-specific recommendations
        if policy.framework == ComplianceFramework.GDPR:
            recommendations.append(
                "Ensure data processing activities are documented and DPIAs are conducted for high-risk processing"
            )
        elif policy.framework == ComplianceFramework.SOC2:
            recommendations.append(
                "Implement continuous monitoring for security controls and maintain detailed audit logs"
            )

        return recommendations


class BasicPolicyValidator:
    """Basic policy validator implementation"""

    async def validate_policy(self, policy: CompliancePolicy) -> List[str]:
        """Validate basic policy structure and requirements"""
        errors = []

        # Check required fields
        if not policy.id:
            errors.append("Policy ID is required")
        if not policy.name:
            errors.append("Policy name is required")
        if not policy.requirements:
            errors.append("Policy must have at least one requirement")

        # Validate requirements
        requirement_ids = set()
        for req in policy.requirements:
            if req.id in requirement_ids:
                errors.append(f"Duplicate requirement ID: {req.id}")
            requirement_ids.add(req.id)

            if not req.title:
                errors.append(f"Requirement {req.id} missing title")
            if not req.controls:
                errors.append(f"Requirement {req.id} missing controls")

        # Check effective date
        if policy.effective_date > datetime.now():
            errors.append("Policy effective date cannot be in the future")

        return errors


class ContinuousComplianceMonitor:
    """Continuous compliance monitoring system"""

    def __init__(self, policy_engine: PolicyEngine):
        self.policy_engine = policy_engine
        self.monitoring_tasks: Dict[str, asyncio.Task] = {}
        self.compliance_status: Dict[str, ComplianceStatus] = {}
        self.last_assessments: Dict[str, datetime] = {}
        self.alerts: List[Dict[str, Any]] = []
        self.logger = logging.getLogger(__name__)

    async def start_monitoring(self, policy_ids: List[str], interval_minutes: int = 60):
        """Start continuous monitoring for specified policies"""
        for policy_id in policy_ids:
            if policy_id in self.monitoring_tasks:
                self.logger.warning(f"Monitoring already running for policy {policy_id}")
                continue

            task = asyncio.create_task(self._monitor_policy(policy_id, interval_minutes))
            self.monitoring_tasks[policy_id] = task
            self.logger.info(f"Started monitoring for policy {policy_id}")

    async def stop_monitoring(self, policy_id: str):
        """Stop monitoring for a specific policy"""
        if policy_id in self.monitoring_tasks:
            self.monitoring_tasks[policy_id].cancel()
            del self.monitoring_tasks[policy_id]
            self.logger.info(f"Stopped monitoring for policy {policy_id}")

    async def _monitor_policy(self, policy_id: str, interval_minutes: int):
        """Monitor a single policy continuously"""
        while True:
            try:
                # Perform compliance assessment
                report = await self.policy_engine.assess_compliance(policy_id)

                # Update status
                old_status = self.compliance_status.get(policy_id)
                self.compliance_status[policy_id] = report.overall_status
                self.last_assessments[policy_id] = report.assessment_date

                # Check for status changes
                if old_status and old_status != report.overall_status:
                    await self._handle_status_change(
                        policy_id, old_status, report.overall_status, report
                    )

                # Check for critical issues
                critical_findings = []
                for result in report.results:
                    if result.status == ComplianceStatus.NON_COMPLIANT:
                        # Find the requirement
                        policy = self.policy_engine.policies.get(policy_id)
                        if policy:
                            req = next(
                                (r for r in policy.requirements if r.id == result.requirement_id),
                                None,
                            )
                            if req and req.severity in [
                                PolicySeverity.CRITICAL,
                                PolicySeverity.HIGH,
                            ]:
                                critical_findings.append(f"{req.title}: {result.findings}")

                if critical_findings:
                    await self._raise_alert(
                        policy_id,
                        "CRITICAL_COMPLIANCE_ISSUES",
                        {"findings": critical_findings, "report": report},
                    )

                self.logger.debug(
                    f"Completed monitoring cycle for policy {policy_id}: {report.overall_status.value}"
                )

            except Exception as e:
                self.logger.error(f"Monitoring failed for policy {policy_id}: {e}")
                await self._raise_alert(policy_id, "MONITORING_ERROR", {"error": str(e)})

            # Wait for next cycle
            await asyncio.sleep(interval_minutes * 60)

    async def _handle_status_change(
        self,
        policy_id: str,
        old_status: ComplianceStatus,
        new_status: ComplianceStatus,
        report: ComplianceReport,
    ):
        """Handle compliance status changes"""
        severity = "INFO"
        if new_status == ComplianceStatus.NON_COMPLIANT:
            severity = "CRITICAL"
        elif new_status == ComplianceStatus.PARTIALLY_COMPLIANT:
            severity = "WARNING"

        await self._raise_alert(
            policy_id,
            "STATUS_CHANGE",
            {
                "old_status": old_status.value,
                "new_status": new_status.value,
                "severity": severity,
                "report": report,
            },
        )

        self.logger.info(
            f"Compliance status changed for {policy_id}: {old_status.value} -> {new_status.value}"
        )

    async def _raise_alert(self, policy_id: str, alert_type: str, data: Dict[str, Any]):
        """Raise a compliance alert"""
        alert = {
            "policy_id": policy_id,
            "alert_type": alert_type,
            "timestamp": datetime.now(),
            "data": data,
        }
        self.alerts.append(alert)

        # In a real system, this would send notifications, emails, etc.
        self.logger.warning(f"Compliance alert for {policy_id}: {alert_type}")

    def get_monitoring_status(self) -> Dict[str, Any]:
        """Get current monitoring status"""
        return {
            "active_monitors": list(self.monitoring_tasks.keys()),
            "compliance_status": {
                pid: status.value for pid, status in self.compliance_status.items()
            },
            "last_assessments": {pid: dt.isoformat() for pid, dt in self.last_assessments.items()},
            "active_alerts": len([a for a in self.alerts if not a.get("resolved", False)]),
        }


class ComplianceAuditor:
    """Audit trail management for compliance"""

    def __init__(self):
        self.audit_log: List[Dict[str, Any]] = []
        self.logger = logging.getLogger(__name__)

    def log_event(
        self,
        event_type: str,
        entity_type: str,
        entity_id: str,
        action: str,
        user: str,
        details: Optional[Dict[str, Any]] = None,
    ):
        """Log a compliance-related event"""
        event = {
            "timestamp": datetime.now(),
            "event_type": event_type,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "user": user,
            "details": details or {},
            "session_id": details.get("session_id") if details else None,
        }

        self.audit_log.append(event)
        self.logger.info(
            f"Audit event: {event_type} {action} on {entity_type}:{entity_id} by {user}"
        )

    def get_audit_trail(
        self,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        event_type: Optional[str] = None,
        user: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve audit trail with optional filtering"""
        filtered_events = self.audit_log

        if entity_type:
            filtered_events = [e for e in filtered_events if e["entity_type"] == entity_type]
        if entity_id:
            filtered_events = [e for e in filtered_events if e["entity_id"] == entity_id]
        if event_type:
            filtered_events = [e for e in filtered_events if e["event_type"] == event_type]
        if user:
            filtered_events = [e for e in filtered_events if e["user"] == user]
        if start_date:
            filtered_events = [e for e in filtered_events if e["timestamp"] >= start_date]
        if end_date:
            filtered_events = [e for e in filtered_events if e["timestamp"] <= end_date]

        return filtered_events

    def generate_audit_report(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Generate an audit report for a date range"""
        events = self.get_audit_trail(start_date=start_date, end_date=end_date)

        # Group by event type
        event_types = {}
        for event in events:
            et = event["event_type"]
            if et not in event_types:
                event_types[et] = []
            event_types[et].append(event)

        # Group by user
        users = {}
        for event in events:
            user = event["user"]
            if user not in users:
                users[user] = []
            users[user].append(event)

        return {
            "report_period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
            "total_events": len(events),
            "events_by_type": {et: len(events) for et, events in event_types.items()},
            "events_by_user": {user: len(events) for user, events in users.items()},
            "critical_events": [
                e
                for e in events
                if e["event_type"] in ["SECURITY_INCIDENT", "COMPLIANCE_VIOLATION"]
            ],
            "generated_at": datetime.now().isoformat(),
        }


class ComplianceReporter:
    """Automated compliance reporting and dashboard generation"""

    def __init__(self, policy_engine: PolicyEngine, auditor: ComplianceAuditor):
        self.policy_engine = policy_engine
        self.auditor = auditor
        self.logger = logging.getLogger(__name__)

    async def generate_compliance_report(
        self, policy_id: str, format: str = "json"
    ) -> Union[str, Dict[str, Any]]:
        """Generate a comprehensive compliance report"""
        # Get latest assessment
        report = await self.policy_engine.assess_compliance(policy_id)

        # Get audit data for the same period
        audit_report = self.auditor.generate_audit_report(
            report.assessment_date - timedelta(days=30), report.assessment_date
        )

        # Combine into comprehensive report
        comprehensive_report = {
            "compliance_assessment": {
                "policy_id": report.policy_id,
                "framework": report.framework.value,
                "assessment_date": report.assessment_date.isoformat(),
                "overall_status": report.overall_status.value,
                "compliance_rate": report.summary.get("compliance_rate_percent", 0),
                "summary": report.summary,
                "recommendations": report.recommendations,
            },
            "detailed_results": [
                {
                    "requirement_id": result.requirement_id,
                    "status": result.status.value,
                    "evidence_count": len(result.evidence),
                    "findings": result.findings,
                    "remediation_required": result.remediation_required,
                }
                for result in report.results
            ],
            "audit_summary": audit_report,
            "generated_at": datetime.now().isoformat(),
            "report_format": format,
        }

        if format == "json":
            return json.dumps(comprehensive_report, indent=2, default=str)
        else:
            return comprehensive_report

    def generate_dashboard_data(self, policy_ids: List[str]) -> Dict[str, Any]:
        """Generate dashboard data for multiple policies"""
        dashboard = {
            "overview": {
                "total_policies": len(policy_ids),
                "last_updated": datetime.now().isoformat(),
            },
            "policies": [],
            "trends": {
                "compliance_over_time": [],  # Would be populated with historical data
                "critical_issues": [],
            },
            "alerts": [],
        }

        for policy_id in policy_ids:
            if policy_id in self.policy_engine.policies:
                policy = self.policy_engine.policies[policy_id]
                status = "unknown"  # Would be populated from monitoring system

                policy_data = {
                    "id": policy.id,
                    "name": policy.name,
                    "framework": policy.framework.value,
                    "status": status,
                    "requirements_count": len(policy.requirements),
                    "last_assessment": None,  # Would be populated from monitoring system
                }
                dashboard["policies"].append(policy_data)

        return dashboard

    async def export_report(
        self, report_data: Dict[str, Any], output_path: Path, format: str = "json"
    ):
        """Export a report to file"""
        if format == "json":
            with open(output_path, "w") as f:
                json.dump(report_data, f, indent=2, default=str)
        elif format == "html":
            # Generate HTML report
            html_content = self._generate_html_report(report_data)
            with open(output_path, "w") as f:
                f.write(html_content)
        else:
            raise ValueError(f"Unsupported format: {format}")

        self.logger.info(f"Exported compliance report to {output_path}")

    def _generate_html_report(self, report_data: Dict[str, Any]) -> str:
        """Generate HTML report from report data"""
        assessment = report_data["compliance_assessment"]

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Compliance Report - {assessment["policy_id"]}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; }}
                .header {{ background: #f0f0f0; padding: 20px; border-radius: 5px; }}
                .status {{ padding: 10px; border-radius: 5px; color: white; }}
                .compliant {{ background: #28a745; }}
                .non-compliant {{ background: #dc3545; }}
                .partial {{ background: #ffc107; }}
                table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background: #f2f2f2; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Compliance Report</h1>
                <p><strong>Policy:</strong> {assessment["policy_id"]}</p>
                <p><strong>Framework:</strong> {assessment["framework"]}</p>
                <p><strong>Assessment Date:</strong> {assessment["assessment_date"]}</p>
                <p><strong>Status:</strong>
                    <span class="status {assessment["overall_status"].lower().replace("_", "-")}">
                        {assessment["overall_status"].replace("_", " ").title()}
                    </span>
                </p>
                <p><strong>Compliance Rate:</strong> {assessment.get("compliance_rate", 0)}%</p>
            </div>

            <h2>Summary</h2>
            <ul>
        """

        for key, value in assessment["summary"].items():
            html += f"<li><strong>{key.replace('_', ' ').title()}:</strong> {value}</li>"

        html += """
            </ul>

            <h2>Recommendations</h2>
            <ul>
        """

        for rec in assessment["recommendations"]:
            html += f"<li>{rec}</li>"

        html += """
            </ul>

            <h2>Detailed Results</h2>
            <table>
                <tr>
                    <th>Requirement ID</th>
                    <th>Status</th>
                    <th>Evidence Count</th>
                    <th>Findings</th>
                    <th>Remediation Required</th>
                </tr>
        """

        for result in report_data["detailed_results"]:
            findings = "; ".join(result["findings"]) if result["findings"] else "None"
            html += f"""
                <tr>
                    <td>{result["requirement_id"]}</td>
                    <td>{result["status"]}</td>
                    <td>{result["evidence_count"]}</td>
                    <td>{findings}</td>
                    <td>{"Yes" if result["remediation_required"] else "No"}</td>
                </tr>
            """

        html += """
            </table>
        </body>
        </html>
        """

        return html
