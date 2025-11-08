"""Package management operations for Smithy."""

import subprocess
import json
import pathlib
import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import urllib.request
import urllib.error

ROOT = pathlib.Path(__file__).resolve().parents[1]

@dataclass
class PackageInfo:
    """Information about a package."""
    name: str
    version: str
    latest_version: Optional[str] = None
    description: Optional[str] = None
    homepage: Optional[str] = None
    license: Optional[str] = None
    dependencies: Optional[List[str]] = None
    size: Optional[int] = None
    last_updated: Optional[str] = None

    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []

@dataclass
class PackageHealth:
    """Health metrics for a package."""
    name: str
    version: str
    has_security_issues: bool
    security_score: Optional[float]
    maintenance_score: Optional[float]
    popularity_score: Optional[float]
    overall_score: Optional[float]
    issues: List[str]

@dataclass
class BulkOperation:
    """Result of a bulk package operation."""
    operation: str
    packages: List[str]
    successful: List[str]
    failed: Dict[str, str]  # package -> error message
    skipped: List[str]

class PackageManager:
    """Advanced package management operations."""

    def __init__(self):
        self.root = ROOT
        self.cache_dir = self.root / ".smithy" / "cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def get_installed_packages(self) -> List[PackageInfo]:
        """Get list of currently installed packages.

        Returns:
            List of installed package information
        """
        try:
            result = subprocess.run(
                ["uv", "pip", "list", "--format", "json"],
                capture_output=True,
                text=True,
                cwd=self.root,
                check=True
            )

            packages = []
            if result.stdout.strip():
                packages_data = json.loads(result.stdout)
                for pkg in packages_data:
                    packages.append(PackageInfo(
                        name=pkg["name"],
                        version=pkg["version"]
                    ))

            return packages

        except (subprocess.CalledProcessError, json.JSONDecodeError):
            return []

    def get_package_info(self, package_name: str) -> Optional[PackageInfo]:
        """Get detailed information about a package.

        Args:
            package_name: Name of the package

        Returns:
            Package information or None if not found
        """
        try:
            # Get package info from PyPI
            url = f"https://pypi.org/pypi/{package_name}/json"
            with urllib.request.urlopen(url) as response:
                data = json.loads(response.read().decode())

            info = data.get("info")
            if not info:
                return None

            latest_version = info.get("version")
            if not latest_version:
                return None

            # Get current installed version
            installed_packages = self.get_installed_packages()
            current_version = None
            for pkg in installed_packages:
                if pkg.name.lower() == package_name.lower():
                    current_version = pkg.version
                    break

            return PackageInfo(
                name=package_name,
                version=current_version or latest_version,
                latest_version=latest_version,
                description=info.get("description"),
                homepage=info.get("home_page") or (info.get("project_urls") or {}).get("Homepage"),
                license=info.get("license"),
                dependencies=list((info.get("requires_dist") or [])),
                last_updated=info.get("last_serial")
            )

        except (urllib.error.URLError, json.JSONDecodeError, KeyError):
            return None

    def check_package_health(self, package_name: str) -> Optional[PackageHealth]:
        """Check health metrics for a package.

        Args:
            package_name: Name of the package

        Returns:
            Package health information or None if unavailable
        """
        try:
            # This is a simplified health check - in production you'd use
            # services like Snyk, Libraries.io, or GitHub's dependency graph

            issues = []

            # Check if package is installed
            installed = self.get_installed_packages()
            installed_names = {pkg.name.lower() for pkg in installed}
            if package_name.lower() not in installed_names:
                issues.append("Package not installed")
                return PackageHealth(
                    name=package_name,
                    version="unknown",
                    has_security_issues=False,
                    security_score=None,
                    maintenance_score=None,
                    popularity_score=None,
                    overall_score=None,
                    issues=issues
                )

            # Get package info
            info = self.get_package_info(package_name)
            if not info:
                issues.append("Could not fetch package information")
                return PackageHealth(
                    name=package_name,
                    version="unknown",
                    has_security_issues=False,
                    security_score=None,
                    maintenance_score=None,
                    popularity_score=None,
                    overall_score=None,
                    issues=issues
                )

            # Basic health checks
            has_security_issues = False
            security_score = 8.0  # Placeholder - would use real security data
            maintenance_score = 7.0  # Placeholder - based on update frequency
            popularity_score = 6.0  # Placeholder - based on download count

            # Check for outdated packages
            if info.version and info.latest_version:
                if info.version != info.latest_version:
                    issues.append(f"Outdated: {info.version} -> {info.latest_version}")
                    maintenance_score -= 1.0

            # Check license
            if not info.license or info.license.lower() in ["unknown", ""]:
                issues.append("License not specified")
                security_score -= 1.0

            # Calculate overall score
            overall_score = (security_score + maintenance_score + popularity_score) / 3

            return PackageHealth(
                name=package_name,
                version=info.version,
                has_security_issues=has_security_issues,
                security_score=security_score,
                maintenance_score=maintenance_score,
                popularity_score=popularity_score,
                overall_score=round(overall_score, 1),
                issues=issues
            )

        except Exception:
            return None

    def bulk_install(self, packages: List[str], upgrade: bool = False) -> BulkOperation:
        """Install multiple packages at once.

        Args:
            packages: List of package names (with optional version specs)
            upgrade: Whether to upgrade existing packages

        Returns:
            Bulk operation result
        """
        successful = []
        failed = {}
        skipped = []

        for package in packages:
            try:
                cmd = ["uv", "pip", "install"]
                if upgrade:
                    cmd.append("--upgrade")
                cmd.append(package)

                subprocess.run(cmd, check=True, cwd=self.root, capture_output=True)
                successful.append(package)

            except subprocess.CalledProcessError as e:
                failed[package] = str(e)

        return BulkOperation(
            operation="install",
            packages=packages,
            successful=successful,
            failed=failed,
            skipped=skipped
        )

    def bulk_uninstall(self, packages: List[str]) -> BulkOperation:
        """Uninstall multiple packages at once.

        Args:
            packages: List of package names

        Returns:
            Bulk operation result
        """
        successful = []
        failed = {}
        skipped = []

        for package in packages:
            try:
                subprocess.run(
                    ["uv", "pip", "uninstall", "-y", package],
                    check=True,
                    cwd=self.root,
                    capture_output=True
                )
                successful.append(package)

            except subprocess.CalledProcessError as e:
                failed[package] = str(e)

        return BulkOperation(
            operation="uninstall",
            packages=packages,
            successful=successful,
            failed=failed,
            skipped=skipped
        )

    def bulk_upgrade(self, packages: Optional[List[str]] = None) -> BulkOperation:
        """Upgrade multiple packages at once.

        Args:
            packages: List of package names to upgrade (all if None)

        Returns:
            Bulk operation result
        """
        if packages is None:
            # Get all installed packages
            installed = self.get_installed_packages()
            packages = [pkg.name for pkg in installed]

        successful = []
        failed = {}
        skipped = []

        for package in packages:
            try:
                subprocess.run(
                    ["uv", "pip", "install", "--upgrade", package],
                    check=True,
                    cwd=self.root,
                    capture_output=True
                )
                successful.append(package)

            except subprocess.CalledProcessError as e:
                failed[package] = str(e)

        return BulkOperation(
            operation="upgrade",
            packages=packages,
            successful=successful,
            failed=failed,
            skipped=skipped
        )

    def find_unused_packages(self) -> List[str]:
        """Find potentially unused packages.

        Returns:
            List of potentially unused package names
        """
        try:
            # This is a simplified approach - in production you'd use
            # tools like pip-autoremove or deptry

            # Get all installed packages
            installed = self.get_installed_packages()
            installed_names = {pkg.name for pkg in installed}

            # Get packages declared in requirements files
            declared_packages = set()

            # Check requirements.txt
            req_file = self.root / "requirements.txt"
            if req_file.exists():
                for line in req_file.read_text().split('\n'):
                    line = line.strip()
                    if line and not line.startswith('#'):
                        # Extract package name (handle version specs)
                        pkg_name = re.split(r'[>=<~!]', line)[0].strip()
                        declared_packages.add(pkg_name)

            # Check pyproject.toml
            pyproject_file = self.root / "pyproject.toml"
            if pyproject_file.exists():
                try:
                    import tomllib
                    data = tomllib.loads(pyproject_file.read_text())
                    deps = data.get("project", {}).get("dependencies", [])
                    for dep in deps:
                        pkg_name = re.split(r'[>=<~!]', dep)[0].strip()
                        declared_packages.add(pkg_name)
                except ImportError:
                    pass  # tomllib not available in older Python

            # Find potentially unused packages
            unused = []
            for pkg_name in installed_names:
                if pkg_name.lower() not in {p.lower() for p in declared_packages}:
                    # Additional check: see if it's a dependency of another package
                    # This is simplified - real implementation would check dependency tree
                    unused.append(pkg_name)

            return unused

        except Exception:
            return []

    def cleanup_packages(self) -> Tuple[int, List[str]]:
        """Clean up unused packages and cache.

        Returns:
            Tuple of (packages_removed, cleanup_messages)
        """
        messages = []

        try:
            # Clean pip cache
            result = subprocess.run(
                ["uv", "cache", "clean"],
                capture_output=True,
                text=True,
                cwd=self.root
            )
            if result.returncode == 0:
                messages.append("Cleaned uv cache")
            else:
                messages.append("Failed to clean uv cache")

        except subprocess.CalledProcessError:
            messages.append("Failed to clean uv cache")

        # Find and remove unused packages (conservative approach)
        unused = self.find_unused_packages()
        if unused:
            messages.append(f"Found {len(unused)} potentially unused packages: {', '.join(unused[:5])}{'...' if len(unused) > 5 else ''}")
            # Note: We don't automatically remove them for safety
        else:
            messages.append("No unused packages found")

        return len(unused), messages

    def export_requirements(self, output_file: pathlib.Path,
                          include_versions: bool = True) -> bool:
        """Export current environment to requirements file.

        Args:
            output_file: Output file path
            include_versions: Whether to include version pins

        Returns:
            Success status
        """
        try:
            installed = self.get_installed_packages()

            requirements = []
            for pkg in installed:
                if include_versions:
                    requirements.append(f"{pkg.name}=={pkg.version}")
                else:
                    requirements.append(pkg.name)

            output_file.write_text('\n'.join(requirements))
            return True

        except Exception:
            return False

