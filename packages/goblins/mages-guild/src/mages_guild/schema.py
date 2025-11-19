"""
Configuration schemas for Mages Guild.

This module defines the configuration models and validation schemas for all
Mages Guild operations including quality gates, vault validation, and anomaly detection.
"""

from typing import List, Optional
from pydantic import BaseModel, Field, validator


class QualityGateConfig(BaseModel):
    """Configuration for quality gate operations."""

    enabled_checks: List[str] = Field(
        default_factory=lambda: ["lint", "type_check", "security"],
        description="List of quality checks to enable",
    )

    lint_paths: List[str] = Field(
        default_factory=lambda: ["apps/forge-lite", "GoblinOS"],
        description="Paths to run linting on",
    )

    python_lint_command: str = Field(
        default="ruff check", description="Command to run Python linting"
    )

    typescript_lint_command: str = Field(
        default="pnpm lint", description="Command to run TypeScript linting"
    )

    fail_on_warnings: bool = Field(
        default=False, description="Whether to fail quality gates on warnings"
    )

    max_issues_threshold: Optional[int] = Field(
        default=None, description="Maximum number of issues allowed before failing"
    )

    exclude_patterns: List[str] = Field(
        default_factory=lambda: ["node_modules", ".git", "dist", "build"],
        description="File patterns to exclude from quality checks",
    )


class VaultValidationConfig(BaseModel):
    """Configuration for Obsidian vault validation."""

    vault_path: str = Field(default="vault", description="Path to the Obsidian vault")

    require_frontmatter: bool = Field(
        default=True, description="Whether YAML frontmatter is required in all notes"
    )

    required_frontmatter_fields: List[str] = Field(
        default_factory=lambda: ["title", "created", "tags"],
        description="Required fields in YAML frontmatter",
    )

    validate_linguist_attributes: bool = Field(
        default=True, description="Whether to validate linguist attributes in frontmatter"
    )

    check_broken_links: bool = Field(
        default=True, description="Whether to check for broken internal links"
    )

    allowed_file_extensions: List[str] = Field(
        default_factory=lambda: [".md", ".txt", ".json"],
        description="Allowed file extensions in vault",
    )

    max_file_size_kb: int = Field(default=1000, description="Maximum file size in KB")


class AnomalyDetectionConfig(BaseModel):
    """Configuration for anomaly detection operations."""

    enabled_detectors: List[str] = Field(
        default_factory=lambda: ["metric_spike", "error_rate", "latency"],
        description="Types of anomaly detectors to enable",
    )

    time_window_minutes: int = Field(
        default=60, description="Time window for anomaly detection in minutes"
    )

    sensitivity_threshold: float = Field(
        default=0.8, description="Sensitivity threshold for anomaly detection (0-1)"
    )

    min_confidence_score: float = Field(
        default=0.7, description="Minimum confidence score required for anomaly alerts"
    )

    baseline_period_days: int = Field(
        default=7, description="Number of days to use for establishing baseline"
    )

    alert_channels: List[str] = Field(
        default_factory=lambda: ["console"], description="Channels to send anomaly alerts to"
    )

    false_positive_tolerance: float = Field(
        default=0.05, description="Acceptable false positive rate (0-1)"
    )


class ForecastingConfig(BaseModel):
    """Configuration for release risk forecasting."""

    enabled_metrics: List[str] = Field(
        default_factory=lambda: ["build_time", "test_coverage", "error_rate"],
        description="Metrics to include in forecasting",
    )

    forecast_horizon_days: int = Field(default=30, description="Number of days to forecast ahead")

    risk_threshold_high: float = Field(
        default=0.8, description="Risk score threshold for high risk (0-1)"
    )

    risk_threshold_medium: float = Field(
        default=0.5, description="Risk score threshold for medium risk (0-1)"
    )

    historical_data_days: int = Field(default=90, description="Days of historical data to analyze")

    confidence_level: float = Field(
        default=0.95, description="Confidence level for risk assessments (0-1)"
    )


class DocumentationConfig(BaseModel):
    """Configuration for documentation generation and updates."""

    auto_generate_api_docs: bool = Field(
        default=True, description="Whether to auto-generate API documentation"
    )

    api_doc_format: str = Field(
        default="markdown", description="Format for generated API documentation"
    )

    update_readme: bool = Field(
        default=True, description="Whether to update README files automatically"
    )

    docs_path: str = Field(default="docs", description="Path to documentation directory")

    include_examples: bool = Field(
        default=True, description="Whether to include usage examples in docs"
    )


class MagesGuildConfig(BaseModel):
    """Main configuration schema for Mages Guild."""

    # Repository settings
    repo_root: Optional[str] = Field(
        default=None, description="Root directory of the repository to operate on"
    )

    quality_gate: QualityGateConfig = Field(
        default_factory=QualityGateConfig, description="Configuration for quality gate operations"
    )

    vault_validation: VaultValidationConfig = Field(
        default_factory=VaultValidationConfig,
        description="Configuration for vault validation operations",
    )

    anomaly_detection: AnomalyDetectionConfig = Field(
        default_factory=AnomalyDetectionConfig,
        description="Configuration for anomaly detection operations",
    )

    forecasting: ForecastingConfig = Field(
        default_factory=ForecastingConfig, description="Configuration for release risk forecasting"
    )

    documentation: DocumentationConfig = Field(
        default_factory=DocumentationConfig,
        description="Configuration for documentation operations",
    )

    # Global settings
    verbose_logging: bool = Field(default=False, description="Enable verbose logging for debugging")

    dry_run: bool = Field(
        default=False, description="Run operations in dry-run mode without making changes"
    )

    timeout_seconds: int = Field(default=300, description="Timeout for operations in seconds")

    @validator("timeout_seconds")
    def validate_timeout(cls, v):
        if v < 30:
            raise ValueError("timeout_seconds must be at least 30 seconds")
        return v
