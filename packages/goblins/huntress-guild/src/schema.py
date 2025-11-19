"""
Configuration schemas for Huntress Guild Goblin
"""

from pydantic import BaseModel, Field
from typing import List, Optional


class TestAnalysisConfig(BaseModel):
    """Configuration for test analysis."""

    min_runs_for_flaky_detection: int = Field(
        default=5, description="Minimum test runs to analyze for flakiness"
    )
    flaky_threshold: float = Field(
        default=0.1, description="Failure rate threshold to consider a test flaky"
    )
    enable_pattern_recognition: bool = Field(
        default=True, description="Enable AI-powered pattern recognition"
    )
    log_analysis_depth: int = Field(
        default=1000, description="Number of log lines to analyze"
    )


class RegressionTriageConfig(BaseModel):
    """Configuration for regression triage."""

    git_blame_depth: int = Field(
        default=10, description="Number of commits to analyze for regression"
    )
    impact_assessment_enabled: bool = Field(
        default=True, description="Enable impact assessment"
    )
    auto_tag_incidents: bool = Field(
        default=True, description="Automatically tag incidents"
    )


class SignalScoutingConfig(BaseModel):
    """Configuration for signal scouting."""

    log_files_patterns: List[str] = Field(
        default=["*.log", "logs/*.log"], description="Patterns for log files to monitor"
    )
    early_signal_threshold: float = Field(
        default=0.05, description="Threshold for early signal detection"
    )
    trend_analysis_window: int = Field(
        default=7, description="Days to analyze for trends"
    )



class IncidentReportingConfig(BaseModel):
    """Configuration for incident reporting."""

    severity_threshold: str = Field(
        default="medium", description="Minimum severity to report"
    )
    auto_resolution_enabled: bool = Field(
        default=False, description="Enable automatic incident resolution"
    )
    notification_channels: List[str] = Field(
        default=[], description="Channels for incident notifications"
    )


class HuntressGuildConfig(BaseModel):
    """Main configuration for Huntress Guild Goblin."""

    test_analysis: TestAnalysisConfig = Field(default_factory=TestAnalysisConfig)
    regression_triage: RegressionTriageConfig = Field(
        default_factory=RegressionTriageConfig
    )
    signal_scouting: SignalScoutingConfig = Field(default_factory=SignalScoutingConfig)
    incident_reporting: IncidentReportingConfig = Field(
        default_factory=IncidentReportingConfig
    )

    # General settings
    enable_telemetry: bool = Field(
        default=True, description="Enable telemetry collection"
    )
    log_level: str = Field(default="INFO", description="Logging level")
    workspace_root: Optional[str] = Field(
        default=None, description="Workspace root directory"
    )
