"""
Sample Compliance Policies for Smithy Compliance Automation

This module provides sample compliance policies for GDPR, SOC2, and HIPAA frameworks
that demonstrate how to use the compliance checkers and evidence collectors.
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

from .compliance import (
    ComplianceFramework,
    CompliancePolicy,
    ComplianceRequirement,
    PolicySeverity,
)


def create_gdpr_compliance_policy() -> CompliancePolicy:
    """Create a sample GDPR compliance policy"""

    requirements = [
        ComplianceRequirement(
            id="gdpr-data-subject-rights",
            framework=ComplianceFramework.GDPR,
            title="Data Subject Rights Implementation",
            description="Ensure all data subject rights (access, rectification, erasure, etc.) are properly implemented",
            severity=PolicySeverity.CRITICAL,
            category="data_subject_rights",
            controls=[
                "Article 15: Right of access",
                "Article 16: Right to rectification",
                "Article 17: Right to erasure",
                "Article 18: Right to restriction of processing",
                "Article 20: Right to data portability",
                "Article 21: Right to object",
                "Article 22: Right to object to automated decision making",
            ],
            evidence_required=["api_endpoints", "command_output"],
            remediation_steps=[
                "Implement API endpoints for data subject requests",
                "Create automated processes for data retrieval and deletion",
                "Establish request tracking and response systems",
                "Train staff on data subject rights procedures",
            ],
            tags={"gdpr", "data-rights", "privacy"},
            metadata={
                "api_endpoints": ["/api/data-subject/access", "/api/data-subject/delete"],
                "commands": ["check_data_subject_api", "verify_rights_implementation"],
            },
        ),
        ComplianceRequirement(
            id="gdpr-data-protection-officer",
            framework=ComplianceFramework.GDPR,
            title="Data Protection Officer Appointment",
            description="Appoint a qualified Data Protection Officer and ensure proper oversight",
            severity=PolicySeverity.HIGH,
            category="data_protection_officer",
            controls=[
                "Article 37: Designation of the data protection officer",
                "Article 38: Position of the data protection officer",
                "Article 39: Tasks of the data protection officer",
            ],
            evidence_required=["configuration_files", "documentation"],
            remediation_steps=[
                "Appoint qualified DPO with necessary expertise",
                "Provide DPO with necessary resources and independence",
                "Document DPO responsibilities and authority",
                "Ensure DPO has access to all necessary information",
            ],
            tags={"gdpr", "dpo", "governance"},
            metadata={
                "config_files": ["dpo_config.json", "privacy_policy.md"],
                "required_expertise": ["data protection law", "IT security", "privacy practices"],
            },
        ),
        ComplianceRequirement(
            id="gdpr-privacy-by-design",
            framework=ComplianceFramework.GDPR,
            title="Privacy by Design Implementation",
            description="Implement privacy by design principles in all data processing activities",
            severity=PolicySeverity.HIGH,
            category="privacy_by_design",
            controls=[
                "Article 25: Data protection by design and by default",
                "Recital 78: Privacy by design requirements",
            ],
            evidence_required=["code_review", "architecture_docs"],
            remediation_steps=[
                "Conduct privacy impact assessments for new projects",
                "Implement privacy controls in system design",
                "Regular review of privacy measures",
                "Document privacy design decisions",
            ],
            tags={"gdpr", "privacy-by-design", "architecture"},
            metadata={"assessment_required": True, "review_frequency": "quarterly"},
        ),
    ]

    return CompliancePolicy(
        id="gdpr-sample-policy-v1.0",
        name="GDPR Compliance Policy - Sample Implementation",
        description="Sample GDPR compliance policy demonstrating data protection requirements",
        framework=ComplianceFramework.GDPR,
        version="1.0",
        requirements=requirements,
        effective_date=datetime.now(),
        review_date=datetime.now() + timedelta(days=365),
        owner="Compliance Team",
        tags={"gdpr", "sample", "privacy"},
        metadata={
            "scope": "All data processing activities",
            "jurisdiction": "EU/EEA",
            "last_updated": datetime.now().isoformat(),
        },
    )


def create_soc2_compliance_policy() -> CompliancePolicy:
    """Create a sample SOC2 compliance policy"""

    requirements = [
        ComplianceRequirement(
            id="soc2-security-controls",
            framework=ComplianceFramework.SOC2,
            title="Security Controls Implementation",
            description="Implement and maintain comprehensive security controls",
            severity=PolicySeverity.CRITICAL,
            category="security_controls",
            controls=[
                "CC1.1: COSO Principle 1 - Demonstrates commitment to integrity and ethical values",
                "CC2.2: COSO Principle 5 - Demonstrates commitment to competence",
                "CC3.1: COSO Principle 9 - Identifies and analyzes risk",
                "CC4.1: COSO Principle 13 - Defines objectives and strategies",
                "CC5.1: COSO Principle 17 - Identifies and manages financial and operating information",
            ],
            evidence_required=["configuration_files", "security_scans", "logs"],
            remediation_steps=[
                "Implement access controls and authentication",
                "Deploy encryption for data at rest and in transit",
                "Establish security monitoring and alerting",
                "Conduct regular security assessments",
                "Maintain security incident response procedures",
            ],
            tags={"soc2", "security", "controls"},
            metadata={
                "config_paths": ["security_config.json", "access_control.yaml"],
                "scan_results": "security_scan_results.json",
                "log_files": ["security.log", "access.log"],
            },
        ),
        ComplianceRequirement(
            id="soc2-change-management",
            framework=ComplianceFramework.SOC2,
            title="Change Management Process",
            description="Establish formal change management procedures for system changes",
            severity=PolicySeverity.HIGH,
            category="change_management",
            controls=[
                "CC8.1: COSO Principle 25 - Selects and develops control activities",
                "CC9.1: COSO Principle 29 - Evaluates and communicates deficiencies",
            ],
            evidence_required=["change_logs", "approval_records"],
            remediation_steps=[
                "Document change management procedures",
                "Implement change approval workflows",
                "Conduct impact assessments for changes",
                "Maintain change history and rollback procedures",
                "Test changes in staging environment before production",
            ],
            tags={"soc2", "change-management", "operations"},
            metadata={
                "change_log_path": "changes.log",
                "approval_required": True,
                "testing_required": True,
            },
        ),
        ComplianceRequirement(
            id="soc2-monitoring-alerting",
            framework=ComplianceFramework.SOC2,
            title="Monitoring and Alerting Systems",
            description="Implement comprehensive monitoring and alerting for system health and security",
            severity=PolicySeverity.HIGH,
            category="monitoring",
            controls=[
                "CC7.1: COSO Principle 21 - Considers all relevant information",
                "CC7.2: COSO Principle 22 - Communicates internally",
                "CC7.3: COSO Principle 23 - Communicates externally",
            ],
            evidence_required=["monitoring_config", "alert_logs"],
            remediation_steps=[
                "Deploy monitoring tools and dashboards",
                "Configure alerting for critical events",
                "Establish monitoring baselines",
                "Implement log aggregation and analysis",
                "Create incident response procedures",
            ],
            tags={"soc2", "monitoring", "alerting"},
            metadata={
                "monitoring_tools": ["prometheus", "grafana", "elk"],
                "alert_channels": ["email", "slack", "pagerduty"],
                "retention_period_days": 90,
            },
        ),
    ]

    return CompliancePolicy(
        id="soc2-sample-policy-v1.0",
        name="SOC2 Compliance Policy - Sample Implementation",
        description="Sample SOC2 compliance policy demonstrating trust services criteria",
        framework=ComplianceFramework.SOC2,
        version="1.0",
        requirements=requirements,
        effective_date=datetime.now(),
        review_date=datetime.now() + timedelta(days=365),
        owner="Compliance Team",
        tags={"soc2", "sample", "trust-services"},
        metadata={
            "trust_services_criteria": ["Security", "Availability", "Processing Integrity"],
            "scope": "Information systems and processes",
            "last_updated": datetime.now().isoformat(),
        },
    )


def create_hipaa_compliance_policy() -> CompliancePolicy:
    """Create a sample HIPAA compliance policy"""

    requirements = [
        ComplianceRequirement(
            id="hipaa-phi-protection",
            framework=ComplianceFramework.HIPAA,
            title="Protected Health Information (PHI) Protection",
            description="Implement safeguards to protect PHI from unauthorized access, use, or disclosure",
            severity=PolicySeverity.CRITICAL,
            category="phi_protection",
            controls=[
                "164.312(a)(1): Access Control - Implement technical policies and procedures for electronic information systems",
                "164.312(a)(2)(i): Access Control - Unique user identification",
                "164.312(a)(2)(ii): Access Control - Emergency access procedure",
                "164.312(a)(2)(iii): Access Control - Automatic logoff",
                "164.312(a)(2)(iv): Access Control - Encryption and decryption",
            ],
            evidence_required=["configuration_files", "access_logs", "encryption_config"],
            remediation_steps=[
                "Implement role-based access controls",
                "Deploy encryption for PHI at rest and in transit",
                "Establish audit logging for PHI access",
                "Conduct regular access reviews",
                "Implement breach notification procedures",
            ],
            tags={"hipaa", "phi", "privacy"},
            metadata={
                "phi_data_types": ["medical_records", "billing_info", "patient_demographics"],
                "encryption_required": True,
                "access_logging": True,
                "retention_years": 6,
            },
        ),
        ComplianceRequirement(
            id="hipaa-risk-analysis",
            framework=ComplianceFramework.HIPAA,
            title="Security Risk Analysis",
            description="Conduct regular security risk analyses of ePHI systems",
            severity=PolicySeverity.HIGH,
            category="risk_analysis",
            controls=[
                "164.308(a)(1)(ii)(A): Risk Analysis - Conduct an accurate and thorough assessment",
                "164.308(a)(1)(ii)(B): Risk Analysis - Document security measures",
                "164.308(a)(1)(ii)(C): Risk Analysis - Implement security measures",
            ],
            evidence_required=["risk_assessment_reports", "vulnerability_scans"],
            remediation_steps=[
                "Conduct annual risk assessments",
                "Document identified risks and mitigation plans",
                "Implement security controls based on risk assessment",
                "Review and update risk assessments regularly",
                "Maintain risk assessment documentation",
            ],
            tags={"hipaa", "risk-analysis", "assessment"},
            metadata={
                "assessment_frequency": "annual",
                "required_elements": [
                    "threat_identification",
                    "vulnerability_scanning",
                    "impact_analysis",
                ],
                "documentation_required": True,
            },
        ),
        ComplianceRequirement(
            id="hipaa-business-associate-agreements",
            framework=ComplianceFramework.HIPAA,
            title="Business Associate Agreements",
            description="Establish and maintain business associate agreements with vendors",
            severity=PolicySeverity.HIGH,
            category="business_associates",
            controls=[
                "164.314(a): Business Associate Contracts - Written contracts required",
                "164.314(b): Business Associate Contracts - Contract requirements",
                "164.504(e): Business Associate Contracts - Business associate obligations",
            ],
            evidence_required=["contract_files", "vendor_list"],
            remediation_steps=[
                "Identify all business associates",
                "Draft and negotiate BAA templates",
                "Review existing contracts for BAA requirements",
                "Monitor business associate compliance",
                "Maintain BAA documentation and renewal schedules",
            ],
            tags={"hipaa", "business-associates", "contracts"},
            metadata={
                "contract_template": "baa_template.docx",
                "review_frequency": "annual",
                "required_clauses": ["permitted_uses", "security_measures", "breach_notification"],
            },
        ),
    ]

    return CompliancePolicy(
        id="hipaa-sample-policy-v1.0",
        name="HIPAA Compliance Policy - Sample Implementation",
        description="Sample HIPAA compliance policy demonstrating health information protection",
        framework=ComplianceFramework.HIPAA,
        version="1.0",
        requirements=requirements,
        effective_date=datetime.now(),
        review_date=datetime.now() + timedelta(days=365),
        owner="Compliance Team",
        tags={"hipaa", "sample", "healthcare"},
        metadata={
            "covered_entity_type": "Healthcare Provider",
            "scope": "Electronic Protected Health Information (ePHI)",
            "last_updated": datetime.now().isoformat(),
        },
    )


def save_policy_to_file(policy: CompliancePolicy, output_path: Path):
    """Save a compliance policy to a JSON file"""

    def serialize_datetime(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return str(obj)

    policy_data = {
        "id": policy.id,
        "name": policy.name,
        "description": policy.description,
        "framework": policy.framework.value,
        "version": policy.version,
        "effective_date": policy.effective_date.isoformat(),
        "review_date": policy.review_date.isoformat() if policy.review_date else None,
        "owner": policy.owner,
        "tags": list(policy.tags),
        "metadata": policy.metadata,
        "requirements": [
            {
                "id": req.id,
                "framework": req.framework.value,
                "title": req.title,
                "description": req.description,
                "severity": req.severity.value,
                "category": req.category,
                "controls": req.controls,
                "evidence_required": req.evidence_required,
                "remediation_steps": req.remediation_steps,
                "tags": list(req.tags),
                "metadata": req.metadata,
            }
            for req in policy.requirements
        ],
    }

    with open(output_path, "w") as f:
        json.dump(policy_data, f, indent=2, default=serialize_datetime)


async def load_policy_from_file(file_path: Path) -> CompliancePolicy:
    """Load a compliance policy from a JSON file"""
    from .compliance import PolicyEngine

    engine = PolicyEngine()
    return await engine.load_policy(file_path)


def create_sample_policies_directory(base_path: Path) -> Path:
    """Create and return the sample policies directory"""
    policies_dir = base_path / "sample_policies"
    policies_dir.mkdir(exist_ok=True)
    return policies_dir


def generate_all_sample_policies(output_dir: Path):
    """Generate and save all sample compliance policies"""

    policies = [
        ("gdpr", create_gdpr_compliance_policy()),
        ("soc2", create_soc2_compliance_policy()),
        ("hipaa", create_hipaa_compliance_policy()),
    ]

    for framework, policy in policies:
        output_path = output_dir / f"{framework}_sample_policy.json"
        save_policy_to_file(policy, output_path)
        print(f"Generated {framework} sample policy: {output_path}")


if __name__ == "__main__":
    # Generate sample policies when run directly
    import sys
    from pathlib import Path

    if len(sys.argv) > 1:
        output_dir = Path(sys.argv[1])
    else:
        output_dir = Path.cwd() / "sample_policies"

    output_dir.mkdir(exist_ok=True)
    generate_all_sample_policies(output_dir)
    print(f"Sample policies generated in: {output_dir}")
