"""
Security scanning and compliance automation for Smithy.

This module provides comprehensive security scanning capabilities including:
- SAST (Static Application Security Testing)
- Dependency vulnerability scanning
- Secrets detection
- Compliance auditing
- Container security scanning
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Protocol


class SecuritySeverity(Enum):
    """Security vulnerability severity levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class ComplianceStandard(Enum):
    """Supported compliance standards."""

    SOC2 = "soc2"
    GDPR = "gdpr"
    HIPAA = "hipaa"
    PCI_DSS = "pci_dss"
    ISO_27001 = "iso_27001"


class ScanType(Enum):
    """Types of security scans."""

    SAST = "sast"
    DEPENDENCY = "dependency"
    SECRETS = "secrets"
    COMPLIANCE = "compliance"
    CONTAINER = "container"


@dataclass
class SecurityFinding:
    """Represents a security finding or vulnerability."""

    scan_type: ScanType
    severity: SecuritySeverity
    title: str
    description: str
    file_path: Optional[Path] = None
    line_number: Optional[int] = None
    cwe_id: Optional[str] = None
    cvss_score: Optional[float] = None
    remediation: Optional[str] = None
    references: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class ComplianceViolation:
    """Represents a compliance violation."""

    standard: ComplianceStandard
    requirement: str
    description: str
    severity: SecuritySeverity
    evidence: List[str] = field(default_factory=list)
    remediation: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class SecurityReport:
    """Comprehensive security scan report."""

    scan_id: str
    target_path: Path
    timestamp: datetime = field(default_factory=datetime.now)
    duration_seconds: float = 0.0
    findings: List[SecurityFinding] = field(default_factory=list)
    compliance_violations: List[ComplianceViolation] = field(default_factory=list)
    summary: Dict[str, int] = field(default_factory=dict)

    def add_finding(self, finding: SecurityFinding) -> None:
        """Add a security finding to the report."""
        self.findings.append(finding)
        self.summary[finding.severity.value] = self.summary.get(finding.severity.value, 0) + 1

    def add_compliance_violation(self, violation: ComplianceViolation) -> None:
        """Add a compliance violation to the report."""
        self.compliance_violations.append(violation)

    @property
    def total_findings(self) -> int:
        """Get total number of security findings."""
        return len(self.findings)

    @property
    def total_violations(self) -> int:
        """Get total number of compliance violations."""
        return len(self.compliance_violations)

    @property
    def critical_findings(self) -> int:
        """Get number of critical severity findings."""
        return self.summary.get(SecuritySeverity.CRITICAL.value, 0)

    def to_dict(self) -> Dict[str, Any]:
        """Convert report to dictionary for serialization."""
        return {
            "scan_id": self.scan_id,
            "target_path": str(self.target_path),
            "timestamp": self.timestamp.isoformat(),
            "duration_seconds": self.duration_seconds,
            "findings": [
                {
                    "scan_type": finding.scan_type.value,
                    "severity": finding.severity.value,
                    "title": finding.title,
                    "description": finding.description,
                    "file_path": str(finding.file_path) if finding.file_path else None,
                    "line_number": finding.line_number,
                    "cwe_id": finding.cwe_id,
                    "cvss_score": finding.cvss_score,
                    "remediation": finding.remediation,
                    "references": finding.references,
                    "metadata": finding.metadata,
                    "timestamp": finding.timestamp.isoformat(),
                }
                for finding in self.findings
            ],
            "compliance_violations": [
                {
                    "standard": violation.standard.value,
                    "requirement": violation.requirement,
                    "description": violation.description,
                    "severity": violation.severity.value,
                    "evidence": violation.evidence,
                    "remediation": violation.remediation,
                    "timestamp": violation.timestamp.isoformat(),
                }
                for violation in self.compliance_violations
            ],
            "summary": self.summary,
        }


class SecurityScanner(Protocol):
    """Protocol for security scanners."""

    async def scan(self, target_path: Path) -> List[SecurityFinding]:
        """Perform security scan on target path."""
        ...


class ComplianceAuditor(Protocol):
    """Protocol for compliance auditors."""

    async def audit(
        self, target_path: Path, standards: List[ComplianceStandard]
    ) -> List[ComplianceViolation]:
        """Perform compliance audit on target path."""
        ...


class SecurityScannerEngine:
    """Main security scanning engine that orchestrates multiple scanners."""

    def __init__(self):
        self.scanners: Dict[ScanType, SecurityScanner] = {}
        self.compliance_auditors: Dict[ComplianceStandard, ComplianceAuditor] = {}

    def register_scanner(self, scan_type: ScanType, scanner: SecurityScanner) -> None:
        """Register a security scanner."""
        self.scanners[scan_type] = scanner

    def register_compliance_auditor(
        self, standard: ComplianceStandard, auditor: ComplianceAuditor
    ) -> None:
        """Register a compliance auditor."""
        self.compliance_auditors[standard] = auditor

    async def comprehensive_scan(
        self,
        target_path: Path,
        scan_types: Optional[List[ScanType]] = None,
        compliance_standards: Optional[List[ComplianceStandard]] = None,
    ) -> SecurityReport:
        """Perform comprehensive security scan."""
        import time
        import uuid

        scan_id = str(uuid.uuid4())
        report = SecurityReport(scan_id=scan_id, target_path=target_path)
        start_time = time.time()

        try:
            # Run security scanners
            if scan_types is None:
                scan_types = list(self.scanners.keys())

            scan_tasks = []
            for scan_type in scan_types:
                if scan_type in self.scanners:
                    scanner = self.scanners[scan_type]
                    scan_tasks.append(self._run_scanner(scanner, scan_type, target_path))

            if scan_tasks:
                scan_results = await asyncio.gather(*scan_tasks, return_exceptions=True)
                for result in scan_results:
                    if isinstance(result, Exception):
                        # Log error but continue with other scans
                        print(f"Scanner error: {result}")
                        continue
                    # At this point, result is guaranteed to be List[SecurityFinding]
                    findings: List[SecurityFinding] = result  # type: ignore
                    for finding in findings:
                        report.add_finding(finding)

            # Run compliance auditors
            if compliance_standards is None:
                compliance_standards = list(self.compliance_auditors.keys())

            audit_tasks = []
            for standard in compliance_standards:
                if standard in self.compliance_auditors:
                    auditor = self.compliance_auditors[standard]
                    audit_tasks.append(self._run_auditor(auditor, standard, target_path))

            if audit_tasks:
                audit_results = await asyncio.gather(*audit_tasks, return_exceptions=True)
                for result in audit_results:
                    if isinstance(result, Exception):
                        # Log error but continue with other audits
                        print(f"Auditor error: {result}")
                        continue
                    # At this point, result is guaranteed to be List[ComplianceViolation]
                    violations: List[ComplianceViolation] = result  # type: ignore
                    for violation in violations:
                        report.add_compliance_violation(violation)

        finally:
            report.duration_seconds = time.time() - start_time

        return report

    async def _run_scanner(
        self, scanner: SecurityScanner, scan_type: ScanType, target_path: Path
    ) -> List[SecurityFinding]:
        """Run a single security scanner."""
        return await scanner.scan(target_path)

    async def _run_auditor(
        self, auditor: ComplianceAuditor, standard: ComplianceStandard, target_path: Path
    ) -> List[ComplianceViolation]:
        """Run a single compliance auditor."""
        return await auditor.audit(target_path, [standard])


# Global security scanner engine instance
security_engine = SecurityScannerEngine()
