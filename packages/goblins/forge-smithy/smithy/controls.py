"""Advanced controls for Smithy - dependency policies and automated updates."""

import subprocess
import json
import pathlib
import re
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime
import urllib.request
import urllib.error

ROOT = pathlib.Path(__file__).resolve().parents[1]

@dataclass
class DependencyPolicy:
    """Policy rules for dependency management."""
    name: str
    description: str
    rules: Dict[str, Any]
    enabled: bool = True
    severity: str = "warning"  # warning, error, info

@dataclass
class UpdateSchedule:
    """Schedule for automated updates."""
    frequency: str  # daily, weekly, monthly
    time_of_day: str  # HH:MM format
    days_of_week: Optional[List[int]] = None  # 0-6, Monday=0
    environments: List[str] = field(default_factory=lambda: ["dev"])
    auto_merge: bool = False
    notify_on_failure: bool = True

@dataclass
class UpdateResult:
    """Result of an update operation."""
    package: str
    old_version: str
    new_version: str
    success: bool
    changelog: Optional[str] = None
    breaking_changes: bool = False
    security_fixes: bool = False
    errors: List[str] = field(default_factory=list)

@dataclass
class PolicyViolation:
    """Violation of a dependency policy."""
    policy_name: str
    package: str
    violation: str
    severity: str
    suggestion: Optional[str] = None

class PolicyEngine:
    """Engine for enforcing dependency policies."""

    def __init__(self):
        self.root = ROOT
        self.policies_dir = self.root / ".smithy" / "policies"
        self.policies_dir.mkdir(parents=True, exist_ok=True)
        self.policies: Dict[str, DependencyPolicy] = {}

        # Load default policies
        self._load_default_policies()
        # Load custom policies
        self._load_custom_policies()

    def _load_default_policies(self):
        """Load default dependency policies."""
        default_policies = [
            DependencyPolicy(
                name="security_updates",
                description="Require security updates within 30 days",
                rules={
                    "max_age_days": 30,
                    "check_security": True
                }
            ),
            DependencyPolicy(
                name="license_compliance",
                description="Ensure all dependencies have approved licenses",
                rules={
                    "allowed_licenses": ["MIT", "Apache-2.0", "BSD-3-Clause", "ISC"],
                    "blocked_licenses": ["GPL-3.0", "AGPL-3.0"]
                }
            ),
            DependencyPolicy(
                name="version_stability",
                description="Prevent major version updates without approval",
                rules={
                    "allow_major_updates": False,
                    "require_changelog": True
                }
            ),
            DependencyPolicy(
                name="maintenance_status",
                description="Check if packages are actively maintained",
                rules={
                    "max_days_since_update": 365,
                    "min_maintainers": 1
                }
            )
        ]

        for policy in default_policies:
            self.policies[policy.name] = policy

    def _load_custom_policies(self):
        """Load custom policies from files."""
        if not self.policies_dir.exists():
            return

        for policy_file in self.policies_dir.glob("*.json"):
            try:
                policy_data = json.loads(policy_file.read_text())
                policy = DependencyPolicy(
                    name=policy_data["name"],
                    description=policy_data["description"],
                    rules=policy_data["rules"],
                    enabled=policy_data.get("enabled", True),
                    severity=policy_data.get("severity", "medium")
                )
                self.policies[policy.name] = policy
            except (json.JSONDecodeError, KeyError):
                # Skip invalid policy files
                continue

    def add_policy(self, policy: DependencyPolicy) -> bool:
        """Add a custom policy.

        Args:
            policy: Policy to add

        Returns:
            Success status
        """
        self.policies[policy.name] = policy

        # Save to file
        policy_file = self.policies_dir / f"{policy.name}.json"
        policy_data = {
            "name": policy.name,
            "description": policy.description,
            "rules": policy.rules,
            "enabled": policy.enabled,
            "severity": policy.severity
        }
        policy_file.write_text(json.dumps(policy_data, indent=2))

        return True

    def remove_policy(self, name: str) -> bool:
        """Remove a policy.

        Args:
            name: Policy name

        Returns:
            Success status
        """
        if name in self.policies:
            del self.policies[name]

            policy_file = self.policies_dir / f"{name}.json"
            if policy_file.exists():
                policy_file.unlink()

            return True
        return False

    def check_policy_violations(self, package_name: str, package_info: Any) -> List[PolicyViolation]:
        """Check if a package violates any policies.

        Args:
            package_name: Package name
            package_info: Package information

        Returns:
            List of policy violations
        """
        violations = []

        for policy in self.policies.values():
            if not policy.enabled:
                continue

            violation = self._check_single_policy(policy, package_name, package_info)
            if violation:
                violations.append(violation)

        return violations

    def _check_single_policy(self, policy: DependencyPolicy, package_name: str, package_info: Any) -> Optional[PolicyViolation]:
        """Check a single policy against package info.

        Args:
            policy: Policy to check
            package_name: Package name
            package_info: Package information

        Returns:
            Policy violation if any
        """
        if policy.name == "security_updates":
            # Check if package has security updates
            if hasattr(package_info, 'has_security_issues') and package_info.has_security_issues:
                return PolicyViolation(
                    policy_name=policy.name,
                    package=package_name,
                    violation="Package has security vulnerabilities",
                    severity=policy.severity,
                    suggestion="Update to latest secure version"
                )

        elif policy.name == "license_compliance":
            # Check license compliance
            if hasattr(package_info, 'license') and package_info.license:
                blocked_licenses = policy.rules.get("blocked_licenses", [])
                if package_info.license in blocked_licenses:
                    return PolicyViolation(
                        policy_name=policy.name,
                        package=package_name,
                        violation=f"License '{package_info.license}' is not allowed",
                        severity=policy.severity,
                        suggestion="Replace with package using approved license"
                    )

        elif policy.name == "version_stability":
            # Check for major version changes
            if hasattr(package_info, 'version') and hasattr(package_info, 'latest_version'):
                if package_info.version and package_info.latest_version:
                    current_major = package_info.version.split('.')[0]
                    latest_major = package_info.latest_version.split('.')[0]
                    if current_major != latest_major and not policy.rules.get("allow_major_updates", True):
                        return PolicyViolation(
                            policy_name=policy.name,
                            package=package_name,
                            violation=f"Major version update available: {package_info.version} -> {package_info.latest_version}",
                            severity=policy.severity,
                            suggestion="Review breaking changes before updating"
                        )

        elif policy.name == "maintenance_status":
            # Check maintenance status
            if hasattr(package_info, 'last_updated') and package_info.last_updated:
                try:
                    last_update = datetime.fromisoformat(package_info.last_updated.replace('Z', '+00:00'))
                    days_since_update = (datetime.now(last_update.tzinfo) - last_update).days
                    max_days = policy.rules.get("max_days_since_update", 365)

                    if days_since_update > max_days:
                        return PolicyViolation(
                            policy_name=policy.name,
                            package=package_name,
                            violation=f"Package not updated for {days_since_update} days",
                            severity=policy.severity,
                            suggestion="Consider alternative actively maintained package"
                        )
                except (ValueError, TypeError):
                    pass

        return None

