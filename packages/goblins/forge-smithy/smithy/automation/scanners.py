"""
Concrete implementations of security scanners for Smithy.

This module provides actual implementations of the security scanning protocols
defined in security.py, including SAST, dependency scanning, secrets detection,
and compliance auditing.
"""

import ast
import re
import subprocess
from pathlib import Path
from typing import List

from .security import (
    ComplianceAuditor,
    ComplianceStandard,
    ComplianceViolation,
    ScanType,
    SecurityFinding,
    SecurityScanner,
    SecuritySeverity,
)


class BasicSASTScanner(SecurityScanner):
    """Basic Static Application Security Testing scanner for Python code."""

    def __init__(self):
        self.vulnerability_patterns = {
            # SQL Injection patterns
            "sql_injection_string_format": re.compile(r"cursor\.execute\(.*%.*\)|execute\(.*%.*\)"),
            "sql_injection_f_string": re.compile(r"cursor\.execute\(f.*\)|execute\(f.*\)"),
            # Command injection
            "command_injection_subprocess": re.compile(
                r"subprocess\.(run|call|Popen|check_output)\([^)]*\+.*\)|\.format\(.*\)"
            ),
            # Hardcoded secrets
            "hardcoded_api_key": re.compile(r"api[_-]?key\s*=\s*['\"][^'\"]{10,}['\"]"),
            "hardcoded_secret": re.compile(r"secret[_-]?key\s*=\s*['\"][^'\"]{10,}['\"]"),
            "hardcoded_password": re.compile(r"password\s*=\s*['\"][^'\"]{8,}['\"]"),
            # XSS patterns
            "xss_vulnerable": re.compile(r"innerHTML\s*=|outerHTML\s*="),
            # Path traversal
            "path_traversal": re.compile(r"\.\./|\.\.\\"),
        }

    async def scan(self, target_path: Path) -> List[SecurityFinding]:
        """Scan Python files for security vulnerabilities."""
        findings = []

        # Find all Python files
        python_files = list(target_path.rglob("*.py"))

        for file_path in python_files:
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                # Check for vulnerability patterns
                for vuln_type, pattern in self.vulnerability_patterns.items():
                    for match in pattern.finditer(content):
                        line_number = content[: match.start()].count("\n") + 1

                        severity = SecuritySeverity.HIGH
                        title = f"Potential {vuln_type.replace('_', ' ').title()}"
                        description = f"Found pattern matching {vuln_type} vulnerability"
                        remediation = self._get_remediation(vuln_type)

                        finding = SecurityFinding(
                            scan_type=ScanType.SAST,
                            severity=severity,
                            title=title,
                            description=description,
                            file_path=file_path,
                            line_number=line_number,
                            remediation=remediation,
                            metadata={"pattern": vuln_type, "match": match.group()},
                        )
                        findings.append(finding)

                # AST-based analysis for more complex issues
                ast_findings = self._analyze_ast(content, file_path)
                findings.extend(ast_findings)

            except Exception as e:
                # Log error but continue scanning other files
                print(f"Error scanning {file_path}: {e}")

        return findings

    def _analyze_ast(self, content: str, file_path: Path) -> List[SecurityFinding]:
        """Analyze Python AST for security issues."""
        findings = []

        try:
            tree = ast.parse(content, filename=str(file_path))

            for node in ast.walk(tree):
                if isinstance(node, ast.Call):
                    # Check for dangerous function calls
                    if self._is_dangerous_call(node):
                        finding = SecurityFinding(
                            scan_type=ScanType.SAST,
                            severity=SecuritySeverity.MEDIUM,
                            title="Potentially dangerous function call",
                            description=f"Call to {self._get_call_name(node)} may be unsafe",
                            file_path=file_path,
                            line_number=getattr(node, "lineno", None),
                            remediation="Review this function call for security implications",
                            metadata={"call": self._get_call_name(node)},
                        )
                        findings.append(finding)

                elif isinstance(node, ast.Import) or isinstance(node, ast.ImportFrom):
                    # Check for insecure imports
                    insecure_modules = {"pickle", "marshal", "shelve"}
                    for alias in node.names:
                        module_name = (
                            alias.name
                            if isinstance(node, ast.Import)
                            else (node.module or alias.name)
                        )
                        if module_name in insecure_modules:
                            finding = SecurityFinding(
                                scan_type=ScanType.SAST,
                                severity=SecuritySeverity.MEDIUM,
                                title=f"Insecure module import: {module_name}",
                                description=f"Importing {module_name} can be dangerous",
                                file_path=file_path,
                                line_number=getattr(node, "lineno", None),
                                remediation=f"Consider safer alternatives to {module_name}",
                                metadata={"module": module_name},
                            )
                            findings.append(finding)

        except SyntaxError:
            # Skip files with syntax errors
            pass

        return findings

    def _is_dangerous_call(self, node: ast.Call) -> bool:
        """Check if a function call is potentially dangerous."""
        dangerous_functions = {
            "eval",
            "exec",
            "compile",
            "__import__",
            "open",
            "file",
            "input",
            "raw_input",
        }

        func_name = self._get_call_name(node)
        return func_name in dangerous_functions

    def _get_call_name(self, node: ast.Call) -> str:
        """Get the name of a function call."""
        if isinstance(node.func, ast.Name):
            return node.func.id
        elif isinstance(node.func, ast.Attribute):
            return f"{self._get_attr_name(node.func)}.{node.func.attr}"
        return "unknown"

    def _get_attr_name(self, node: ast.Attribute) -> str:
        """Get the full attribute name."""
        if isinstance(node.value, ast.Name):
            return node.value.id
        elif isinstance(node.value, ast.Attribute):
            return f"{self._get_attr_name(node.value)}.{node.value.attr}"
        return "unknown"

    def _get_remediation(self, vuln_type: str) -> str:
        """Get remediation advice for a vulnerability type."""
        remediations = {
            "sql_injection_string_format": "Use parameterized queries or prepared statements",
            "sql_injection_f_string": "Use parameterized queries instead of string formatting",
            "command_injection_subprocess": "Use shell=False and validate/sanitize input",
            "hardcoded_api_key": "Use environment variables or secure credential storage",
            "hardcoded_secret": "Use environment variables or secure credential storage",
            "hardcoded_password": "Use environment variables or secure credential storage",
            "xss_vulnerable": "Use proper output encoding and Content Security Policy",
            "path_traversal": "Validate and sanitize file paths, use pathlib.Path.resolve()",
        }
        return remediations.get(vuln_type, "Review code for security implications")


