"""
Automated Remediation System for Smithy
Phase 3.2: AI-powered security issue remediation with human oversight

This module provides automated security fix generation, risk assessment,
and approval workflows for security findings.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Protocol

from .security import SecurityFinding, SecurityReport, SecuritySeverity


class RemediationStatus(Enum):
    """Status of remediation process"""

    PENDING = "pending"
    ANALYZING = "analyzing"
    GENERATING_FIX = "generating_fix"
    READY_FOR_REVIEW = "ready_for_review"
    APPROVED = "approved"
    APPLIED = "applied"
    REJECTED = "rejected"
    FAILED = "failed"


class RiskLevel(Enum):
    """Risk assessment levels for remediation"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class RemediationAction:
    """Represents a single remediation action"""

    id: str
    finding_id: str
    title: str
    description: str
    risk_level: RiskLevel
    estimated_effort: str  # "low", "medium", "high"
    generated_fix: Optional[str] = None
    file_path: Optional[Path] = None
    line_number: Optional[int] = None
    status: RemediationStatus = RemediationStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    approved_by: Optional[str] = None
    applied_at: Optional[datetime] = None
    rollback_available: bool = False
    rollback_data: Optional[Dict[str, Any]] = None


@dataclass
class RemediationPlan:
    """Complete remediation plan for a security report"""

    id: str
    report_id: str
    actions: List[RemediationAction] = field(default_factory=list)
    overall_risk: RiskLevel = RiskLevel.LOW
    estimated_completion: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    status: str = "draft"


class FixGenerator(Protocol):
    """Protocol for AI-powered fix generation"""

    async def generate_fix(self, finding: SecurityFinding) -> Optional[str]:
        """
        Generate a fix for a security finding

        Args:
            finding: The security finding to fix

        Returns:
            Generated fix code or None if unable to generate
        """
        ...


class ApprovalWorkflow(Protocol):
    """Protocol for remediation approval workflows"""

    async def request_approval(self, action: RemediationAction) -> bool:
        """
        Request approval for a remediation action

        Args:
            action: The remediation action requiring approval

        Returns:
            True if approved, False otherwise
        """
        ...


class RollbackManager(Protocol):
    """Protocol for managing remediation rollbacks"""

    async def create_rollback_point(self, file_path: Path) -> Dict[str, Any]:
        """
        Create a rollback point for a file

        Args:
            file_path: Path to the file to backup

        Returns:
            Rollback data that can be used to restore the file
        """
        ...

    async def rollback(self, rollback_data: Dict[str, Any]) -> bool:
        """
        Rollback a file to a previous state

        Args:
            rollback_data: Rollback data from create_rollback_point

        Returns:
            True if rollback successful
        """
        ...


class BasicFixGenerator:
    """Basic AI-powered fix generator using pattern matching and templates"""

    def __init__(self):
        self.fix_templates = {
            "command_injection": """
# SECURITY FIX: Prevent command injection
# Original vulnerable code used subprocess with shell=True
# Fixed to use shell=False and proper argument passing

import subprocess

# SECURE: Use shell=False and pass arguments as list
result = subprocess.run(
    {command_args},
    shell=False,  # Never use shell=True with user input
    capture_output=True,
    text=True,
    timeout=30
)
""",
            "path_traversal": """
# SECURITY FIX: Prevent path traversal attacks
# Original code did not validate file paths
# Fixed to use pathlib.Path.resolve() and validate paths

from pathlib import Path

def secure_file_access(file_path: str, base_dir: Path) -> Path:
    \"\"\"Securely resolve file path within base directory\"\"\"
    resolved = (base_dir / file_path).resolve()

    # Ensure path is within base directory
    if not str(resolved).startswith(str(base_dir.resolve())):
        raise ValueError("Path traversal detected")

    return resolved
""",
            "xss_vulnerable": """
# SECURITY FIX: Prevent XSS attacks
# Original code directly inserted user input into HTML
# Fixed to use proper output encoding

from html import escape

def secure_html_output(user_input: str) -> str:
    \"\"\"Safely render user input in HTML\"\"\"
    # Always escape user input before inserting into HTML
    return f"<div>{{escape(user_input)}}</div>"
""",
            "secrets_exposed": """
# SECURITY FIX: Remove exposed secrets
# Original code contained hardcoded credentials
# Fixed to use environment variables or secure credential storage

import os
from typing import Optional

def get_secure_credential(key: str) -> Optional[str]:
    \"\"\"Get credential from secure source\"\"\"
    # Use environment variables or secure credential manager
    return os.getenv(key)

# Replace hardcoded values with secure credential retrieval
api_key = get_secure_credential('API_KEY')
if not api_key:
    raise ValueError("API_KEY environment variable not set")
""",
        }

    async def generate_fix(self, finding: SecurityFinding) -> Optional[str]:
        """Generate a fix based on finding type and description"""
        finding_type = finding.scan_type.value.lower()

        # Match finding type to template
        if "command" in finding_type and "injection" in finding_type:
            return self.fix_templates["command_injection"].format(
                command_args=self._extract_command_args(finding.description)
            )
        elif "path" in finding_type and "traversal" in finding_type:
            return self.fix_templates["path_traversal"]
        elif "xss" in finding_type:
            return self.fix_templates["xss_vulnerable"]
        elif "secret" in finding_type:
            return self.fix_templates["secrets_exposed"]

        # Generic fix for unknown types
        return f"""
# SECURITY FIX: Address {finding.scan_type.value}
# Finding: {finding.description}
# Severity: {finding.severity.value}
# Recommended: Review and implement appropriate security measures

# TODO: Implement security fix for {finding.scan_type.value}
# Consult security best practices and implement proper validation/sanitization
"""

    def _extract_command_args(self, description: str) -> str:
        """Extract command arguments from finding description"""
        # Simple heuristic to extract command from description
        if "subprocess" in description:
            return "['command', 'arg1', 'arg2']"  # Placeholder
        return "['safe_command']"