class UpdateManager:
    """Manager for automated dependency updates."""

    def __init__(self):
        self.root = ROOT
        self.updates_dir = self.root / ".smithy" / "updates"
        self.updates_dir.mkdir(parents=True, exist_ok=True)
        self.policy_engine = PolicyEngine()

    def create_update_schedule(self, schedule: UpdateSchedule) -> bool:
        """Create an automated update schedule.

        Args:
            schedule: Update schedule configuration

        Returns:
            Success status
        """
        schedule_file = self.updates_dir / "schedule.json"

        schedule_data = {
            "frequency": schedule.frequency,
            "time_of_day": schedule.time_of_day,
            "days_of_week": schedule.days_of_week,
            "environments": schedule.environments,
            "auto_merge": schedule.auto_merge,
            "notify_on_failure": schedule.notify_on_failure,
            "created_at": datetime.now().isoformat()
        }

        schedule_file.write_text(json.dumps(schedule_data, indent=2))
        return True

    def check_for_updates(self, environments: Optional[List[str]] = None) -> Dict[str, List[UpdateResult]]:
        """Check for available updates across environments.

        Args:
            environments: Environments to check (all if None)

        Returns:
            Updates available by environment
        """
        if environments is None:
            environments = ["dev", "staging", "prod"]

        updates = {}

        for env in environments:
            env_updates = self._check_environment_updates(env)
            if env_updates:
                updates[env] = env_updates

        return updates

    def _check_environment_updates(self, environment: str) -> List[UpdateResult]:
        """Check for updates in a specific environment.

        Args:
            environment: Environment name

        Returns:
            List of available updates
        """
        updates = []

        try:
            # Get installed packages
            result = subprocess.run(
                ["uv", "pip", "list", "--format", "json"],
                capture_output=True,
                text=True,
                cwd=self.root,
                check=True
            )

            if result.stdout.strip():
                packages_data = json.loads(result.stdout)

                for pkg_data in packages_data:
                    package_name = pkg_data["name"]
                    current_version = pkg_data["version"]

                    # Check for updates on PyPI
                    try:
                        url = f"https://pypi.org/pypi/{package_name}/json"
                        with urllib.request.urlopen(url, timeout=10) as response:
                            pypi_data = json.loads(response.read().decode())
                            latest_version = pypi_data["info"]["version"]

                            if self._is_newer_version(current_version, latest_version):
                                # Check policies
                                from .packages import PackageInfo
                                pkg_info = PackageInfo(
                                    name=package_name,
                                    version=current_version,
                                    latest_version=latest_version
                                )

                                violations = self.policy_engine.check_policy_violations(package_name, pkg_info)
                                breaking_changes = any(v.violation.startswith("Major version") for v in violations)

                                update = UpdateResult(
                                    package=package_name,
                                    old_version=current_version,
                                    new_version=latest_version,
                                    success=True,
                                    breaking_changes=breaking_changes
                                )
                                updates.append(update)

                    except (urllib.error.URLError, json.JSONDecodeError, KeyError):
                        continue

        except subprocess.CalledProcessError:
            pass

        return updates

    def _is_newer_version(self, current: str, latest: str) -> bool:
        """Check if latest version is newer than current.

        Args:
            current: Current version
            latest: Latest version

        Returns:
            True if latest is newer
        """
        def parse_version(v: str) -> Tuple[int, ...]:
            # Simple version parsing - in production use packaging.version
            parts = re.findall(r'\d+', v)
            return tuple(int(p) for p in parts[:3])  # major.minor.patch

        try:
            current_parts = parse_version(current)
            latest_parts = parse_version(latest)
            return latest_parts > current_parts
        except (ValueError, IndexError):
            return False

    def apply_updates(self, updates: List[UpdateResult],
                     dry_run: bool = True) -> Tuple[bool, List[str]]:
        """Apply package updates.

        Args:
            updates: Updates to apply
            dry_run: Whether to perform dry run

        Returns:
            Tuple of (success, messages)
        """
        messages = []
        success = True

        for update in updates:
            try:
                if dry_run:
                    messages.append(f"Would update {update.package}: {update.old_version} -> {update.new_version}")
                    continue

                # Apply update
                cmd = ["uv", "pip", "install", "--upgrade", f"{update.package}=={update.new_version}"]
                result = subprocess.run(cmd, cwd=self.root, capture_output=True, text=True)

                if result.returncode == 0:
                    messages.append(f"Updated {update.package}: {update.old_version} -> {update.new_version}")
                else:
                    messages.append(f"Failed to update {update.package}: {result.stderr}")
                    success = False

            except subprocess.CalledProcessError as e:
                messages.append(f"Error updating {update.package}: {str(e)}")
                success = False

        return success, messages

    def create_update_pr(self, updates: List[UpdateResult],
                        branch_name: str = "deps/update-packages") -> Tuple[bool, str]:
        """Create a pull request for dependency updates.

        Args:
            updates: Updates to include in PR
            branch_name: Branch name for the PR

        Returns:
            Tuple of (success, PR URL or error message)
        """
        try:
            # Create branch
            subprocess.run(["git", "checkout", "-b", branch_name], cwd=self.root, check=True)

            # Apply updates
            success, messages = self.apply_updates(updates, dry_run=False)
            if not success:
                return False, "Failed to apply updates"

            # Commit changes
            subprocess.run(["git", "add", "."], cwd=self.root, check=True)

            commit_message = "deps: update packages\\n\\n"
            for update in updates:
                commit_message += f"- {update.package}: {update.old_version} -> {update.new_version}\\n"

            subprocess.run(["git", "commit", "-m", commit_message], cwd=self.root, check=True)

            # Push branch
            subprocess.run(["git", "push", "origin", branch_name], cwd=self.root, check=True)

            # Create PR (would integrate with GitHub API in production)
            return True, f"Created PR branch: {branch_name}"

        except subprocess.CalledProcessError as e:
            return False, f"Failed to create PR: {str(e)}"

