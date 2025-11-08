"""
Smithy Compliance Checkers

Concrete implementations of compliance checkers for various frameworks.
These checkers use evidence collectors to assess compliance with specific requirements.
"""

from datetime import datetime

from .compliance import (
    ComplianceCheckResult,
    ComplianceFramework,
    ComplianceRequirement,
    ComplianceStatus,
    PolicySeverity,
)
from .evidence_collectors import (
    APIEvidenceCollector,
    CommandEvidenceCollector,
    ConfigurationEvidenceCollector,
    DatabaseEvidenceCollector,
    FileSystemEvidenceCollector,
    SecurityScanEvidenceCollector,
)


class GDPRComplianceChecker:
    """GDPR compliance checker implementation"""

    def __init__(self):
        self.file_collector = FileSystemEvidenceCollector()
        self.api_collector = APIEvidenceCollector(base_url="https://api.example.com")
        self.command_collector = CommandEvidenceCollector()

    async def check_data_processing_inventory(self) -> ComplianceCheckResult:
        """Check GDPR Article 30 - Records of processing activities"""
        requirement = ComplianceRequirement(
            id="gdpr-30-data-inventory",
            framework=ComplianceFramework.GDPR,
            title="Data Processing Inventory",
            description="Maintain records of all data processing activities",
            severity=PolicySeverity.HIGH,
            category="data_protection",
            controls=["GDPR-30"],
            evidence_required=["data_inventory_file", "processing_records"],
            remediation_steps=[
                "Create and maintain data processing inventory",
                "Document all data processing activities",
                "Include data categories, purposes, and recipients",
            ],
            metadata={
                "required_files": ["data_processing_inventory.json", "processing_records.csv"],
                "required_directories": ["data_inventory"],
                "content_check": "processing_activities",
            },
        )

        evidence = await self.file_collector.collect_evidence(requirement)

        # Assess compliance based on evidence
        has_inventory = any(
            e.evidence_data.get("exists", False)
            and "data_processing_inventory" in e.evidence_data.get("file_path", "")
            for e in evidence
        )

        has_records = any(
            e.evidence_data.get("exists", False)
            and "processing_records" in e.evidence_data.get("file_path", "")
            for e in evidence
        )

        has_directory = any(
            e.evidence_type == "directory_permissions" and e.evidence_data.get("exists", False)
            for e in evidence
        )

        compliant = has_inventory and has_records and has_directory

        return ComplianceCheckResult(
            requirement_id=requirement.id,
            status=ComplianceStatus.COMPLIANT if compliant else ComplianceStatus.NON_COMPLIANT,
            evidence=evidence,
            findings=[
                f"Data processing inventory: {'Present' if has_inventory else 'Missing'}",
                f"Processing records: {'Present' if has_records else 'Missing'}",
                f"Inventory directory: {'Present' if has_directory else 'Missing'}",
            ],
            remediation_required=not compliant,
            checked_at=datetime.now(),
            metadata={
                "data_inventory_exists": has_inventory,
                "processing_records_exist": has_records,
                "inventory_directory_exists": has_directory,
            },
        )

    async def check_data_subject_rights(self) -> ComplianceCheckResult:
        """Check GDPR Articles 15-22 - Data subject rights implementation"""
        requirement = ComplianceRequirement(
            id="gdpr-15-22-rights",
            framework=ComplianceFramework.GDPR,
            title="Data Subject Rights",
            description="Implement procedures for data subject rights (access, rectification, erasure, etc.)",
            severity=PolicySeverity.CRITICAL,
            category="data_subject_rights",
            controls=["GDPR-15", "GDPR-16", "GDPR-17", "GDPR-18", "GDPR-20", "GDPR-21", "GDPR-22"],
            evidence_required=["rights_procedures", "api_endpoints"],
            remediation_steps=[
                "Implement API endpoints for data subject rights",
                "Create procedures for handling access requests",
                "Establish processes for data erasure and portability",
            ],
            metadata={
                "api_endpoints": [
                    {
                        "endpoint": "/api/v1/subjects/{id}/access",
                        "method": "GET",
                        "expected_status": 200,
                    },
                    {
                        "endpoint": "/api/v1/subjects/{id}/erase",
                        "method": "DELETE",
                        "expected_status": 200,
                    },
                    {
                        "endpoint": "/api/v1/subjects/{id}/rectify",
                        "method": "PUT",
                        "expected_status": 200,
                    },
                ],
                "commands": [
                    {
                        "command": "whoami",
                        "expected_exit_code": 0,
                    },  # Placeholder for rights verification
                    {"command": "id", "expected_exit_code": 0},  # Additional system check
                ],
            },
        )

        # Collect evidence from multiple sources
        api_evidence = await self.api_collector.collect_evidence(requirement)
        command_evidence = await self.command_collector.collect_evidence(requirement)

        evidence = api_evidence + command_evidence

        # Assess compliance
        api_endpoints_working = all(
            e.evidence_data.get("status_matches", False) for e in api_evidence
        )

        commands_successful = all(
            e.evidence_data.get("exit_code_matches", False) for e in command_evidence
        )

        compliant = api_endpoints_working and commands_successful

        return ComplianceCheckResult(
            requirement_id=requirement.id,
            status=ComplianceStatus.COMPLIANT if compliant else ComplianceStatus.NON_COMPLIANT,
            evidence=evidence,
            findings=[
                f"API endpoints functional: {'Yes' if api_endpoints_working else 'No'}",
                f"System commands successful: {'Yes' if commands_successful else 'No'}",
            ],
            remediation_required=not compliant,
            checked_at=datetime.now(),
            metadata={
                "api_endpoints_functional": api_endpoints_working,
                "system_commands_successful": commands_successful,
            },
        )