def install_packages(packages: List[str], upgrade: bool = False) -> BulkOperation:
    """Convenience function to install packages.

    Args:
        packages: List of package names
        upgrade: Whether to upgrade existing packages

    Returns:
        Bulk operation result
    """
    manager = PackageManager()
    return manager.bulk_install(packages, upgrade)

def uninstall_packages(packages: List[str]) -> BulkOperation:
    """Convenience function to uninstall packages.

    Args:
        packages: List of package names

    Returns:
        Bulk operation result
    """
    manager = PackageManager()
    return manager.bulk_uninstall(packages)

def upgrade_packages(packages: Optional[List[str]] = None) -> BulkOperation:
    """Convenience function to upgrade packages.

    Args:
        packages: List of package names to upgrade (all if None)

    Returns:
        Bulk operation result
    """
    manager = PackageManager()
    return manager.bulk_upgrade(packages)

def get_package_health(package_name: str) -> Optional[PackageHealth]:
    """Convenience function to check package health.

    Args:
        package_name: Name of the package

    Returns:
        Package health information
    """
    manager = PackageManager()
    return manager.check_package_health(package_name)

def cleanup_environment() -> Tuple[int, List[str]]:
    """Convenience function to clean up the environment.

    Returns:
        Tuple of (packages_removed, cleanup_messages)
    """
    manager = PackageManager()
    return manager.cleanup_packages()