class ComplianceManager:
    """Manager for dependency compliance and governance."""

    def __init__(self):
        self.root = ROOT
        self.compliance_dir = self.root / ".smithy" / "compliance"
        self.compliance_dir.mkdir(parents=True, exist_ok=True)
        self.policy_engine = PolicyEngine()

    def audit_compliance(self) -> Tuple[bool, List[PolicyViolation]]:
        """Audit dependency compliance against policies.

        Returns:
            Tuple of (compliant, violations)
        """
        violations = []

        try:
            # Get all installed packages
            result = subprocess.run(
                ["uv", "pip", "list", "--format", "json"],
                capture_output=True,
                text=True,
                cwd=self.root,
                check=True
            )

            if result.stdout.strip():
                packages_data = json.loads(result.stdout)

                for pkg_data in packages_data:
                    package_name = pkg_data["name"]

                    # Get package info
                    from .packages import PackageManager
                    pkg_manager = PackageManager()
                    pkg_info = pkg_manager.get_package_info(package_name)

                    if pkg_info:
                        try:
                            pkg_violations = self.policy_engine.check_policy_violations(package_name, pkg_info)
                            violations.extend(pkg_violations)
                        except Exception:
                            # Skip packages that cause errors
                            continue

        except subprocess.CalledProcessError:
            pass

        compliant = len(violations) == 0
        return compliant, violations

    def generate_compliance_report(self) -> str:
        """Generate a compliance report.

        Returns:
            Compliance report as markdown
        """
        compliant, violations = self.audit_compliance()

        report = f"""# Dependency Compliance Report

Generated: {datetime.now().isoformat()}

## Overall Status: {'✅ Compliant' if compliant else '❌ Non-Compliant'}

## Policy Violations

"""

        if violations:
            for violation in violations:
                report += f"""### {violation.policy_name} - {violation.package}
**Severity:** {violation.severity}
**Issue:** {violation.violation}
**Suggestion:** {violation.suggestion or 'N/A'}

"""
        else:
            report += "No policy violations found.\\n\\n"

        report += """## Active Policies

"""
        for policy_name, policy in self.policy_engine.policies.items():
            status = "✅ Enabled" if policy.enabled else "❌ Disabled"
            report += f"- **{policy_name}**: {policy.description} ({status})\\n"

        return report

    def export_compliance_data(self, output_file: pathlib.Path) -> bool:
        """Export compliance data to file.

        Args:
            output_file: Output file path

        Returns:
            Success status
        """
        compliant, violations = self.audit_compliance()

        data = {
            "timestamp": datetime.now().isoformat(),
            "compliant": compliant,
            "violations": [
                {
                    "policy_name": v.policy_name,
                    "package": v.package,
                    "violation": v.violation,
                    "severity": v.severity,
                    "suggestion": v.suggestion
                }
                for v in violations
            ],
            "policies": [
                {
                    "name": p.name,
                    "description": p.description,
                    "enabled": p.enabled,
                    "severity": p.severity
                }
                for p in self.policy_engine.policies.values()
            ]
        }

        try:
            output_file.write_text(json.dumps(data, indent=2))
            return True
        except Exception:
            return False

def create_dependency_policy(name: str, description: str, rules: Dict[str, Any]) -> bool:
    """Convenience function to create a dependency policy.

    Args:
        name: Policy name
        description: Policy description
        rules: Policy rules

    Returns:
        Success status
    """
    policy = DependencyPolicy(name=name, description=description, rules=rules)
    engine = PolicyEngine()
    return engine.add_policy(policy)

def check_compliance() -> Tuple[bool, List[PolicyViolation]]:
    """Convenience function to check compliance.

    Returns:
        Tuple of (compliant, violations)
    """
    manager = ComplianceManager()
    return manager.audit_compliance()

def schedule_updates(frequency: str = "weekly", time_of_day: str = "02:00") -> bool:
    """Convenience function to schedule updates.

    Args:
        frequency: Update frequency
        time_of_day: Time to run updates

    Returns:
        Success status
    """
    schedule = UpdateSchedule(
        frequency=frequency,
        time_of_day=time_of_day,
        environments=["dev", "staging"]
    )
    manager = UpdateManager()
    return manager.create_update_schedule(schedule)
