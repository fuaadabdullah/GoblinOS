"""
Type definitions for Huntress Guild Goblin
"""

from typing import Any, Dict, List, Optional
from enum import Enum
from pydantic import BaseModel


class TestResult(str, Enum):
    """Possible test result states."""

    PASSED = "passed"
    FAILED = "failed"
    FLAKY = "flaky"
    SKIPPED = "skipped"
    ERROR = "error"


class IncidentSeverity(str, Enum):
    """Severity levels for incidents."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TestRun(BaseModel):
    """Result of a single test execution."""

    name: str
    result: TestResult
    duration: float
    error_message: Optional[str] = None
    stack_trace: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class TestSuiteResult(BaseModel):
    """Result of a test suite execution."""

    suite_name: str
    total_tests: int
    passed: int
    failed: int
    flaky: int
    skipped: int
    errors: int
    duration: float
    test_runs: List[TestRun]
    metadata: Optional[Dict[str, Any]] = None


class FlakyTestAnalysis(BaseModel):
    """Analysis of a potentially flaky test."""

    test_name: str
    failure_rate: float
    recent_runs: List[TestRun]
    patterns: List[str]  # e.g., ["network_timeout", "race_condition"]
    recommendations: List[str]
    confidence_score: float  # 0.0 to 1.0


class RegressionAnalysis(BaseModel):
    """Analysis of a regression."""

    commit_hash: str
    affected_tests: List[str]
    severity: IncidentSeverity
    root_cause_hypothesis: str
    remediation_steps: List[str]
    impact_assessment: str


class IncidentReport(BaseModel):
    """Report of an incident."""

    id: str
    title: str
    severity: IncidentSeverity
    description: str
    affected_components: List[str]
    tags: List[str]
    created_at: str
    resolved_at: Optional[str] = None
    resolution: Optional[str] = None


class HuntressGuildInput(BaseModel):
    """Input for Huntress Guild operations."""

    command: (
        str  # "analyze_tests", "triage_regression", "scout_signals", "report_incidents"
    )
    test_results: Optional[TestSuiteResult] = None
    commit_hash: Optional[str] = None
    log_files: Optional[List[str]] = None
    options: Optional[Dict[str, Any]] = None


class HuntressGuildOutput(BaseModel):
    """Output from Huntress Guild operations."""

    command: str
    success: bool
    result: Optional[Any] = None  # Can be FlakyTestAnalysis, RegressionAnalysis, etc.
    message: str
    execution_time: float
    incidents: Optional[List[IncidentReport]] = None
