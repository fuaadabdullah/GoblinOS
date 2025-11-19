"""
Configuration schemas for Keepers Guild goblin
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class SecretsAuditConfig(BaseModel):
    """Configuration for secrets auditing"""

    scan_paths: List[str] = Field(
        default_factory=lambda: ["**/.env*", "**/*.config", "**/secrets.*"]
    )
    exclude_patterns: List[str] = Field(
        default_factory=lambda: ["**/node_modules/**", "**/.git/**", "**/dist/**"]
    )
    secret_patterns: List[str] = Field(
        default_factory=lambda: [
            r"(?i)(api[_-]?key|apikey)\s*[=:]\s*['\"]([^'\"]*)['\"]",
            r"(?i)(password|passwd|pwd)\s*[=:]\s*['\"]([^'\"]*)['\"]",
            r"(?i)(token|bearer)\s*[=:]\s*['\"]([^'\"]*)['\"]",
            r"(?i)(secret|key)\s*[=:]\s*['\"]([^'\"]*)['\"]",
        ]
    )
    severity_threshold: str = Field(
        default="medium", pattern="^(low|medium|high|critical)$"
    )


class SecurityScanConfig(BaseModel):
    """Configuration for security compliance scans"""

    enabled_checks: List[str] = Field(
        default_factory=lambda: [
            "file_permissions",
            "exposed_ports",
            "weak_passwords",
            "outdated_packages",
        ]
    )
    scan_depth: int = Field(default=3, ge=1, le=10)
    timeout_seconds: int = Field(default=300, ge=30)


class StorageCleanupConfig(BaseModel):
    """Configuration for storage cleanup operations"""

    cleanup_types: List[str] = Field(
        default_factory=lambda: ["cache", "venv", "logs", "temp"]
    )
    max_age_days: int = Field(default=30, ge=1)
    size_threshold_mb: int = Field(default=100, ge=10)
    preserve_paths: List[str] = Field(default_factory=list)
    dry_run: bool = Field(default=True)


class DiskConsolidationConfig(BaseModel):
    """Configuration for disk consolidation"""

    target_directory: str = Field(default="./archives")
    compression_enabled: bool = Field(default=True)
    max_file_age_days: int = Field(default=90, ge=7)
    consolidation_batch_size: int = Field(default=100, ge=10)


class SystemCleanConfig(BaseModel):
    """Configuration for system-level cleaning"""

    clean_system_cache: bool = Field(default=True)
    clean_user_cache: bool = Field(default=True)
    clean_application_cache: bool = Field(default=True)
    preserve_recent: bool = Field(default=True)
    recent_threshold_days: int = Field(default=7, ge=1)


class KeepersGuildConfig(BaseModel):
    """Main configuration for Keepers Guild goblin"""

    secrets_audit: SecretsAuditConfig = Field(default_factory=SecretsAuditConfig)
    security_scan: SecurityScanConfig = Field(default_factory=SecurityScanConfig)
    storage_cleanup: StorageCleanupConfig = Field(default_factory=StorageCleanupConfig)
    disk_consolidation: DiskConsolidationConfig = Field(
        default_factory=DiskConsolidationConfig
    )
    system_clean: SystemCleanConfig = Field(default_factory=SystemCleanConfig)

    enable_telemetry: bool = Field(default=True)
    log_level: str = Field(
        default="INFO", pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$"
    )
    workspace_root: Optional[str] = Field(default=None)