class BasicDependencyScanner(SecurityScanner):
    """Basic dependency vulnerability scanner using pip-audit if available."""

    async def scan(self, target_path: Path) -> List[SecurityFinding]:
        """Scan dependencies for known vulnerabilities."""
        findings = []

        # Look for requirements files
        req_files = [
            target_path / "requirements.txt",
            target_path / "pyproject.toml",
            target_path / "setup.py",
            target_path / "Pipfile",
            target_path / "Pipfile.lock",
        ]

        requirements_file = None
        for req_file in req_files:
            if req_file.exists():
                requirements_file = req_file
                break

        if not requirements_file:
            return findings

        try:
            # Try to use pip-audit if available
            result = subprocess.run(
                ["pip-audit", "--format", "json", "-r", str(requirements_file)],
                capture_output=True,
                text=True,
                cwd=target_path,
                timeout=60,
            )

            if result.returncode == 0:
                import json

                audit_data = json.loads(result.stdout)
                findings.extend(self._parse_pip_audit_output(audit_data, requirements_file))
            else:
                # Fallback: basic checks
                findings.extend(self._basic_dependency_check(requirements_file))

        except (subprocess.TimeoutExpired, FileNotFoundError, ValueError):
            # Fallback to basic checks if pip-audit is not available or JSON parsing fails
            findings.extend(self._basic_dependency_check(requirements_file))

        return findings

    def _parse_pip_audit_output(self, audit_data: dict, req_file: Path) -> List[SecurityFinding]:
        """Parse pip-audit JSON output."""
        findings = []

        for vuln in audit_data.get("vulnerabilities", []):
            severity = self._map_cvss_to_severity(vuln.get("cvss", {}).get("score", 0))

            finding = SecurityFinding(
                scan_type=ScanType.DEPENDENCY,
                severity=severity,
                title=f"Vulnerable dependency: {vuln.get('name', 'unknown')}",
                description=f"Package {vuln.get('name')} has known vulnerability: {vuln.get('description', '')}",
                file_path=req_file,
                cwe_id=vuln.get("cwe_id"),
                cvss_score=vuln.get("cvss", {}).get("score"),
                remediation=f"Update {vuln.get('name')} to version {vuln.get('fix_version', 'latest')}",
                references=vuln.get("references", []),
                metadata={
                    "package": vuln.get("name"),
                    "current_version": vuln.get("version"),
                    "fix_version": vuln.get("fix_version"),
                    "vulnerability_id": vuln.get("id"),
                },
            )
            findings.append(finding)

        return findings

    def _basic_dependency_check(self, req_file: Path) -> List[SecurityFinding]:
        """Basic dependency vulnerability checks."""
        findings = []

        try:
            with open(req_file, "r", encoding="utf-8") as f:
                content = f.read()

            # Check for known vulnerable packages (basic patterns)
            vulnerable_patterns = {
                "django<3.2": ("Django", "Update to Django 3.2+ for security fixes"),
                "flask<2.0": ("Flask", "Update to Flask 2.0+ for security fixes"),
                "requests<2.25": ("Requests", "Update to requests 2.25+ for security fixes"),
            }

            for pattern, (package, remediation) in vulnerable_patterns.items():
                if re.search(pattern, content):
                    finding = SecurityFinding(
                        scan_type=ScanType.DEPENDENCY,
                        severity=SecuritySeverity.HIGH,
                        title=f"Potentially vulnerable {package} version",
                        description=f"Found {pattern} which may have known security issues",
                        file_path=req_file,
                        remediation=remediation,
                        metadata={"pattern": pattern, "package": package},
                    )
                    findings.append(finding)

        except Exception as e:
            print(f"Error in basic dependency check: {e}")

        return findings

    def _map_cvss_to_severity(self, cvss_score: float) -> SecuritySeverity:
        """Map CVSS score to severity level."""
        if cvss_score >= 9.0:
            return SecuritySeverity.CRITICAL
        elif cvss_score >= 7.0:
            return SecuritySeverity.HIGH
        elif cvss_score >= 4.0:
            return SecuritySeverity.MEDIUM
        else:
            return SecuritySeverity.LOW


