"""Advanced dependency analysis and management for Smithy."""

import subprocess
import json
import pathlib
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from datetime import datetime
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]

@dataclass
class SecurityVulnerability:
    """Represents a security vulnerability in a dependency."""
    package: str
    version: str
    vulnerability_id: str
    severity: str
    description: str
    url: Optional[str] = None

@dataclass
class LicenseInfo:
    """Represents license information for a package."""
    package: str
    license: Optional[str]
    compliant: bool
    issues: List[str]

@dataclass
class OutdatedPackage:
    """Represents an outdated package."""
    package: str
    current_version: str
    latest_version: str
    latest_file_date: Optional[str] = None

@dataclass
class DependencyConflict:
    """Represents a dependency conflict."""
    package: str
    required_by: List[str]
    conflicting_versions: List[str]

class DependencyAnalyzer:
    """Advanced dependency analysis and management."""

    def __init__(self):
        self.root = ROOT

    def scan_security(self) -> Tuple[bool, List[SecurityVulnerability]]:
        """Scan dependencies for security vulnerabilities.

        Returns:
            Tuple of (success, vulnerabilities list)
        """
        vulnerabilities = []

        try:
            # Use pip-audit for security scanning
            result = subprocess.run(
                ["pip-audit", "--format", "json"],
                capture_output=True,
                text=True,
                cwd=self.root,
                timeout=120
            )

            if result.returncode == 0:
                # Parse JSON output
                if result.stdout.strip():
                    audit_data = json.loads(result.stdout)
                    for vuln in audit_data.get("vulnerabilities", []):
                        vulnerabilities.append(SecurityVulnerability(
                            package=vuln.get("name", ""),
                            version=vuln.get("version", ""),
                            vulnerability_id=vuln.get("id", ""),
                            severity=vuln.get("severity", "unknown"),
                            description=vuln.get("description", ""),
                            url=vuln.get("url")
                        ))
                return True, vulnerabilities
            else:
                # Fallback: try safety
                result = subprocess.run(
                    ["safety", "check", "--json"],
                    capture_output=True,
                    text=True,
                    cwd=self.root,
                    timeout=120
                )

                if result.returncode == 0 and result.stdout.strip():
                    safety_data = json.loads(result.stdout)
                    for issue in safety_data.get("issues", []):
                        vulnerabilities.append(SecurityVulnerability(
                            package=issue.get("package", ""),
                            version=issue.get("version", ""),
                            vulnerability_id=issue.get("vulnerability_id", ""),
                            severity=issue.get("severity", "unknown"),
                            description=issue.get("description", ""),
                            url=issue.get("url")
                        ))
                    return True, vulnerabilities

        except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
            pass

        return False, vulnerabilities

    def check_licenses(self, allowed_licenses: Optional[List[str]] = None) -> Tuple[bool, List[LicenseInfo]]:
        """Check license compliance for all dependencies.

        Args:
            allowed_licenses: List of allowed license types

        Returns:
            Tuple of (success, license info list)
        """
        if allowed_licenses is None:
            allowed_licenses = ["MIT", "Apache-2.0", "BSD-3-Clause", "BSD-2-Clause", "ISC", "GPL-3.0-only"]

        license_info = []

        try:
            # Use pip-licenses for license checking
            result = subprocess.run(
                ["pip-licenses", "--format", "json"],
                capture_output=True,
                text=True,
                cwd=self.root,
                timeout=60
            )

            if result.returncode == 0 and result.stdout.strip():
                licenses_data = json.loads(result.stdout)
                for pkg in licenses_data:
                    package_name = pkg.get("Name", "")
                    package_license = pkg.get("License", "")

                    # Check compliance
                    compliant = True
                    issues = []

                    if not package_license:
                        compliant = False
                        issues.append("No license specified")
                    elif package_license not in allowed_licenses:
                        # Check for common variations
                        license_lower = package_license.lower()
                        allowed_lower = [lic.lower() for lic in allowed_licenses]

                        if license_lower not in allowed_lower:
                            compliant = False
                            issues.append(f"License '{package_license}' not in allowed list")

                    license_info.append(LicenseInfo(
                        package=package_name,
                        license=package_license,
                        compliant=compliant,
                        issues=issues
                    ))

                return True, license_info

        except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
            pass

        return False, license_info

    def check_outdated(self) -> Tuple[bool, List[OutdatedPackage]]:
        """Check for outdated packages.

        Returns:
            Tuple of (success, outdated packages list)
        """
        outdated_packages = []

        try:
            # Use pip list --outdated
            result = subprocess.run(
                ["uv", "pip", "list", "--format", "json"],
                capture_output=True,
                text=True,
                cwd=self.root,
                timeout=60
            )

            if result.returncode == 0 and result.stdout.strip():
                packages_data = json.loads(result.stdout)

                # Get latest versions using pip index
                for pkg in packages_data:
                    package_name = pkg.get("name", "")
                    current_version = pkg.get("version", "")

                    # Get latest version info
                    try:
                        latest_result = subprocess.run(
                            ["uv", "pip", "show", package_name],
                            capture_output=True,
                            text=True,
                            cwd=self.root,
                            timeout=30
                        )

                        if latest_result.returncode == 0:
                            # Parse version from output
                            for line in latest_result.stdout.split('\n'):
                                if line.startswith('Latest:'):
                                    latest_version = line.split(':', 1)[1].strip()
                                    if latest_version != current_version:
                                        outdated_packages.append(OutdatedPackage(
                                            package=package_name,
                                            current_version=current_version,
                                            latest_version=latest_version
                                        ))
                                    break

                    except subprocess.TimeoutExpired:
                        continue

                return True, outdated_packages

        except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
            pass

        return False, outdated_packages

    def detect_conflicts(self) -> Tuple[bool, List[DependencyConflict]]:
        """Detect dependency conflicts.

        Returns:
            Tuple of (success, conflicts list)
        """
        conflicts = []

        try:
            # Use uv pip check for conflicts
            result = subprocess.run(
                ["uv", "pip", "check"],
                capture_output=True,
                text=True,
                cwd=self.root,
                timeout=60
            )

            if result.returncode != 0:
                # Parse conflict information from stderr
                conflict_lines = result.stderr.split('\n')
                current_conflict = None

                for line in conflict_lines:
                    if "conflicts with" in line.lower():
                        # Extract package information
                        match = re.search(r'(\S+)\s+conflicts with', line, re.IGNORECASE)
                        if match:
                            package = match.group(1)
                            current_conflict = DependencyConflict(
                                package=package,
                                required_by=[],
                                conflicting_versions=[]
                            )
                            conflicts.append(current_conflict)
                    elif current_conflict and ("required by" in line.lower() or "version" in line.lower()):
                        # Add requirement info
                        current_conflict.required_by.append(line.strip())

                return True, conflicts

        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

        return False, conflicts

    def analyze_dependencies(self, include_security: bool = True,
                           include_licenses: bool = True,
                           include_outdated: bool = True,
                           include_conflicts: bool = True) -> Dict[str, Any]:
        """Comprehensive dependency analysis.

        Args:
            include_security: Include security scanning
            include_licenses: Include license checking
            include_outdated: Include outdated package checking
            include_conflicts: Include conflict detection

        Returns:
            Analysis results dictionary
        """
        results = {
            "timestamp": datetime.now().isoformat(),
            "security": {"success": False, "vulnerabilities": []},
            "licenses": {"success": False, "packages": []},
            "outdated": {"success": False, "packages": []},
            "conflicts": {"success": False, "conflicts": []},
            "summary": {}
        }

        # Security scanning
        if include_security:
            success, vulnerabilities = self.scan_security()
            results["security"] = {
                "success": success,
                "vulnerabilities": [vars(v) for v in vulnerabilities]
            }

        # License checking
        if include_licenses:
            success, license_info = self.check_licenses()
            results["licenses"] = {
                "success": success,
                "packages": [vars(lic) for lic in license_info]
            }

        # Outdated packages
        if include_outdated:
            success, outdated = self.check_outdated()
            results["outdated"] = {
                "success": success,
                "packages": [vars(o) for o in outdated]
            }

        # Conflict detection
        if include_conflicts:
            success, conflicts = self.detect_conflicts()
            results["conflicts"] = {
                "success": success,
                "conflicts": [vars(c) for c in conflicts]
            }

        # Generate summary
        results["summary"] = self._generate_summary(results)

        return results

    def _generate_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate analysis summary."""
        summary = {
            "total_vulnerabilities": len(results["security"]["vulnerabilities"]),
            "critical_vulnerabilities": 0,
            "high_vulnerabilities": 0,
            "license_compliant_packages": 0,
            "license_non_compliant_packages": 0,
            "outdated_packages": len(results["outdated"]["packages"]),
            "conflicts_found": len(results["conflicts"]["conflicts"]),
            "overall_health": "unknown"
        }

        # Count vulnerability severities
        for vuln in results["security"]["vulnerabilities"]:
            severity = vuln.get("severity", "").lower()
            if severity == "critical":
                summary["critical_vulnerabilities"] += 1
            elif severity == "high":
                summary["high_vulnerabilities"] += 1

        # Count license compliance
        for license_info in results["licenses"]["packages"]:
            if license_info.get("compliant", False):
                summary["license_compliant_packages"] += 1
            else:
                summary["license_non_compliant_packages"] += 1

        # Determine overall health
        if (summary["critical_vulnerabilities"] > 0 or
            summary["license_non_compliant_packages"] > 0 or
            summary["conflicts_found"] > 0):
            summary["overall_health"] = "critical"
        elif (summary["high_vulnerabilities"] > 0 or
              summary["outdated_packages"] > 5):
            summary["overall_health"] = "warning"
        else:
            summary["overall_health"] = "healthy"

        return summary

def analyze_dependencies(include_security: bool = True,
                        include_licenses: bool = True,
                        include_outdated: bool = True,
                        include_conflicts: bool = True) -> Dict[str, Any]:
    """Convenience function for dependency analysis.

    Args:
        include_security: Include security scanning
        include_licenses: Include license checking
        include_outdated: Include outdated package checking
        include_conflicts: Include conflict detection

    Returns:
        Analysis results dictionary
    """
    analyzer = DependencyAnalyzer()
    return analyzer.analyze_dependencies(
        include_security=include_security,
        include_licenses=include_licenses,
        include_outdated=include_outdated,
        include_conflicts=include_conflicts
    )
