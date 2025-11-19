"""
Type definitions for Mages Guild - Quality gates, anomaly detection, and vault validation.

This module defines all the data models and types used throughout the Mages Guild package.
"""

from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field
from enum import Enum


class Severity(str, Enum):
    """Severity levels for quality issues and anomalies."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class QualityCheckType(str, Enum):
    """Types of quality checks that can be performed."""

    LINT = "lint"
    TYPE_CHECK = "type_check"
    SECURITY = "security"
    COVERAGE = "coverage"
    FORMATTING = "formatting"


class VaultValidationType(str, Enum):
    """Types of vault validation checks."""

    YAML_FRONTMATTER = "yaml_frontmatter"
    LINGUIST_ATTRIBUTES = "linguist_attributes"
    FILE_STRUCTURE = "file_structure"
    LINK_VALIDATION = "link_validation"


class AnomalyType(str, Enum):
    """Types of anomalies that can be detected."""

    METRIC_SPIKE = "metric_spike"
    ERROR_RATE_INCREASE = "error_rate_increase"
    LATENCY_DEGRADATION = "latency_degradation"
    RESOURCE_EXHAUSTION = "resource_exhaustion"


class QualityIssue(BaseModel):
    """Represents a single quality issue found during linting or validation."""

    file_path: str = Field(..., description="Path to the file with the issue")
    line_number: Optional[int] = Field(None, description="Line number where issue occurs")
    column_number: Optional[int] = Field(None, description="Column number where issue occurs")
    rule_id: str = Field(..., description="Identifier for the linting rule violated")
    message: str = Field(..., description="Human-readable description of the issue")
    severity: Severity = Field(..., description="Severity level of the issue")
    check_type: QualityCheckType = Field(
        ..., description="Type of quality check that found this issue"
    )
    suggested_fix: Optional[str] = Field(None, description="Suggested fix for the issue")


class QualityReport(BaseModel):
    """Report containing results from quality gate checks."""

    total_files_checked: int = Field(..., description="Total number of files analyzed")
    issues_found: List[QualityIssue] = Field(
        default_factory=list, description="List of quality issues found"
    )
    issues_by_severity: Dict[Severity, int] = Field(
        default_factory=dict, description="Count of issues by severity"
    )
    issues_by_type: Dict[QualityCheckType, int] = Field(
        default_factory=dict, description="Count of issues by check type"
    )
    execution_time_seconds: float = Field(..., description="Time taken to run quality checks")
    success: bool = Field(..., description="Whether quality gates passed")


class VaultIssue(BaseModel):
    """Represents a single vault validation issue."""

    file_path: str = Field(..., description="Path to the file with the issue")
    issue_type: VaultValidationType = Field(..., description="Type of validation issue")
    message: str = Field(..., description="Description of the validation issue")
    severity: Severity = Field(..., description="Severity level of the issue")
    suggested_fix: Optional[str] = Field(None, description="Suggested fix for the issue")


class VaultValidationReport(BaseModel):
    """Report containing results from vault validation checks."""

    total_files_checked: int = Field(..., description="Total number of files in vault")
    issues_found: List[VaultIssue] = Field(
        default_factory=list, description="List of vault issues found"
    )
    issues_by_severity: Dict[Severity, int] = Field(
        default_factory=dict, description="Count of issues by severity"
    )
    issues_by_type: Dict[VaultValidationType, int] = Field(
        default_factory=dict, description="Count of issues by type"
    )
    execution_time_seconds: float = Field(..., description="Time taken to validate vault")
    success: bool = Field(..., description="Whether vault validation passed")


class AnomalyDetectionResult(BaseModel):
    """Result from anomaly detection analysis."""

    anomaly_type: AnomalyType = Field(..., description="Type of anomaly detected")
    metric_name: str = Field(..., description="Name of the metric showing anomalous behavior")
    current_value: Union[float, int] = Field(..., description="Current anomalous value")
    expected_value: Union[float, int] = Field(..., description="Expected normal value")
    deviation_percentage: float = Field(..., description="Percentage deviation from expected")
    confidence_score: float = Field(
        ..., description="Confidence score for the anomaly detection (0-1)"
    )
    detection_timestamp: str = Field(..., description="When the anomaly was detected")
    historical_context: Dict[str, Any] = Field(
        default_factory=dict, description="Historical data context"
    )


class AnomalyReport(BaseModel):
    """Report containing results from anomaly detection."""

    time_window_minutes: int = Field(..., description="Time window analyzed for anomalies")
    anomalies_detected: List[AnomalyDetectionResult] = Field(
        default_factory=list, description="List of detected anomalies"
    )
    anomalies_by_type: Dict[AnomalyType, int] = Field(
        default_factory=dict, description="Count of anomalies by type"
    )
    false_positive_rate: Optional[float] = Field(None, description="Estimated false positive rate")
    execution_time_seconds: float = Field(..., description="Time taken to detect anomalies")


class ForecastingMetric(BaseModel):
    """A single metric used in forecasting."""

    name: str = Field(..., description="Name of the metric")
    value: Union[float, int] = Field(..., description="Current value of the metric")
    unit: str = Field(..., description="Unit of measurement")
    trend: str = Field(..., description="Trend direction (up/down/stable)")


class ReleaseRiskAssessment(BaseModel):
    """Assessment of release risk based on forecasting."""

    overall_risk_score: float = Field(
        ..., description="Overall risk score (0-1, higher is riskier)"
    )
    risk_factors: List[str] = Field(
        default_factory=list, description="Key factors contributing to risk"
    )
    confidence_interval: Dict[str, float] = Field(
        ..., description="Confidence interval for risk assessment"
    )
    recommended_actions: List[str] = Field(
        default_factory=list, description="Recommended actions to mitigate risk"
    )
    forecast_horizon_days: int = Field(..., description="Number of days the forecast covers")
    metrics_analyzed: List[ForecastingMetric] = Field(
        default_factory=list, description="Metrics used in forecasting"
    )


class MagesGuildResult(BaseModel):
    """Combined result from all Mages Guild operations."""

    quality_report: Optional[QualityReport] = Field(
        None, description="Results from quality gate checks"
    )
    vault_report: Optional[VaultValidationReport] = Field(
        None, description="Results from vault validation"
    )
    anomaly_report: Optional[AnomalyReport] = Field(
        None, description="Results from anomaly detection"
    )
    risk_assessment: Optional[ReleaseRiskAssessment] = Field(
        None, description="Release risk assessment"
    )
    execution_time_seconds: float = Field(..., description="Total execution time")
    success: bool = Field(..., description="Whether all operations completed successfully")
    summary: str = Field(..., description="Human-readable summary of results")