class BasicSecretsScanner(SecurityScanner):
    """Basic secrets detection scanner."""

    def __init__(self):
        # Common secret patterns
        self.secret_patterns = {
            "aws_access_key": re.compile(r"AKIA[0-9A-Z]{16}"),
            "aws_secret_key": re.compile(
                r"(?i)aws_secret_access_key\s*[:=]\s*['\"]?[A-Za-z0-9/+=]{40}['\"]?"
            ),
            "generic_api_key": re.compile(
                r"(?i)api[_-]?key\s*[:=]\s*['\"]?[A-Za-z0-9_-]{20,}['\"]?"
            ),
            "jwt_token": re.compile(r"eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+"),
            "private_key": re.compile(r"-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----"),
            "github_token": re.compile(r"ghp_[A-Za-z0-9]{36}"),
            "slack_token": re.compile(r"xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24}"),
        }

    async def scan(self, target_path: Path) -> List[SecurityFinding]:
        """Scan for hardcoded secrets in files."""
        findings = []

        # File extensions to scan
        scan_extensions = {
            ".py",
            ".js",
            ".ts",
            ".json",
            ".yaml",
            ".yml",
            ".env",
            ".config",
            ".ini",
            ".cfg",
        }

        for file_path in target_path.rglob("*"):
            if file_path.is_file() and file_path.suffix.lower() in scan_extensions:
                # Skip common non-sensitive files
                if any(
                    skip in str(file_path)
                    for skip in ["node_modules", ".git", "__pycache__", ".venv"]
                ):
                    continue

                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()

                    for secret_type, pattern in self.secret_patterns.items():
                        for match in pattern.finditer(content):
                            line_number = content[: match.start()].count("\n") + 1

                            severity = (
                                SecuritySeverity.CRITICAL
                                if secret_type in ["private_key", "aws_secret_key"]
                                else SecuritySeverity.HIGH
                            )

                            finding = SecurityFinding(
                                scan_type=ScanType.SECRETS,
                                severity=severity,
                                title=f"Potential {secret_type.replace('_', ' ')} detected",
                                description=f"Found pattern matching {secret_type}",
                                file_path=file_path,
                                line_number=line_number,
                                remediation="Remove hardcoded secrets and use environment variables or secure credential storage",
                                metadata={
                                    "secret_type": secret_type,
                                    "match": match.group()[:20] + "...",
                                },
                            )
                            findings.append(finding)

                except Exception:
                    # Skip files that can't be read
                    continue

        return findings