class BasicApprovalWorkflow:
    """Basic approval workflow with risk-based thresholds"""

    def __init__(self, auto_approve_low_risk: bool = True):
        self.auto_approve_low_risk = auto_approve_low_risk

    async def request_approval(self, action: RemediationAction) -> bool:
        """Request approval based on risk level"""
        if action.risk_level == RiskLevel.LOW and self.auto_approve_low_risk:
            return True

        if action.risk_level == RiskLevel.CRITICAL:
            # Critical fixes require manual approval
            return False

        # Medium and high risk require review
        return False  # For now, require manual approval


class BasicRollbackManager:
    """Basic rollback manager using file backups"""

    def __init__(self, backup_dir: Path):
        self.backup_dir = backup_dir
        self.backup_dir.mkdir(exist_ok=True)

    async def create_rollback_point(self, file_path: Path) -> Dict[str, Any]:
        """Create a backup of the file"""
        if not file_path.exists():
            return {"type": "nonexistent", "original_path": str(file_path)}

        backup_name = f"{file_path.name}.{datetime.now().isoformat()}.backup"
        backup_path = self.backup_dir / backup_name

        # Copy file content
        content = file_path.read_text(encoding="utf-8")
        backup_path.write_text(content, encoding="utf-8")

        return {
            "type": "file_backup",
            "original_path": str(file_path),
            "backup_path": str(backup_path),
            "timestamp": datetime.now().isoformat(),
            "content_hash": hash(content),  # Simple hash for verification
        }

    async def rollback(self, rollback_data: Dict[str, Any]) -> bool:
        """Restore file from backup"""
        try:
            if rollback_data["type"] == "nonexistent":
                # File didn't exist, remove if it was created
                Path(rollback_data["original_path"]).unlink(missing_ok=True)
                return True

            elif rollback_data["type"] == "file_backup":
                backup_path = Path(rollback_data["backup_path"])
                original_path = Path(rollback_data["original_path"])

                if backup_path.exists():
                    content = backup_path.read_text(encoding="utf-8")
                    original_path.write_text(content, encoding="utf-8")
                    return True

            return False
        except Exception:
            return False