class SOC2ComplianceChecker:
    """SOC2 compliance checker implementation"""

    def __init__(self, config_paths=None, scan_results_path=None, db_connection=None):
        from pathlib import Path

        self.config_collector = ConfigurationEvidenceCollector(config_paths=config_paths or [])
        self.security_collector = SecurityScanEvidenceCollector(
            scan_results_path=Path(scan_results_path) if scan_results_path else None
        )
        self.database_collector = DatabaseEvidenceCollector(
            connection_string=db_connection or "audit_db"
        )

    async def check_security_controls(self) -> ComplianceCheckResult:
        """Check SOC2 CC1.1 - Security controls implementation"""
        requirement = ComplianceRequirement(
            id="soc2-cc1.1-security",
            framework=ComplianceFramework.SOC2,
            title="Security Controls",
            description="Implement and maintain security controls",
            severity=PolicySeverity.HIGH,
            category="security",
            controls=["SOC2-CC1.1"],
            evidence_required=["security_config", "scan_results"],
            remediation_steps=[
                "Configure security settings in application",
                "Run regular security scans",
                "Address identified vulnerabilities",
            ],
            metadata={
                "config_checks": [
                    {"file": "security.json", "key": "enabled", "expected_value": True},
                    {"file": "app.conf", "key": "security.encryption", "expected_value": "AES256"},
                ],
                "security_scans": ["vulnerability_scan"],
                "scan_thresholds": {"max_critical": 0, "max_high": 2},
            },
        )

        config_evidence = await self.config_collector.collect_evidence(requirement)
        security_evidence = await self.security_collector.collect_evidence(requirement)

        evidence = config_evidence + security_evidence

        # Assess compliance
        config_compliant = all(
            e.evidence_data.get("matches_expected", False) for e in config_evidence
        )

        security_compliant = all(
            e.evidence_data.get("meets_thresholds", False) for e in security_evidence
        )

        compliant = config_compliant and security_compliant

        return ComplianceCheckResult(
            requirement_id=requirement.id,
            status=ComplianceStatus.COMPLIANT if compliant else ComplianceStatus.NON_COMPLIANT,
            evidence=evidence,
            findings=[
                f"Security config correct: {'Yes' if config_compliant else 'No'}",
                f"Security scans pass: {'Yes' if security_compliant else 'No'}",
            ],
            remediation_required=not compliant,
            checked_at=datetime.now(),
            metadata={
                "security_config_correct": config_compliant,
                "security_scans_pass": security_compliant,
            },
        )

    async def check_change_management(self) -> ComplianceCheckResult:
        """Check SOC2 CC2.1 - Change management procedures"""
        requirement = ComplianceRequirement(
            id="soc2-cc2.1-changes",
            framework=ComplianceFramework.SOC2,
            title="Change Management",
            description="Implement change management procedures",
            severity=PolicySeverity.MEDIUM,
            category="change_management",
            controls=["SOC2-CC2.1"],
            evidence_required=["change_logs", "database_audit"],
            remediation_steps=[
                "Implement change logging procedures",
                "Maintain audit trails in database",
                "Document all system changes",
            ],
            metadata={
                "database_queries": [
                    {"query": "SELECT COUNT(*) FROM change_log", "expected_result": 42},
                    {"query": "SELECT EXISTS(SELECT 1 FROM audit_trail)", "expected_result": True},
                ]
            },
        )

        evidence = await self.database_collector.collect_evidence(requirement)

        # Assess compliance
        queries_successful = all(e.evidence_data.get("matches_expected", False) for e in evidence)

        compliant = queries_successful

        return ComplianceCheckResult(
            requirement_id=requirement.id,
            status=ComplianceStatus.COMPLIANT if compliant else ComplianceStatus.NON_COMPLIANT,
            evidence=evidence,
            findings=[
                f"Change logs exist: {'Yes' if queries_successful else 'No'}",
                f"Audit trail present: {'Yes' if queries_successful else 'No'}",
            ],
            remediation_required=not compliant,
            checked_at=datetime.now(),
            metadata={
                "change_logs_exist": queries_successful,
                "audit_trail_present": queries_successful,
            },
        )


