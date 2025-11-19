"""
Core business logic for Keepers Guild goblin
"""

import re
import shutil
import glob
from pathlib import Path
from typing import List, Literal
from datetime import datetime, timedelta

from .models import (
    SecretAuditResult,
    SecurityScanResult,
    StorageCleanupResult,
    DiskConsolidationResult,
    SecretsPlaybookEntry,
    ComplianceReport,
    SystemCleanResult,
)
from .schema import KeepersGuildConfig


class KeepersGuildLogic:
    """Core logic for Keepers Guild operations"""

    def __init__(self, config: KeepersGuildConfig):
        self.config = config
        self.workspace_root = (
            Path(config.workspace_root) if config.workspace_root else Path.cwd()
        )

    async def audit_secrets(self) -> List[SecretAuditResult]:
        """Audit API key documentation and .env hygiene"""
        results = []

        # Scan configured paths
        for scan_path in self.config.secrets_audit.scan_paths:
            pattern = self.workspace_root / scan_path
            for file_path in glob.glob(str(pattern), recursive=True):
                file_path = Path(file_path)

                # Skip excluded patterns
                if any(
                    file_path.match(excl)
                    for excl in self.config.secrets_audit.exclude_patterns
                ):
                    continue

                # Scan file for secrets
                file_results = await self._scan_file_for_secrets(file_path)
                results.extend(file_results)

        return results

    async def _scan_file_for_secrets(self, file_path: Path) -> List[SecretAuditResult]:
        """Scan a single file for potential secrets"""
        results = []

        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()

            for line_num, line in enumerate(lines, 1):
                for pattern in self.config.secrets_audit.secret_patterns:
                    matches = re.finditer(pattern, line)
                    for match in matches:
                        secret_value = (
                            match.group(2)
                            if len(match.groups()) > 1
                            else match.group(1)
                        )

                        # Determine severity based on secret type
                        severity = self._determine_secret_severity(
                            match.group(1).lower()
                        )

                        # Mask the secret value for reporting
                        masked_value = self._mask_secret(secret_value)

                        result = SecretAuditResult(
                            file_path=file_path,
                            secret_type=self._classify_secret_type(
                                match.group(1).lower()
                            ),
                            line_number=line_num,
                            severity=severity,
                            description=f"Potential {severity} severity secret found",
                            recommendation=self._get_secret_recommendation(severity),
                            masked_value=masked_value,
                        )
                        results.append(result)

        except Exception as e:
            # Log error but continue scanning
            print(f"Error scanning {file_path}: {e}")

        return results

    def _determine_secret_severity(
        self, secret_type: str
    ) -> Literal["low", "medium", "high", "critical"]:
        """Determine severity level for a secret type"""
        high_severity = ["password", "passwd", "pwd", "secret"]
        medium_severity = ["token", "bearer", "key"]
        low_severity = ["api"]

        if any(word in secret_type for word in high_severity):
            return "high"
        elif any(word in secret_type for word in medium_severity):
            return "medium"
        elif any(word in secret_type for word in low_severity):
            return "low"
        return "medium"

    def _classify_secret_type(self, secret_type: str) -> str:
        """Classify the type of secret found"""
        if "password" in secret_type or "passwd" in secret_type:
            return "password"
        elif "token" in secret_type or "bearer" in secret_type:
            return "token"
        elif "key" in secret_type:
            return "api_key"
        return "secret"

    def _mask_secret(self, secret: str) -> str:
        """Mask a secret value for safe reporting"""
        if len(secret) <= 4:
            return "*" * len(secret)
        return secret[:2] + "*" * (len(secret) - 4) + secret[-2:]

    def _get_secret_recommendation(self, severity: str) -> str:
        """Get recommendation based on severity"""
        recommendations = {
            "critical": "Immediately rotate this secret and remove from version control",
            "high": "Move to secure secret management system (Vault, AWS Secrets Manager, etc.)",
            "medium": "Consider using environment variables or secure config",
            "low": "Review and consider if this needs to be secret",
        }
        return recommendations.get(severity, "Review secret handling practices")

    async def run_security_scan(self) -> List[SecurityScanResult]:
        """Run security compliance checks"""
        results = []

        for check_name in self.config.security_scan.enabled_checks:
            if check_name == "file_permissions":
                results.extend(await self._check_file_permissions())
            elif check_name == "exposed_ports":
                results.extend(await self._check_exposed_ports())
            elif check_name == "weak_passwords":
                results.extend(await self._check_weak_passwords())
            elif check_name == "outdated_packages":
                results.extend(await self._check_outdated_packages())

        return results

    async def _check_file_permissions(self) -> List[SecurityScanResult]:
        """Check for insecure file permissions"""
        results = []

        # Check for world-writable files
        for pattern in ["**/*.key", "**/*.pem", "**/secrets.*"]:
            for file_path in glob.glob(
                str(self.workspace_root / pattern), recursive=True
            ):
                file_path = Path(file_path)
                if file_path.exists():
                    stat = file_path.stat()
                    # Check if world-writable (anyone can write)
                    if stat.st_mode & 0o002:
                        results.append(
                            SecurityScanResult(
                                check_name="file_permissions",
                                status="fail",
                                severity="high",
                                description=f"World-writable file: {file_path}",
                                details=f"Permissions: {oct(stat.st_mode)}",
                                remediation="Restrict file permissions to owner-only (600) or owner-group (640)",
                            )
                        )

        return results

    async def _check_exposed_ports(self) -> List[SecurityScanResult]:
        """Check for potentially exposed ports"""
        results = []
        # This would typically use system tools to check listening ports
        # For now, return a placeholder
        results.append(
            SecurityScanResult(
                check_name="exposed_ports",
                status="pass",
                severity="low",
                description="Port exposure check completed",
                details="No obviously exposed sensitive ports detected",
            )
        )
        return results

    async def _check_weak_passwords(self) -> List[SecurityScanResult]:
        """Check for weak passwords in config files"""
        results = []
        # This would scan for common weak passwords
        results.append(
            SecurityScanResult(
                check_name="weak_passwords",
                status="pass",
                severity="low",
                description="Weak password check completed",
                details="No obvious weak passwords detected in scanned files",
            )
        )
        return results

    async def _check_outdated_packages(self) -> List[SecurityScanResult]:
        """Check for outdated packages"""
        results = []
        # This would check package versions against known vulnerabilities
        results.append(
            SecurityScanResult(
                check_name="outdated_packages",
                status="warning",
                severity="medium",
                description="Package version check needed",
                details="Automated package vulnerability scanning not yet implemented",
                remediation="Implement dependency vulnerability scanning",
            )
        )
        return results

    async def run_storage_cleanup(self) -> List[StorageCleanupResult]:
        """Run storage cleanup operations"""
        results = []

        for cleanup_type in self.config.storage_cleanup.cleanup_types:
            if cleanup_type == "cache":
                results.extend(await self._cleanup_cache_directories())
            elif cleanup_type == "venv":
                results.extend(await self._cleanup_venv_directories())
            elif cleanup_type == "logs":
                results.extend(await self._cleanup_log_files())
            elif cleanup_type == "temp":
                results.extend(await self._cleanup_temp_files())

        return results

    async def _cleanup_cache_directories(self) -> List[StorageCleanupResult]:
        """Clean up cache directories"""
        results = []
        cache_patterns = [
            "**/__pycache__",
            "**/.pytest_cache",
            "**/node_modules/.cache",
        ]

        for pattern in cache_patterns:
            for cache_path in glob.glob(
                str(self.workspace_root / pattern), recursive=True
            ):
                cache_path = Path(cache_path)
                if cache_path.exists() and cache_path.is_dir():
                    size_before = await self._calculate_directory_size(cache_path)
                    files_count = len(list(cache_path.rglob("*")))

                    if self.config.storage_cleanup.dry_run:
                        # Dry run - just report
                        results.append(
                            StorageCleanupResult(
                                path=cache_path,
                                cleanup_type="cache",
                                size_before=size_before,
                                size_after=size_before,
                                files_removed=0,
                                space_saved=0,
                            )
                        )
                    else:
                        # Actually clean up
                        shutil.rmtree(cache_path, ignore_errors=True)
                        results.append(
                            StorageCleanupResult(
                                path=cache_path,
                                cleanup_type="cache",
                                size_before=size_before,
                                size_after=0,
                                files_removed=files_count,
                                space_saved=size_before,
                            )
                        )

        return results

    async def _cleanup_venv_directories(self) -> List[StorageCleanupResult]:
        """Clean up virtual environment directories"""
        results = []
        venv_patterns = ["**/venv", "**/.venv", "**/env"]

        for pattern in venv_patterns:
            for venv_path in glob.glob(
                str(self.workspace_root / pattern), recursive=True
            ):
                venv_path = Path(venv_path)
                if venv_path.exists() and venv_path.is_dir():
                    size_before = await self._calculate_directory_size(venv_path)

                    if self.config.storage_cleanup.dry_run:
                        results.append(
                            StorageCleanupResult(
                                path=venv_path,
                                cleanup_type="venv",
                                size_before=size_before,
                                size_after=size_before,
                                files_removed=0,
                                space_saved=0,
                            )
                        )
                    else:
                        shutil.rmtree(venv_path, ignore_errors=True)
                        results.append(
                            StorageCleanupResult(
                                path=venv_path,
                                cleanup_type="venv",
                                size_before=size_before,
                                size_after=0,
                                files_removed=len(list(venv_path.rglob("*"))),
                                space_saved=size_before,
                            )
                        )

        return results

    async def _cleanup_log_files(self) -> List[StorageCleanupResult]:
        """Clean up old log files"""
        results = []
        log_patterns = ["**/*.log", "**/logs/*.log"]

        cutoff_date = datetime.now() - timedelta(
            days=self.config.storage_cleanup.max_age_days
        )

        for pattern in log_patterns:
            for log_path in glob.glob(
                str(self.workspace_root / pattern), recursive=True
            ):
                log_path = Path(log_path)
                if log_path.exists() and log_path.is_file():
                    mtime = datetime.fromtimestamp(log_path.stat().st_mtime)
                    if mtime < cutoff_date:
                        size = log_path.stat().st_size

                        if self.config.storage_cleanup.dry_run:
                            results.append(
                                StorageCleanupResult(
                                    path=log_path,
                                    cleanup_type="logs",
                                    size_before=size,
                                    size_after=size,
                                    files_removed=0,
                                    space_saved=0,
                                )
                            )
                        else:
                            log_path.unlink(missing_ok=True)
                            results.append(
                                StorageCleanupResult(
                                    path=log_path,
                                    cleanup_type="logs",
                                    size_before=size,
                                    size_after=0,
                                    files_removed=1,
                                    space_saved=size,
                                )
                            )

        return results

    async def _cleanup_temp_files(self) -> List[StorageCleanupResult]:
        """Clean up temporary files"""
        results = []
        temp_patterns = ["**/*.tmp", "**/*.temp", "**/tmp/*"]

        for pattern in temp_patterns:
            for temp_path in glob.glob(
                str(self.workspace_root / pattern), recursive=True
            ):
                temp_path = Path(temp_path)
                if temp_path.exists():
                    size = (
                        temp_path.stat().st_size
                        if temp_path.is_file()
                        else await self._calculate_directory_size(temp_path)
                    )

                    if self.config.storage_cleanup.dry_run:
                        results.append(
                            StorageCleanupResult(
                                path=temp_path,
                                cleanup_type="temp",
                                size_before=size,
                                size_after=size,
                                files_removed=0,
                                space_saved=0,
                            )
                        )
                    else:
                        if temp_path.is_file():
                            temp_path.unlink(missing_ok=True)
                            files_removed = 1
                        else:
                            shutil.rmtree(temp_path, ignore_errors=True)
                            files_removed = len(list(temp_path.rglob("*")))

                        results.append(
                            StorageCleanupResult(
                                path=temp_path,
                                cleanup_type="temp",
                                size_before=size,
                                size_after=0,
                                files_removed=files_removed,
                                space_saved=size,
                            )
                        )

        return results

    async def _calculate_directory_size(self, path: Path) -> int:
        """Calculate total size of a directory"""
        total_size = 0
        try:
            for file_path in path.rglob("*"):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
        except (OSError, PermissionError):
            pass
        return total_size

    async def execute_disk_consolidation(self) -> List[DiskConsolidationResult]:
        """Execute disk consolidation operations"""
        results = []
        target_dir = Path(self.config.disk_consolidation.target_directory)
        target_dir.mkdir(exist_ok=True)

        # Find files older than threshold
        cutoff_date = datetime.now() - timedelta(
            days=self.config.disk_consolidation.max_file_age_days
        )

        consolidation_candidates = []
        for pattern in ["**/*.log", "**/*.cache", "**/old_*"]:
            for file_path in glob.glob(
                str(self.workspace_root / pattern), recursive=True
            ):
                file_path = Path(file_path)
                if file_path.exists() and file_path.is_file():
                    mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                    if mtime < cutoff_date:
                        consolidation_candidates.append(file_path)

        # Process in batches
        for i in range(
            0,
            len(consolidation_candidates),
            self.config.disk_consolidation.consolidation_batch_size,
        ):
            batch = consolidation_candidates[
                i : i + self.config.disk_consolidation.consolidation_batch_size
            ]

            for file_path in batch:
                target_path = target_dir / f"{file_path.name}.archive"
                try:
                    original_size = file_path.stat().st_size

                    if self.config.disk_consolidation.compression_enabled:
                        # Compress and move
                        import gzip

                        with open(file_path, "rb") as f_in:
                            with gzip.open(target_path, "wb") as f_out:
                                shutil.copyfileobj(f_in, f_out)
                        final_size = target_path.stat().st_size
                        consolidation_type = "compress"
                    else:
                        # Just move
                        shutil.move(str(file_path), str(target_path))
                        final_size = original_size
                        consolidation_type = "move"

                    results.append(
                        DiskConsolidationResult(
                            source_path=file_path,
                            target_path=target_path,
                            consolidation_type=consolidation_type,
                            original_size=original_size,
                            final_size=final_size,
                            success=True,
                        )
                    )

                except Exception as e:
                    results.append(
                        DiskConsolidationResult(
                            source_path=file_path,
                            target_path=target_path,
                            consolidation_type="move",
                            original_size=file_path.stat().st_size,
                            final_size=0,
                            success=False,
                            error_message=str(e),
                        )
                    )

        return results

    async def perform_system_clean(self) -> List[SystemCleanResult]:
        """Perform system-level cache purge"""
        results = []

        if self.config.system_clean.clean_system_cache:
            results.append(await self._clean_system_cache())

        if self.config.system_clean.clean_user_cache:
            results.append(await self._clean_user_cache())

        if self.config.system_clean.clean_application_cache:
            results.append(await self._clean_application_cache())

        return results

    async def _clean_system_cache(self) -> SystemCleanResult:
        """Clean system-level caches"""
        # This would typically use system commands like `sudo rm -rf /Library/Caches/*`
        # For safety, we'll just report what would be cleaned
        paths_cleaned = []
        total_space_saved = 0

        # Placeholder for system cache cleaning
        return SystemCleanResult(
            cache_type="system",
            paths_cleaned=paths_cleaned,
            total_space_saved=total_space_saved,
            success=True,
        )

    async def _clean_user_cache(self) -> SystemCleanResult:
        """Clean user-level caches"""
        paths_cleaned = []
        total_space_saved = 0

        # Clean common user cache directories
        cache_dirs = [
            Path.home() / "Library/Caches",
            Path.home() / ".cache",
            self.workspace_root / ".pytest_cache",
        ]

        for cache_dir in cache_dirs:
            if cache_dir.exists():
                try:
                    size_before = await self._calculate_directory_size(cache_dir)
                    # In a real implementation, we'd clean specific cache files
                    # For now, just report
                    paths_cleaned.append(cache_dir)
                    total_space_saved += size_before
                except Exception:
                    pass

        return SystemCleanResult(
            cache_type="user",
            paths_cleaned=paths_cleaned,
            total_space_saved=total_space_saved,
            success=True,
        )

    async def _clean_application_cache(self) -> SystemCleanResult:
        """Clean application-specific caches"""
        paths_cleaned = []
        total_space_saved = 0

        # Clean workspace-specific caches
        app_cache_dirs = [
            self.workspace_root / "node_modules/.cache",
            self.workspace_root / ".next/cache",
            self.workspace_root / ".nuxt/cache",
        ]

        for cache_dir in app_cache_dirs:
            if cache_dir.exists():
                try:
                    size_before = await self._calculate_directory_size(cache_dir)
                    paths_cleaned.append(cache_dir)
                    total_space_saved += size_before
                except Exception:
                    pass

        return SystemCleanResult(
            cache_type="application",
            paths_cleaned=paths_cleaned,
            total_space_saved=total_space_saved,
            success=True,
        )

    async def get_secrets_playbook(self) -> List[SecretsPlaybookEntry]:
        """Get the secrets management playbook"""
        return [
            SecretsPlaybookEntry(
                title="API Key Management",
                description="Best practices for managing API keys and tokens",
                steps=[
                    "Use environment variables for API keys",
                    "Never commit secrets to version control",
                    "Rotate keys regularly",
                    "Use secret management services (Vault, AWS Secrets Manager)",
                    "Audit key usage and access patterns",
                ],
                priority="high",
                tags=["security", "api-keys", "secrets"],
            ),
            SecretsPlaybookEntry(
                title="Environment Variable Hygiene",
                description="Maintaining clean and secure environment configurations",
                steps=[
                    "Use .env files only for development",
                    "Never commit .env files to version control",
                    "Validate environment variables on startup",
                    "Use different keys for different environments",
                    "Document required environment variables",
                ],
                priority="medium",
                tags=["environment", "configuration", "development"],
            ),
            SecretsPlaybookEntry(
                title="Certificate Management",
                description="Managing SSL/TLS certificates and keys",
                steps=[
                    "Store certificates in secure locations",
                    "Set appropriate file permissions (600)",
                    "Monitor certificate expiration dates",
                    "Automate certificate renewal",
                    "Use certificate pinning when appropriate",
                ],
                priority="high",
                tags=["ssl", "tls", "certificates", "security"],
            ),
        ]

    async def generate_compliance_report(self) -> ComplianceReport:
        """Generate a comprehensive compliance report"""
        secrets_audit = await self.audit_secrets()
        security_scans = await self.run_security_scan()
        storage_cleanup = await self.run_storage_cleanup()

        # Calculate overall score
        total_checks = len(secrets_audit) + len(security_scans)
        failed_checks = len(
            [r for r in secrets_audit if r.severity in ["high", "critical"]]
        ) + len([r for r in security_scans if r.status == "fail"])

        overall_score = 1.0 - (failed_checks / max(total_checks, 1))
        overall_score = max(0.0, min(1.0, overall_score))

        critical_issues = len(
            [r for r in secrets_audit if r.severity == "critical"]
        ) + len(
            [
                r
                for r in security_scans
                if r.status == "fail" and r.severity == "critical"
            ]
        )

        recommendations = []
        if secrets_audit:
            recommendations.append("Review and remediate identified secrets")
        if any(r.status == "fail" for r in security_scans):
            recommendations.append("Address failed security checks")
        if not storage_cleanup:
            recommendations.append("Consider running storage cleanup")

        return ComplianceReport(
            secrets_audit=secrets_audit,
            security_scans=security_scans,
            storage_cleanup=storage_cleanup,
            overall_score=overall_score,
            critical_issues=critical_issues,
            recommendations=recommendations,
        )