class BasicComplianceAuditor(ComplianceAuditor):
    """Basic compliance auditor for common standards."""

    async def audit(
        self, target_path: Path, standards: List[ComplianceStandard]
    ) -> List[ComplianceViolation]:
        """Perform compliance audit."""
        violations = []

        for standard in standards:
            if standard == ComplianceStandard.SOC2:
                violations.extend(await self._audit_soc2(target_path))
            elif standard == ComplianceStandard.GDPR:
                violations.extend(await self._audit_gdpr(target_path))
            elif standard == ComplianceStandard.HIPAA:
                violations.extend(await self._audit_hipaa(target_path))

        return violations

    async def _audit_soc2(self, target_path: Path) -> List[ComplianceViolation]:
        """Audit SOC2 compliance requirements."""
        violations = []

        # Check for logging
        has_logging = self._check_file_contains(target_path, "*.py", "logging")
        if not has_logging:
            violations.append(
                ComplianceViolation(
                    standard=ComplianceStandard.SOC2,
                    requirement="CC7.1",
                    description="Logging and monitoring controls should be implemented",
                    severity=SecuritySeverity.MEDIUM,
                    remediation="Implement comprehensive logging throughout the application",
                )
            )

        # Check for access controls
        has_auth = self._check_file_contains(target_path, "*.py", "auth|login|session")
        if not has_auth:
            violations.append(
                ComplianceViolation(
                    standard=ComplianceStandard.SOC2,
                    requirement="CC6.1",
                    description="Access controls should be implemented",
                    severity=SecuritySeverity.HIGH,
                    remediation="Implement proper authentication and authorization mechanisms",
                )
            )

        return violations

    async def _audit_gdpr(self, target_path: Path) -> List[ComplianceViolation]:
        """Audit GDPR compliance requirements."""
        violations = []

        # Check for data processing consent
        has_consent = self._check_file_contains(target_path, "*.py", "consent|gdpr|privacy")
        if not has_consent:
            violations.append(
                ComplianceViolation(
                    standard=ComplianceStandard.GDPR,
                    requirement="Article 7",
                    description="Data processing requires lawful basis and consent",
                    severity=SecuritySeverity.HIGH,
                    remediation="Implement consent management and lawful basis verification",
                )
            )

        # Check for data subject rights
        has_rights = self._check_file_contains(target_path, "*.py", "delete|export|rectify")
        if not has_rights:
            violations.append(
                ComplianceViolation(
                    standard=ComplianceStandard.GDPR,
                    requirement="Articles 15-22",
                    description="Data subject rights should be implemented",
                    severity=SecuritySeverity.MEDIUM,
                    remediation="Implement data subject access, rectification, and deletion rights",
                )
            )

        return violations

    async def _audit_hipaa(self, target_path: Path) -> List[ComplianceViolation]:
        """Audit HIPAA compliance requirements."""
        violations = []

        # Check for encryption
        has_encryption = self._check_file_contains(target_path, "*.py", "encrypt|ssl|tls")
        if not has_encryption:
            violations.append(
                ComplianceViolation(
                    standard=ComplianceStandard.HIPAA,
                    requirement="164.312(e)(1)",
                    description="Data at rest and in transit should be encrypted",
                    severity=SecuritySeverity.HIGH,
                    remediation="Implement encryption for sensitive data storage and transmission",
                )
            )

        # Check for audit logging
        has_audit = self._check_file_contains(target_path, "*.py", "audit|log.*access")
        if not has_audit:
            violations.append(
                ComplianceViolation(
                    standard=ComplianceStandard.HIPAA,
                    requirement="164.312(b)",
                    description="Audit controls should be implemented",
                    severity=SecuritySeverity.MEDIUM,
                    remediation="Implement audit logging for access to protected health information",
                )
            )

        return violations

    def _check_file_contains(self, target_path: Path, pattern: str, search_term: str) -> bool:
        """Check if any file matching pattern contains the search term."""

        for file_path in target_path.rglob(pattern):
            if file_path.is_file():
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        if re.search(search_term, content, re.IGNORECASE):
                            return True
                except Exception:
                    continue
        return False


# SMITHY SECURITY FIX - Fix sast: Potentially dangerous function call
# Applied: 2025-10-26T04:06:22.057074
# Risk Level: medium
# Original Finding: Address security finding: Call to open may be unsafe

# SECURITY FIX: Address sast
# Finding: Call to open may be unsafe
# Severity: medium
# Recommended: Review and implement appropriate security measures

# TODO: Implement security fix for sast
# Consult security best practices and implement proper validation/sanitization

# END SECURITY FIX


# SMITHY SECURITY FIX - Fix sast: Potentially dangerous function call
# Applied: 2025-10-26T04:06:22.057994
# Risk Level: medium
# Original Finding: Address security finding: Call to open may be unsafe

# SECURITY FIX: Address sast
# Finding: Call to open may be unsafe
# Severity: medium
# Recommended: Review and implement appropriate security measures

# TODO: Implement security fix for sast
# Consult security best practices and implement proper validation/sanitization

# END SECURITY FIX


# SMITHY SECURITY FIX - Fix sast: Potentially dangerous function call
# Applied: 2025-10-26T04:06:22.058569
# Risk Level: medium
# Original Finding: Address security finding: Call to open may be unsafe

# SECURITY FIX: Address sast
# Finding: Call to open may be unsafe
# Severity: medium
# Recommended: Review and implement appropriate security measures

# TODO: Implement security fix for sast
# Consult security best practices and implement proper validation/sanitization

# END SECURITY FIX


# SMITHY SECURITY FIX - Fix sast: Potentially dangerous function call
# Applied: 2025-10-26T04:06:22.059367
# Risk Level: medium
# Original Finding: Address security finding: Call to open may be unsafe

# SECURITY FIX: Address sast
# Finding: Call to open may be unsafe
# Severity: medium
# Recommended: Review and implement appropriate security measures

# TODO: Implement security fix for sast
# Consult security best practices and implement proper validation/sanitization

# END SECURITY FIX
