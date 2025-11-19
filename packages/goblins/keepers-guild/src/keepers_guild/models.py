"""
Type definitions for Keepers Guild goblin
"""
from typing import Dict, List, Optional, Any, Literal
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel, Field


class SecretAuditResult(BaseModel):
    """Result of a secrets audit operation"""
    file_path: Path
    secret_type: str  # 'api_key', 'password', 'token', etc.
    line_number: int
    severity: Literal["low", "medium", "high", "critical"]
    description: str
    recommendation: str
    masked_value: Optional[str] = None


class SecurityScanResult(BaseModel):
    """Result of a security compliance scan"""
    check_name: str
    status: Literal["pass", "fail", "warning"]
    severity: Literal["low", "medium", "high", "critical"]
    description: str
    details: Optional[str] = None
    remediation: Optional[str] = None


class StorageCleanupResult(BaseModel):
    """Result of storage cleanup operation"""
    path: Path
    cleanup_type: Literal["cache", "venv", "logs", "temp", "archives"]
    size_before: int  # bytes
    size_after: int  # bytes
    files_removed: int
    space_saved: int  # bytes


class DiskConsolidationResult(BaseModel):
    """Result of disk consolidation operation"""
    source_path: Path
    target_path: Path
    consolidation_type: Literal["move", "archive", "compress"]
    original_size: int  # bytes
    final_size: int  # bytes
    success: bool
    error_message: Optional[str] = None


class SecretsPlaybookEntry(BaseModel):
    """Entry in the secrets management playbook"""
    title: str
    description: str
    steps: List[str]
    priority: Literal["low", "medium", "high", "critical"]
    tags: List[str] = Field(default_factory=list)
    last_updated: datetime = Field(default_factory=datetime.now)


class ComplianceReport(BaseModel):
    """Comprehensive compliance report"""
    timestamp: datetime = Field(default_factory=datetime.now)
    secrets_audit: List[SecretAuditResult]
    security_scans: List[SecurityScanResult]
    storage_cleanup: List[StorageCleanupResult]
    overall_score: float  # 0.0 to 1.0
    critical_issues: int
    recommendations: List[str]


class SystemCleanResult(BaseModel):
    """Result of system-level cache purge"""
    cache_type: str  # 'system', 'user', 'application'
    paths_cleaned: List[Path]
    total_space_saved: int  # bytes
    success: bool
    error_message: Optional[str] = None