class AutomatedRemediationEngine:
    """Main engine for automated security remediation"""

    def __init__(
        self,
        fix_generator: Optional[FixGenerator] = None,
        approval_workflow: Optional[ApprovalWorkflow] = None,
        rollback_manager: Optional[RollbackManager] = None,
    ):
        self.fix_generator = fix_generator or BasicFixGenerator()
        self.approval_workflow = approval_workflow or BasicApprovalWorkflow()
        self.rollback_manager = rollback_manager or BasicRollbackManager(Path(".smithy/backups"))

    def assess_risk(self, finding: SecurityFinding) -> RiskLevel:
        """Assess risk level for a security finding"""
        if finding.severity == SecuritySeverity.CRITICAL:
            return RiskLevel.CRITICAL
        elif finding.severity == SecuritySeverity.HIGH:
            return RiskLevel.HIGH
        elif finding.severity == SecuritySeverity.MEDIUM:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW

    async def generate_remediation_plan(self, report: SecurityReport) -> RemediationPlan:
        """Generate a comprehensive remediation plan"""
        plan_id = f"remediation_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        plan = RemediationPlan(id=plan_id, report_id=report.scan_id)

        # Create remediation actions for each finding
        for finding in report.findings:
            action = await self._create_remediation_action(finding)
            plan.actions.append(action)

        # Calculate overall risk
        if any(a.risk_level == RiskLevel.CRITICAL for a in plan.actions):
            plan.overall_risk = RiskLevel.CRITICAL
        elif any(a.risk_level == RiskLevel.HIGH for a in plan.actions):
            plan.overall_risk = RiskLevel.HIGH
        elif any(a.risk_level == RiskLevel.MEDIUM for a in plan.actions):
            plan.overall_risk = RiskLevel.MEDIUM

        # Estimate completion time
        plan.estimated_completion = self._estimate_completion(plan.actions)

        return plan

    async def _create_remediation_action(self, finding: SecurityFinding) -> RemediationAction:
        """Create a remediation action for a finding"""
        # Generate unique ID for finding
        finding_id = f"{finding.scan_type.value}_{hash((finding.title, str(finding.file_path), finding.line_number))}"
        action_id = f"action_{finding_id}"

        # Generate fix
        generated_fix = await self.fix_generator.generate_fix(finding)

        # Assess risk
        risk_level = self.assess_risk(finding)

        # Determine effort level
        effort = self._determine_effort(finding, risk_level)

        action = RemediationAction(
            id=action_id,
            finding_id=finding_id,
            title=f"Fix {finding.scan_type.value}: {finding.title}",
            description=f"Address security finding: {finding.description}",
            risk_level=risk_level,
            estimated_effort=effort,
            generated_fix=generated_fix,
            file_path=finding.file_path,
            line_number=finding.line_number,
        )

        return action

    def _determine_effort(self, finding: SecurityFinding, risk: RiskLevel) -> str:
        """Determine implementation effort"""
        if risk == RiskLevel.CRITICAL:
            return "high"
        elif risk == RiskLevel.HIGH:
            return "medium"
        elif finding.scan_type.value in ["secrets", "sast"]:
            return "medium"
        else:
            return "low"

    def _estimate_completion(self, actions: List[RemediationAction]) -> str:
        """Estimate completion time for all actions"""
        effort_weights = {"low": 1, "medium": 2, "high": 3}
        total_effort = sum(effort_weights.get(a.estimated_effort, 1) for a in actions)

        if total_effort <= 3:
            return "< 1 hour"
        elif total_effort <= 8:
            return "1-2 hours"
        elif total_effort <= 15:
            return "2-4 hours"
        else:
            return "4+ hours"

    async def execute_remediation_plan(self, plan: RemediationPlan) -> Dict[str, Any]:
        """Execute a remediation plan with approval workflow"""
        results = {
            "plan_id": plan.id,
            "total_actions": len(plan.actions),
            "approved": 0,
            "applied": 0,
            "failed": 0,
            "pending_review": 0,
        }

        for action in plan.actions:
            try:
                # Request approval
                approved = await self.approval_workflow.request_approval(action)

                if approved:
                    action.status = RemediationStatus.APPROVED
                    results["approved"] += 1

                    # Apply the fix
                    success = await self._apply_remediation_action(action)
                    if success:
                        action.status = RemediationStatus.APPLIED
                        results["applied"] += 1
                    else:
                        action.status = RemediationStatus.FAILED
                        results["failed"] += 1
                else:
                    action.status = RemediationStatus.READY_FOR_REVIEW
                    results["pending_review"] += 1

            except Exception as e:
                action.status = RemediationStatus.FAILED
                results["failed"] += 1
                print(f"Failed to process action {action.id}: {e}")

        return results

    async def _apply_remediation_action(self, action: RemediationAction) -> bool:
        """Apply a remediation action to the codebase"""
        if not action.generated_fix or not action.file_path:
            return False

        try:
            file_path = Path(action.file_path)

            # Create rollback point
            rollback_data = await self.rollback_manager.create_rollback_point(file_path)
            action.rollback_data = rollback_data
            action.rollback_available = True

            # Apply the fix (for now, append to end of file as comment)
            # In a real implementation, this would use AST manipulation or diff patching
            current_content = file_path.read_text(encoding="utf-8") if file_path.exists() else ""

            # Add fix as comment block
            fix_comment = f"""
# SMITHY SECURITY FIX - {action.title}
# Applied: {datetime.now().isoformat()}
# Risk Level: {action.risk_level.value}
# Original Finding: {action.description}
{action.generated_fix}
# END SECURITY FIX
"""

            new_content = current_content + "\n" + fix_comment
            file_path.write_text(new_content, encoding="utf-8")

            action.applied_at = datetime.now()
            return True

        except Exception as e:
            print(f"Failed to apply remediation action: {e}")
            return False