class HIPAAComplianceChecker:
    """HIPAA compliance checker implementation"""

    def __init__(self, base_path=None, config_paths=None, scan_results_path=None):
        from pathlib import Path

        self.file_collector = FileSystemEvidenceCollector(
            base_path=Path(base_path) if base_path else None
        )
        self.config_collector = ConfigurationEvidenceCollector(config_paths=config_paths or [])
        self.security_collector = SecurityScanEvidenceCollector(
            scan_results_path=Path(scan_results_path) if scan_results_path else None
        )

    async def check_phi_protection(self) -> ComplianceCheckResult:
        """Check HIPAA Security Rule - Protected Health Information (PHI) protection"""
        requirement = ComplianceRequirement(
            id="hipaa-phi-protection",
            framework=ComplianceFramework.HIPAA,
            title="PHI Protection",
            description="Implement safeguards for Protected Health Information",
            severity=PolicySeverity.CRITICAL,
            category="data_protection",
            controls=["HIPAA-164.312"],
            evidence_required=["encryption_config", "access_controls", "audit_logs"],
            remediation_steps=[
                "Implement PHI encryption at rest and in transit",
                "Configure access controls for PHI data",
                "Enable audit logging for PHI access",
            ],
            metadata={
                "config_checks": [
                    {
                        "file": "security.json",
                        "key": "phi.encryption.enabled",
                        "expected_value": True,
                    },
                    {
                        "file": "access.conf",
                        "key": "phi.access_control",
                        "expected_value": "role_based",
                    },
                ],
                "required_files": ["phi_audit.log", "encryption_keys.json"],
                "security_scans": ["phi_security_scan"],
                "scan_thresholds": {"max_critical": 0, "max_high": 0},
            },
        )

        config_evidence = await self.config_collector.collect_evidence(requirement)
        file_evidence = await self.file_collector.collect_evidence(requirement)
        security_evidence = await self.security_collector.collect_evidence(requirement)

        evidence = config_evidence + file_evidence + security_evidence

        # Assess compliance
        config_compliant = all(
            e.evidence_data.get("matches_expected", False) for e in config_evidence
        )

        files_present = all(e.evidence_data.get("exists", False) for e in file_evidence)

        security_clean = all(
            e.evidence_data.get("meets_thresholds", False) for e in security_evidence
        )

        compliant = config_compliant and files_present and security_clean

        return ComplianceCheckResult(
            requirement_id=requirement.id,
            status=ComplianceStatus.COMPLIANT if compliant else ComplianceStatus.NON_COMPLIANT,
            evidence=evidence,
            findings=[
                f"PHI config correct: {'Yes' if config_compliant else 'No'}",
                f"PHI files present: {'Yes' if files_present else 'No'}",
                f"PHI security clean: {'Yes' if security_clean else 'No'}",
            ],
            remediation_required=not compliant,
            checked_at=datetime.now(),
            metadata={
                "phi_config_correct": config_compliant,
                "phi_files_present": files_present,
                "phi_security_clean": security_clean,
            },
        )

    async def check_breach_notification(self) -> ComplianceCheckResult:
        """Check HIPAA Breach Notification Rule"""
        requirement = ComplianceRequirement(
            id="hipaa-breach-notification",
            framework=ComplianceFramework.HIPAA,
            title="Breach Notification",
            description="Implement breach notification procedures",
            severity=PolicySeverity.HIGH,
            category="incident_response",
            controls=["HIPAA-164.404", "HIPAA-164.408"],
            evidence_required=["notification_procedures", "incident_response_plan"],
            remediation_steps=[
                "Create breach notification procedures",
                "Develop incident response plan",
                "Establish notification timelines",
            ],
            metadata={
                "required_files": [
                    "breach_notification_procedures.pdf",
                    "incident_response_plan.pdf",
                    "notification_templates.docx",
                ],
                "required_directories": ["breach_notifications"],
            },
        )

        evidence = await self.file_collector.collect_evidence(requirement)

        # Assess compliance
        required_files_present = all(
            any(
                e.evidence_data.get("exists", False)
                and filename in e.evidence_data.get("file_path", "")
                for e in evidence
            )
            for filename in [
                "breach_notification_procedures.pdf",
                "incident_response_plan.pdf",
                "notification_templates.docx",
            ]
        )

        directory_exists = any(
            e.evidence_type == "directory_permissions" and e.evidence_data.get("exists", False)
            for e in evidence
        )

        compliant = required_files_present and directory_exists

        return ComplianceCheckResult(
            requirement_id=requirement.id,
            status=ComplianceStatus.COMPLIANT if compliant else ComplianceStatus.NON_COMPLIANT,
            evidence=evidence,
            findings=[
                f"Notification procedures exist: {'Yes' if required_files_present else 'No'}",
                f"Notification directory exists: {'Yes' if directory_exists else 'No'}",
            ],
            remediation_required=not compliant,
            checked_at=datetime.now(),
            metadata={
                "notification_procedures_exist": required_files_present,
                "notification_directory_exists": directory_exists,
            },
        )
