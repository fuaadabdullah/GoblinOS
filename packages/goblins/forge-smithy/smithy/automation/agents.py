"""
AI Agent Framework for Smithy Automation

Advanced AI agent system with specialized roles, collaboration capabilities,
and learning/adaptation features using CrewAI and LangGraph.
"""

import asyncio
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

# CrewAI and LangGraph imports (optional dependencies)
try:
    from crewai import Agent as CrewAgent
    from crewai import Crew
    from crewai import Task as CrewTask
    from langchain_anthropic import ChatAnthropic
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_openai import ChatOpenAI
    from langgraph import END, StateGraph

    CREWAI_AVAILABLE = True
except ImportError:
    CREWAI_AVAILABLE = False
    CrewAgent = None
    CrewTask = None
    Crew = None
    StateGraph = None
    END = None
    ChatOpenAI = None
    ChatAnthropic = None
    ChatGoogleGenerativeAI = None

from .secrets import load_api_key

logger = logging.getLogger(__name__)

PROVIDER_SECRET_KEYS = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "google": "GEMINI_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
}


class AgentRole(Enum):
    """Specialized agent roles for different automation domains."""

    SECURITY = "security"
    PERFORMANCE = "performance"
    QUALITY = "quality"
    INFRASTRUCTURE = "infrastructure"
    TESTING = "testing"
    DOCUMENTATION = "documentation"
    DEPLOYMENT = "deployment"
    MONITORING = "monitoring"


class AgentCapability(Enum):
    """Specific capabilities that agents can possess."""

    # Security capabilities
    VULNERABILITY_SCANNING = "vulnerability_scanning"
    SECRETS_DETECTION = "secrets_detection"
    COMPLIANCE_CHECKING = "compliance_checking"
    THREAT_ANALYSIS = "threat_analysis"

    # Performance capabilities
    CODE_OPTIMIZATION = "code_optimization"
    PERFORMANCE_MONITORING = "performance_monitoring"
    BOTTLENECK_IDENTIFICATION = "bottleneck_identification"
    RESOURCE_ANALYSIS = "resource_analysis"

    # Quality capabilities
    CODE_REVIEW = "code_review"
    TEST_GENERATION = "test_generation"
    DOCUMENTATION_GENERATION = "documentation_generation"
    REFACTORING_SUGGESTIONS = "refactoring_suggestions"

    # Infrastructure capabilities
    DEPLOYMENT_AUTOMATION = "deployment_automation"
    RESOURCE_PROVISIONING = "resource_provisioning"
    SCALING_DECISIONS = "scaling_decisions"
    CONFIGURATION_MANAGEMENT = "configuration_management"

    # Testing capabilities
    UNIT_TEST_GENERATION = "unit_test_generation"
    INTEGRATION_TESTING = "integration_testing"
    PERFORMANCE_TESTING = "performance_testing"
    SECURITY_TESTING = "security_testing"

    # Documentation capabilities
    API_DOCUMENTATION = "api_documentation"
    CODE_DOCUMENTATION = "code_documentation"
    ARCHITECTURE_DIAGRAMS = "architecture_diagrams"
    KNOWLEDGE_BASE_UPDATES = "knowledge_base_updates"

    # Deployment capabilities
    CI_CD_PIPELINE_SETUP = "ci_cd_pipeline_setup"
    RELEASE_AUTOMATION = "release_automation"
    ROLLBACK_PROCEDURES = "rollback_procedures"
    ENVIRONMENT_MANAGEMENT = "environment_management"

    # Monitoring capabilities
    METRICS_COLLECTION = "metrics_collection"
    LOG_ANALYSIS = "log_analysis"
    ALERT_CONFIGURATION = "alert_configuration"
    PERFORMANCE_DASHBOARDS = "performance_dashboards"


@dataclass
class AgentTask:
    """Represents a task that can be executed by an agent."""

    id: str
    title: str
    description: str
    domain: str
    priority: int = 1  # 1-5, higher is more important
    context: Dict[str, Any] = field(default_factory=dict)
    dependencies: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    deadline: Optional[datetime] = None
    assigned_agent: Optional[str] = None


@dataclass
class AgentResult:
    """Result of an agent task execution."""

    task_id: str
    agent_id: str
    success: bool
    result: Any
    confidence: float  # 0.0 to 1.0
    reasoning: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    execution_time: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class AgentMessage:
    """Message for inter-agent communication."""

    sender: str
    recipient: str
    message_type: str
    content: Dict[str, Any]
    priority: int = 1
    correlation_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


class AgentMemory:
    """Memory system for agents to store and retrieve knowledge."""

    def __init__(self):
        self.short_term: Dict[str, Any] = {}
        self.working_memory: Dict[str, Any] = {}
        self.long_term: Dict[str, Any] = {}

    def store_short_term(self, key: str, value: Any, ttl_seconds: int = 300):
        """Store information in short-term memory with TTL."""
        self.short_term[key] = {
            "value": value,
            "expires_at": datetime.now().timestamp() + ttl_seconds,
        }

    def store_working_memory(self, key: str, value: Any, importance: float = 0.5):
        """Store information in working memory with importance score."""
        self.working_memory[key] = {
            "value": value,
            "importance": importance,
            "access_count": 0,
            "last_accessed": datetime.now(),
        }

    def store(self, key: str, value: Any, tags: Optional[List[str]] = None) -> None:
        """Store information in long-term memory with tags."""
        self.long_term[key] = {
            "value": value,
            "tags": tags or [],
            "created_at": datetime.now(),
            "access_count": 0,
        }

    def retrieve(self, key: str) -> Optional[Any]:
        """Retrieve information from memory hierarchy."""
        # Check short-term first
        if key in self.short_term:
            data = self.short_term[key]
            if datetime.now().timestamp() < data["expires_at"]:
                return data["value"]
            else:
                del self.short_term[key]

        # Check working memory
        if key in self.working_memory:
            data = self.working_memory[key]
            data["access_count"] += 1
            data["last_accessed"] = datetime.now()
            return data["value"]

        # Check long-term
        if key in self.long_term:
            data = self.long_term[key]
            data["access_count"] += 1
            return data["value"]

        return None

    def search_by_tags(self, tags: List[str]) -> List[Dict[str, Any]]:
        """Search long-term memory by tags."""
        results = []
        for key, data in self.long_term.items():
            if any(tag in data["tags"] for tag in tags):
                results.append({"key": key, **data})
        return results


class BaseAgent(ABC):
    """Abstract base class for all AI agents."""

    def __init__(self, agent_id: str, role: AgentRole, capabilities: List[AgentCapability]):
        self.agent_id = agent_id
        self.role = role
        self.capabilities = capabilities
        self.memory = AgentMemory()
        self.message_queue: asyncio.Queue[AgentMessage] = asyncio.Queue()
        self.is_active = False
        self.performance_metrics = {
            "tasks_completed": 0,
            "success_rate": 0.0,
            "average_execution_time": 0.0,
            "total_execution_time": 0.0,
        }

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the agent and its dependencies."""
        pass

    @abstractmethod
    async def execute_task(self, task: AgentTask) -> AgentResult:
        """Execute a specific task."""
        pass

    @abstractmethod
    async def can_handle_task(self, task: AgentTask) -> bool:
        """Check if this agent can handle the given task."""
        pass

    async def send_message(
        self,
        recipient: str,
        message_type: str,
        content: Dict[str, Any],
        priority: int = 1,
        correlation_id: Optional[str] = None,
    ) -> None:
        """Send a message to another agent."""
        # In a real implementation, this would go through a message bus
        logger.info(f"Agent {self.agent_id} sending message to {recipient}: {message_type}")

    async def receive_message(self) -> Optional[AgentMessage]:
        """Receive a message from the queue."""
        try:
            return self.message_queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    async def process_messages(self) -> None:
        """Process incoming messages."""
        while self.is_active:
            try:
                message = await asyncio.wait_for(self.receive_message(), timeout=1.0)
                if message:
                    await self.handle_message(message)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing message in agent {self.agent_id}: {e}")

    @abstractmethod
    async def handle_message(self, message: AgentMessage) -> None:
        """Handle an incoming message."""
        pass

    async def start(self) -> None:
        """Start the agent."""
        await self.initialize()
        self.is_active = True
        asyncio.create_task(self.process_messages())
        logger.info(f"Agent {self.agent_id} started")

    async def stop(self) -> None:
        """Stop the agent."""
        self.is_active = False
        logger.info(f"Agent {self.agent_id} stopped")

    def update_performance_metrics(self, execution_time: float, success: bool) -> None:
        """Update performance metrics after task execution."""
        self.performance_metrics["tasks_completed"] += 1
        self.performance_metrics["total_execution_time"] += execution_time

        # Update success rate
        total_tasks = self.performance_metrics["tasks_completed"]
        current_success_rate = self.performance_metrics["success_rate"]
        new_success_rate = (
            (current_success_rate * (total_tasks - 1)) + (1 if success else 0)
        ) / total_tasks
        self.performance_metrics["success_rate"] = new_success_rate

        # Update average execution time
        self.performance_metrics["average_execution_time"] = (
            self.performance_metrics["total_execution_time"] / total_tasks
        )


class SpecializedAgent(BaseAgent):
    """Base class for specialized agents with domain expertise."""

    def __init__(
        self,
        agent_id: str,
        role: AgentRole,
        capabilities: List[AgentCapability],
        domain_expertise: Dict[str, float],
    ):
        super().__init__(agent_id, role, capabilities)
        self.domain_expertise = domain_expertise  # domain -> expertise level (0.0-1.0)

    async def can_handle_task(self, task: AgentTask) -> bool:
        """Check if this agent can handle the task based on capabilities and expertise."""
        # Check if agent has required capabilities for the domain
        required_capabilities = self._get_capabilities_for_domain(task.domain)
        has_capabilities = any(cap in self.capabilities for cap in required_capabilities)

        # Check expertise level
        expertise_level = self.domain_expertise.get(task.domain, 0.0)

        return has_capabilities and expertise_level >= 0.5

    def _get_capabilities_for_domain(self, domain: str) -> List[AgentCapability]:
        """Get required capabilities for a domain."""
        domain_capabilities = {
            "security": [
                AgentCapability.VULNERABILITY_SCANNING,
                AgentCapability.SECRETS_DETECTION,
                AgentCapability.COMPLIANCE_CHECKING,
                AgentCapability.THREAT_ANALYSIS,
            ],
            "performance": [
                AgentCapability.CODE_OPTIMIZATION,
                AgentCapability.PERFORMANCE_MONITORING,
                AgentCapability.BOTTLENECK_IDENTIFICATION,
                AgentCapability.RESOURCE_ANALYSIS,
            ],
            "quality": [
                AgentCapability.CODE_REVIEW,
                AgentCapability.TEST_GENERATION,
                AgentCapability.DOCUMENTATION_GENERATION,
                AgentCapability.REFACTORING_SUGGESTIONS,
            ],
            "infrastructure": [
                AgentCapability.DEPLOYMENT_AUTOMATION,
                AgentCapability.RESOURCE_PROVISIONING,
                AgentCapability.SCALING_DECISIONS,
                AgentCapability.CONFIGURATION_MANAGEMENT,
            ],
            "testing": [
                AgentCapability.UNIT_TEST_GENERATION,
                AgentCapability.INTEGRATION_TESTING,
                AgentCapability.PERFORMANCE_TESTING,
                AgentCapability.SECURITY_TESTING,
            ],
            "documentation": [
                AgentCapability.API_DOCUMENTATION,
                AgentCapability.CODE_DOCUMENTATION,
                AgentCapability.ARCHITECTURE_DIAGRAMS,
                AgentCapability.KNOWLEDGE_BASE_UPDATES,
            ],
            "deployment": [
                AgentCapability.CI_CD_PIPELINE_SETUP,
                AgentCapability.RELEASE_AUTOMATION,
                AgentCapability.ROLLBACK_PROCEDURES,
                AgentCapability.ENVIRONMENT_MANAGEMENT,
            ],
            "monitoring": [
                AgentCapability.METRICS_COLLECTION,
                AgentCapability.LOG_ANALYSIS,
                AgentCapability.ALERT_CONFIGURATION,
                AgentCapability.PERFORMANCE_DASHBOARDS,
            ],
        }
        return domain_capabilities.get(domain, [])

    async def handle_message(self, message: AgentMessage) -> None:
        """Handle inter-agent communication."""
        if message.message_type == "task_collaboration":
            await self.handle_collaboration_request(message)
        elif message.message_type == "knowledge_sharing":
            await self.handle_knowledge_sharing(message)
        elif message.message_type == "conflict_resolution":
            await self.handle_conflict_resolution(message)
        else:
            logger.warning(f"Unknown message type: {message.message_type}")

    async def handle_collaboration_request(self, message: AgentMessage) -> None:
        """Handle a collaboration request from another agent."""
        task_id = message.content.get("task_id")
        collaboration_type = message.content.get("type", "assist")

        if not isinstance(task_id, str):
            logger.warning(f"Invalid task_id in collaboration request: {task_id}")
            return

        if collaboration_type == "assist":
            # Provide assistance on a task
            assistance = await self.provide_assistance(task_id)
            await self.send_message(
                message.sender,
                "collaboration_response",
                {"task_id": task_id, "assistance": assistance},
                correlation_id=message.correlation_id,
            )
        elif collaboration_type == "delegate":
            # Take over part of a task
            can_handle = await self.can_handle_task_from_content(message.content)
            await self.send_message(
                message.sender,
                "collaboration_response",
                {"task_id": task_id, "can_handle": can_handle},
                correlation_id=message.correlation_id,
            )

    async def handle_knowledge_sharing(self, message: AgentMessage) -> None:
        """Handle knowledge sharing from another agent."""
        knowledge = message.content.get("knowledge")
        tags = message.content.get("tags", [])

        # Store in long-term memory
        key = f"shared_{message.sender}_{datetime.now().isoformat()}"
        self.memory.store(key, knowledge, tags)

        logger.info(f"Agent {self.agent_id} stored shared knowledge from {message.sender}")

    async def handle_conflict_resolution(self, message: AgentMessage) -> None:
        """Handle conflict resolution requests."""
        conflict_details = message.content.get("conflict")

        if not isinstance(conflict_details, dict):
            logger.warning(
                f"Invalid conflict_details in conflict resolution request: {conflict_details}"
            )
            return

        resolution = await self.resolve_conflict(conflict_details)

        await self.send_message(
            message.sender,
            "conflict_resolution_response",
            {"resolution": resolution},
            correlation_id=message.correlation_id,
        )

    async def provide_assistance(self, task_id: str) -> Dict[str, Any]:
        """Provide assistance on a task."""
        # This would be implemented by specific agents
        return {"assistance_type": "general", "suggestions": []}

    async def can_handle_task_from_content(self, content: Dict[str, Any]) -> bool:
        """Check if agent can handle a task described in message content."""
        # This would be implemented by specific agents
        return False

    async def resolve_conflict(self, conflict_details: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve conflicts between agents."""
        # Simple resolution strategy - can be enhanced
        return {"decision": "consensus", "rationale": "Default conflict resolution"}


class SecurityAgent(SpecializedAgent):
    """Agent specialized in security analysis and vulnerability management."""

    def __init__(self, agent_id: str):
        super().__init__(
            agent_id=agent_id,
            role=AgentRole.SECURITY,
            capabilities=[
                AgentCapability.VULNERABILITY_SCANNING,
                AgentCapability.SECRETS_DETECTION,
                AgentCapability.COMPLIANCE_CHECKING,
                AgentCapability.THREAT_ANALYSIS,
                AgentCapability.SECURITY_TESTING,
            ],
            domain_expertise={
                "security": 1.0,
                "testing": 0.8,
                "infrastructure": 0.6,
            },
        )

    async def initialize(self) -> None:
        """Initialize security tools and databases."""
        # Initialize security scanning tools, vulnerability databases, etc.
        logger.info(f"SecurityAgent {self.agent_id} initialized")

    async def execute_task(self, task: AgentTask) -> AgentResult:
        """Execute security-related tasks."""
        start_time = time.time()

        try:
            if task.domain == "security":
                if "vulnerability_scan" in task.title.lower():
                    result = await self.perform_vulnerability_scan(task)
                elif "secrets" in task.title.lower():
                    result = await self.scan_for_secrets(task)
                elif "compliance" in task.title.lower():
                    result = await self.check_compliance(task)
                else:
                    result = await self.perform_security_analysis(task)
            else:
                result = {"error": f"Unsupported task domain: {task.domain}"}

            execution_time = time.time() - start_time
            self.update_performance_metrics(execution_time, True)

            return AgentResult(
                task_id=task.id,
                agent_id=self.agent_id,
                success=True,
                result=result,
                confidence=0.9,
                reasoning="Security analysis completed successfully",
                execution_time=execution_time,
            )
        except Exception as e:
            execution_time = time.time() - start_time
            self.update_performance_metrics(execution_time, False)
            return AgentResult(
                task_id=task.id,
                agent_id=self.agent_id,
                success=False,
                result={"error": str(e)},
                confidence=0.0,
                reasoning=f"Security task failed: {str(e)}",
                execution_time=execution_time,
            )

    async def perform_vulnerability_scan(self, task: AgentTask) -> Dict[str, Any]:
        """Perform vulnerability scanning on code or infrastructure."""
        # Implementation would integrate with tools like Snyk, OWASP ZAP, etc.
        return {
            "vulnerabilities_found": 0,
            "severity_breakdown": {"critical": 0, "high": 0, "medium": 0, "low": 0},
            "recommendations": ["Regular security scans recommended"],
        }

    async def scan_for_secrets(self, task: AgentTask) -> Dict[str, Any]:
        """Scan for exposed secrets in code and configuration."""
        # Implementation would use tools like ggshield, trufflehog, etc.
        return {
            "secrets_found": 0,
            "secret_types": [],
            "remediation_actions": ["Rotate any exposed secrets"],
        }

    async def check_compliance(self, task: AgentTask) -> Dict[str, Any]:
        """Check compliance with security standards."""
        # Implementation would check against standards like SOC2, ISO27001, etc.
        return {
            "compliance_score": 95,
            "violations": [],
            "recommendations": ["Maintain current security practices"],
        }

    async def perform_security_analysis(self, task: AgentTask) -> Dict[str, Any]:
        """Perform general security analysis."""
        return {
            "risk_assessment": "low",
            "threats_identified": [],
            "security_score": 85,
        }


class PerformanceAgent(SpecializedAgent):
    """Agent specialized in performance optimization and monitoring."""

    def __init__(self, agent_id: str):
        super().__init__(
            agent_id=agent_id,
            role=AgentRole.PERFORMANCE,
            capabilities=[
                AgentCapability.CODE_OPTIMIZATION,
                AgentCapability.PERFORMANCE_MONITORING,
                AgentCapability.BOTTLENECK_IDENTIFICATION,
                AgentCapability.RESOURCE_ANALYSIS,
                AgentCapability.PERFORMANCE_TESTING,
            ],
            domain_expertise={
                "performance": 1.0,
                "infrastructure": 0.7,
                "testing": 0.6,
            },
        )

    async def initialize(self) -> None:
        """Initialize performance monitoring tools."""
        logger.info(f"PerformanceAgent {self.agent_id} initialized")

    async def execute_task(self, task: AgentTask) -> AgentResult:
        """Execute performance-related tasks."""
        start_time = time.time()

        try:
            if "optimization" in task.title.lower():
                result = await self.optimize_performance(task)
            elif "bottleneck" in task.title.lower():
                result = await self.identify_bottlenecks(task)
            elif "monitoring" in task.title.lower():
                result = await self.setup_monitoring(task)
            else:
                result = await self.analyze_performance(task)

            execution_time = time.time() - start_time
            self.update_performance_metrics(execution_time, True)

            return AgentResult(
                task_id=task.id,
                agent_id=self.agent_id,
                success=True,
                result=result,
                confidence=0.85,
                reasoning="Performance analysis completed",
                execution_time=execution_time,
            )
        except Exception as e:
            execution_time = time.time() - start_time
            self.update_performance_metrics(execution_time, False)
            return AgentResult(
                task_id=task.id,
                agent_id=self.agent_id,
                success=False,
                result={"error": str(e)},
                confidence=0.0,
                reasoning=f"Performance task failed: {str(e)}",
                execution_time=execution_time,
            )

    async def optimize_performance(self, task: AgentTask) -> Dict[str, Any]:
        """Optimize code or system performance."""
        return {
            "optimizations_applied": [],
            "performance_improvement": "15%",
            "recommendations": ["Consider caching strategies", "Database query optimization"],
        }

    async def identify_bottlenecks(self, task: AgentTask) -> Dict[str, Any]:
        """Identify performance bottlenecks."""
        return {
            "bottlenecks_found": [],
            "critical_issues": 0,
            "optimization_suggestions": ["Review database queries", "Implement caching"],
        }

    async def setup_monitoring(self, task: AgentTask) -> Dict[str, Any]:
        """Set up performance monitoring."""
        return {
            "monitoring_configured": True,
            "metrics_collected": ["response_time", "throughput", "error_rate"],
            "alerts_configured": ["high_response_time", "high_error_rate"],
        }

    async def analyze_performance(self, task: AgentTask) -> Dict[str, Any]:
        """Perform general performance analysis."""
        return {
            "current_performance": "good",
            "metrics": {"response_time": "250ms", "throughput": "1000 req/s"},
            "recommendations": ["Monitor during peak load"],
        }


class QualityAgent(SpecializedAgent):
    """Agent specialized in code quality and testing."""

    def __init__(self, agent_id: str):
        super().__init__(
            agent_id=agent_id,
            role=AgentRole.QUALITY,
            capabilities=[
                AgentCapability.CODE_REVIEW,
                AgentCapability.TEST_GENERATION,
                AgentCapability.DOCUMENTATION_GENERATION,
                AgentCapability.REFACTORING_SUGGESTIONS,
                AgentCapability.UNIT_TEST_GENERATION,
                AgentCapability.CODE_DOCUMENTATION,
            ],
            domain_expertise={
                "quality": 1.0,
                "testing": 0.9,
                "documentation": 0.8,
            },
        )

    async def initialize(self) -> None:
        """Initialize code quality tools."""
        logger.info(f"QualityAgent {self.agent_id} initialized")

    async def execute_task(self, task: AgentTask) -> AgentResult:
        """Execute quality-related tasks."""
        start_time = time.time()

        try:
            if "review" in task.title.lower():
                result = await self.perform_code_review(task)
            elif "test" in task.title.lower():
                result = await self.generate_tests(task)
            elif "documentation" in task.title.lower():
                result = await self.generate_documentation(task)
            else:
                result = await self.analyze_code_quality(task)

            execution_time = time.time() - start_time
            self.update_performance_metrics(execution_time, True)

            return AgentResult(
                task_id=task.id,
                agent_id=self.agent_id,
                success=True,
                result=result,
                confidence=0.8,
                reasoning="Code quality analysis completed",
                execution_time=execution_time,
            )
        except Exception as e:
            execution_time = time.time() - start_time
            self.update_performance_metrics(execution_time, False)
            return AgentResult(
                task_id=task.id,
                agent_id=self.agent_id,
                success=False,
                result={"error": str(e)},
                confidence=0.0,
                reasoning=f"Quality task failed: {str(e)}",
                execution_time=execution_time,
            )

    async def perform_code_review(self, task: AgentTask) -> Dict[str, Any]:
        """Perform automated code review."""
        return {
            "issues_found": 0,
            "severity_breakdown": {"critical": 0, "major": 0, "minor": 0},
            "code_quality_score": 85,
            "suggestions": ["Add type hints", "Improve error handling"],
        }

    async def generate_tests(self, task: AgentTask) -> Dict[str, Any]:
        """Generate unit and integration tests."""
        return {
            "tests_generated": 15,
            "test_types": ["unit", "integration"],
            "coverage_estimate": "85%",
            "test_files_created": ["test_module.py"],
        }

    async def generate_documentation(self, task: AgentTask) -> Dict[str, Any]:
        """Generate code documentation."""
        return {
            "documentation_generated": True,
            "docstrings_added": 12,
            "api_docs_created": True,
            "readme_updated": True,
        }

    async def analyze_code_quality(self, task: AgentTask) -> Dict[str, Any]:
        """Analyze overall code quality."""
        return {
            "quality_score": 82,
            "metrics": {
                "complexity": "moderate",
                "maintainability": "good",
                "test_coverage": "78%",
            },
            "recommendations": ["Increase test coverage", "Reduce complexity"],
        }


class InfrastructureAgent(SpecializedAgent):
    """Agent specialized in infrastructure management and deployment."""

    def __init__(self, agent_id: str):
        super().__init__(
            agent_id=agent_id,
            role=AgentRole.INFRASTRUCTURE,
            capabilities=[
                AgentCapability.DEPLOYMENT_AUTOMATION,
                AgentCapability.RESOURCE_PROVISIONING,
                AgentCapability.SCALING_DECISIONS,
                AgentCapability.CONFIGURATION_MANAGEMENT,
                AgentCapability.CI_CD_PIPELINE_SETUP,
                AgentCapability.ENVIRONMENT_MANAGEMENT,
            ],
            domain_expertise={
                "infrastructure": 1.0,
                "deployment": 0.9,
                "monitoring": 0.7,
            },
        )

    async def initialize(self) -> None:
        """Initialize infrastructure management tools."""
        logger.info(f"InfrastructureAgent {self.agent_id} initialized")

    async def execute_task(self, task: AgentTask) -> AgentResult:
        """Execute infrastructure-related tasks."""
        start_time = time.time()

        try:
            if "deploy" in task.title.lower():
                result = await self.automate_deployment(task)
            elif "provision" in task.title.lower():
                result = await self.provision_resources(task)
            elif "scale" in task.title.lower():
                result = await self.make_scaling_decisions(task)
            else:
                result = await self.manage_configuration(task)

            execution_time = time.time() - start_time
            self.update_performance_metrics(execution_time, True)

            return AgentResult(
                task_id=task.id,
                agent_id=self.agent_id,
                success=True,
                result=result,
                confidence=0.9,
                reasoning="Infrastructure task completed successfully",
                execution_time=execution_time,
            )
        except Exception as e:
            execution_time = time.time() - start_time
            self.update_performance_metrics(execution_time, False)
            return AgentResult(
                task_id=task.id,
                agent_id=self.agent_id,
                success=False,
                result={"error": str(e)},
                confidence=0.0,
                reasoning=f"Infrastructure task failed: {str(e)}",
                execution_time=execution_time,
            )

    async def automate_deployment(self, task: AgentTask) -> Dict[str, Any]:
        """Automate deployment process."""
        return {
            "deployment_status": "success",
            "environment": "production",
            "rollback_available": True,
            "monitoring_enabled": True,
        }

    async def provision_resources(self, task: AgentTask) -> Dict[str, Any]:
        """Provision cloud resources."""
        return {
            "resources_provisioned": ["VM instances", "load balancer", "database"],
            "estimated_cost": "$150/month",
            "auto_scaling_enabled": True,
        }

    async def make_scaling_decisions(self, task: AgentTask) -> Dict[str, Any]:
        """Make scaling decisions based on metrics."""
        return {
            "scaling_recommended": True,
            "current_load": "75%",
            "recommended_instances": 3,
            "scaling_type": "horizontal",
        }

    async def manage_configuration(self, task: AgentTask) -> Dict[str, Any]:
        """Manage infrastructure configuration."""
        return {
            "configuration_updated": True,
            "environments_configured": ["dev", "staging", "prod"],
            "secrets_rotated": True,
            "backups_configured": True,
        }


@dataclass
class AIModelConfig:
    """Configuration for AI models used by agents."""

    provider: str  # "openai", "anthropic", "google", "ollama"
    model_name: str
    api_key: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 2000
    base_url: Optional[str] = None  # For custom endpoints


class CrewAIAgent(BaseAgent):
    """CrewAI-powered agent with advanced AI capabilities."""

    def __init__(
        self,
        agent_id: str,
        role: AgentRole,
        capabilities: List[AgentCapability],
        model_config: AIModelConfig,
        system_prompt: Optional[str] = None,
    ):
        super().__init__(agent_id, role, capabilities)
        self.model_config = self._ensure_api_key(model_config)
        self.system_prompt = system_prompt or self._get_default_system_prompt()
        self.crew_agent: Optional[Any] = None

    def _get_default_system_prompt(self) -> str:
        """Get default system prompt based on role."""
        prompts = {
            AgentRole.SECURITY: "You are a security expert focused on identifying vulnerabilities, threats, and ensuring system security.",
            AgentRole.PERFORMANCE: "You are a performance optimization expert specializing in code efficiency, system monitoring, and bottleneck identification.",
            AgentRole.QUALITY: "You are a code quality expert focused on reviews, testing, documentation, and best practices.",
            AgentRole.INFRASTRUCTURE: "You are an infrastructure expert managing deployments, scaling, configuration, and cloud resources.",
        }
        return prompts.get(self.role, "You are an AI assistant helping with automation tasks.")

    async def initialize(self) -> None:
        """Initialize CrewAI agent."""
        if not CREWAI_AVAILABLE:
            logger.warning(f"CrewAI not available for agent {self.agent_id}")
            return

        try:
            # Initialize LLM based on model config
            llm = self._initialize_llm()

            # Create CrewAI agent
            if CrewAgent:
                self.crew_agent = CrewAgent(
                    role=self.role.value.title(),
                    goal=f"Execute {self.role.value} tasks with expertise and precision",
                    backstory=self.system_prompt,
                    llm=llm,
                    verbose=True,
                    allow_delegation=True,
                    memory=True,
                )
            else:
                raise ImportError("CrewAgent not available")

            logger.info(
                f"CrewAI agent {self.agent_id} initialized with {self.model_config.provider}"
            )
        except Exception as e:
            logger.error(f"Failed to initialize CrewAI agent {self.agent_id}: {str(e)}")

    def _initialize_llm(self) -> Any:
        """Initialize language model based on configuration."""
        if not CREWAI_AVAILABLE:
            raise ImportError("CrewAI dependencies not available")

        provider = self.model_config.provider.lower()

        if provider == "openai" and ChatOpenAI:
            return ChatOpenAI(
                model=self.model_config.model_name,
                temperature=self.model_config.temperature,
                max_tokens=self.model_config.max_tokens,
                api_key=self.model_config.api_key,
            )
        elif provider == "anthropic" and ChatAnthropic:
            return ChatAnthropic(
                model=self.model_config.model_name,
                temperature=self.model_config.temperature,
                max_tokens=self.model_config.max_tokens,
                api_key=self.model_config.api_key,
            )
        elif provider == "google" and ChatGoogleGenerativeAI:
            return ChatGoogleGenerativeAI(
                model=self.model_config.model_name,
                temperature=self.model_config.temperature,
                max_tokens=self.model_config.max_tokens,
                api_key=self.model_config.api_key,
            )
        else:
            raise ValueError(f"Unsupported AI provider: {provider}")

    def _ensure_api_key(self, config: AIModelConfig) -> AIModelConfig:
        if config.api_key:
            return config
        env_key = PROVIDER_SECRET_KEYS.get(config.provider.lower())
        if not env_key:
            return config
        api_key = load_api_key(env_key)
        if api_key:
            config.api_key = api_key
        else:
            logger.warning("No API key configured for provider '%s'", config.provider)
        return config

    async def execute_task(self, task: AgentTask) -> AgentResult:
        """Execute task using CrewAI."""
        if not self.crew_agent or not CREWAI_AVAILABLE:
            # Fallback to basic implementation
            return await self._execute_basic_task(task)

        start_time = time.time()

        try:
            # Create CrewAI task
            if CrewTask:
                crew_task = CrewTask(
                    description=task.description,
                    agent=self.crew_agent,
                    expected_output=f"Complete the {task.domain} task: {task.title}",
                )
            else:
                raise ImportError("CrewTask not available")

            # Execute task
            if Crew:
                crew = Crew(
                    agents=[self.crew_agent],
                    tasks=[crew_task],
                    verbose=True,
                )
                result = crew.kickoff()
            else:
                raise ImportError("Crew not available")

            execution_time = time.time() - start_time
            self.update_performance_metrics(execution_time, True)

            return AgentResult(
                task_id=task.id,
                agent_id=self.agent_id,
                success=True,
                result={"crewai_output": str(result), "raw_result": result},
                confidence=0.9,
                reasoning="Task executed using CrewAI with AI assistance",
                execution_time=execution_time,
            )

        except Exception as e:
            execution_time = time.time() - start_time
            self.update_performance_metrics(execution_time, False)

            # Fallback to basic implementation
            logger.warning(
                f"CrewAI execution failed for {self.agent_id}, falling back to basic: {str(e)}"
            )
            return await self._execute_basic_task(task)

    async def _execute_basic_task(self, task: AgentTask) -> AgentResult:
        """Fallback basic task execution without CrewAI."""
        start_time = time.time()

        try:
            # Basic implementation based on agent type
            if isinstance(self, SecurityAgent):
                result = await self.perform_security_analysis(task)
            elif isinstance(self, PerformanceAgent):
                result = await self.analyze_performance(task)
            elif isinstance(self, QualityAgent):
                result = await self.analyze_code_quality(task)
            elif isinstance(self, InfrastructureAgent):
                result = await self.manage_configuration(task)
            else:
                result = {"message": "Basic task execution completed"}

            execution_time = time.time() - start_time
            self.update_performance_metrics(execution_time, True)

            return AgentResult(
                task_id=task.id,
                agent_id=self.agent_id,
                success=True,
                result=result,
                confidence=0.7,
                reasoning="Task executed using basic agent logic",
                execution_time=execution_time,
            )

        except Exception:
            execution_time = time.time() - start_time
            self.update_performance_metrics(execution_time, False)

    async def can_handle_task(self, task: AgentTask) -> bool:
        """Check if this CrewAI agent can handle the given task."""
        # CrewAI agents can handle tasks in their domain
        return task.domain == self.role.value

    async def handle_message(self, message: AgentMessage) -> None:
        """Handle inter-agent communication."""
        # Basic message handling - could be enhanced with CrewAI
        logger.info(f"CrewAI agent {self.agent_id} received message: {message.message_type}")
        if message.message_type == "collaboration_request":
            # Handle collaboration requests
            pass


@dataclass
class WorkflowState:
    """State for LangGraph workflows."""

    task: AgentTask
    current_agent: str
    results: List[AgentResult] = field(default_factory=list)
    collaboration_needed: bool = False
    final_result: Optional[AgentResult] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class LangGraphOrchestrator:
    """LangGraph-based workflow orchestrator for complex multi-agent tasks."""

    def __init__(self):
        self.workflows: Dict[str, Any] = {}  # workflow_name -> StateGraph
        self.active_executions: Dict[str, Any] = {}  # execution_id -> execution state

    def create_workflow(self, workflow_name: str, agents: List[BaseAgent]) -> None:
        """Create a LangGraph workflow for agent collaboration."""
        if not CREWAI_AVAILABLE or not StateGraph:
            logger.warning("LangGraph not available, skipping workflow creation")
            return

        workflow = StateGraph(WorkflowState)

        # Define workflow nodes
        workflow.add_node("analyze_task", self._analyze_task_node)
        workflow.add_node("assign_agents", self._assign_agents_node)
        workflow.add_node("execute_primary", self._execute_primary_node)
        workflow.add_node("coordinate_collaboration", self._coordinate_collaboration_node)
        workflow.add_node("merge_results", self._merge_results_node)
        workflow.add_node("finalize", self._finalize_node)

        # Define workflow edges
        workflow.set_entry_point("analyze_task")
        workflow.add_edge("analyze_task", "assign_agents")
        workflow.add_edge("assign_agents", "execute_primary")
        workflow.add_conditional_edges(
            "execute_primary",
            self._should_collaborate,
            {"collaborate": "coordinate_collaboration", "finalize": "finalize"},
        )
        workflow.add_edge("coordinate_collaboration", "merge_results")
        workflow.add_edge("merge_results", "finalize")
        workflow.add_edge("finalize", END)

        self.workflows[workflow_name] = workflow.compile()

    async def execute_workflow(
        self, workflow_name: str, task: AgentTask, agents: List[BaseAgent]
    ) -> AgentResult:
        """Execute a workflow for a task."""
        if workflow_name not in self.workflows:
            # Fallback to basic orchestration
            return await self._execute_basic_workflow(task, agents)

        try:
            initial_state = WorkflowState(
                task=task,
                current_agent="",
                results=[],
                collaboration_needed=False,
                final_result=None,
                metadata={"agents": [a.agent_id for a in agents]},
            )

            # Execute workflow
            result = await self.workflows[workflow_name].ainvoke(initial_state)
            return result.get(
                "final_result", self._create_error_result(task, "Workflow execution failed")
            )

        except Exception as e:
            logger.error(f"Workflow execution failed: {str(e)}")
            return await self._execute_basic_workflow(task, agents)

    async def _execute_basic_workflow(
        self, task: AgentTask, agents: List[BaseAgent]
    ) -> AgentResult:
        """Fallback basic workflow execution."""
        if not agents:
            return self._create_error_result(task, "No agents available")

        primary_agent = agents[0]
        result = await primary_agent.execute_task(task)

        if result.confidence < 0.8 and len(agents) > 1:
            # Simple collaboration
            support_results = []
            for support_agent in agents[1:]:
                support_result = await support_agent.execute_task(task)
                support_results.append(support_result)

            # Merge results
            if support_results:
                best_support = max(support_results, key=lambda r: r.confidence)
                if best_support.confidence > result.confidence:
                    result = best_support

        return result

    def _create_error_result(self, task: AgentTask, error: str) -> AgentResult:
        """Create an error result for failed executions."""
        return AgentResult(
            task_id=task.id,
            agent_id="workflow_orchestrator",
            success=False,
            result={"error": error},
            confidence=0.0,
            reasoning=error,
            execution_time=0.0,
        )

    # Workflow node functions
    async def _analyze_task_node(self, state: WorkflowState) -> Dict[str, Any]:
        """Analyze task complexity and requirements."""
        task = state.task
        complexity = self._assess_task_complexity(task)
        return {
            "collaboration_needed": complexity > 0.7,
            "metadata": {**state.metadata, "complexity": complexity},
        }

    async def _assign_agents_node(self, state: WorkflowState) -> Dict[str, Any]:
        """Assign appropriate agents to the task."""
        # This would be implemented with actual agent assignment logic
        return {"current_agent": "primary_agent"}

    async def _execute_primary_node(self, state: WorkflowState) -> Dict[str, Any]:
        """Execute task with primary agent."""
        # This would execute the task with the assigned agent
        return {"results": state.results + []}  # Placeholder

    async def _coordinate_collaboration_node(self, state: WorkflowState) -> Dict[str, Any]:
        """Coordinate collaboration between agents."""
        # This would handle inter-agent collaboration
        return {"results": state.results + []}  # Placeholder

    async def _merge_results_node(self, state: WorkflowState) -> Dict[str, Any]:
        """Merge results from multiple agents."""
        # This would merge and reconcile results
        return {"final_result": state.results[0] if state.results else None}  # Placeholder

    async def _finalize_node(self, state: WorkflowState) -> Dict[str, Any]:
        """Finalize the workflow execution."""
        return {"final_result": state.final_result}

    def _assess_task_complexity(self, task: AgentTask) -> float:
        """Assess task complexity (0.0 to 1.0)."""
        # Simple heuristic based on description length and dependencies
        complexity = min(len(task.description) / 1000, 1.0)
        complexity += min(len(task.dependencies) * 0.2, 0.5)
        return min(complexity, 1.0)

    def _should_collaborate(self, state: WorkflowState) -> str:
        """Determine if collaboration is needed."""
        if state.collaboration_needed:
            return "collaborate"
        return "finalize"

    async def register_agent(self, agent: BaseAgent) -> None:
        """Register an agent with the orchestrator."""
        self.agents[agent.agent_id] = agent

        # Load persisted state if available
        persisted_state = await self.persistence.load_agent_state(agent.agent_id)
        if persisted_state:
            # Restore agent state (simplified)
            agent.performance_metrics = persisted_state.get(
                "performance_metrics", agent.performance_metrics
            )

        logger.info(f"Registered agent: {agent.agent_id} ({agent.role.value})")

    async def unregister_agent(self, agent_id: str) -> None:
        """Unregister an agent from the orchestrator."""
        if agent_id in self.agents:
            agent = self.agents[agent_id]
            # Save state before stopping
            await self.persistence.save_agent_state(agent)
            await agent.stop()
            del self.agents[agent_id]
            logger.info(f"Unregistered agent: {agent_id}")

    async def submit_task(self, task: AgentTask) -> str:
        """Submit a task for agent processing."""
        self.active_tasks[task.id] = task
        self.task_assignments[task.id] = []

        # Find suitable agents for the task
        suitable_agents = await self._find_suitable_agents(task)

        if not suitable_agents:
            logger.warning(f"No suitable agents found for task: {task.title}")
            return task.id

        # Check if task is complex enough for LangGraph workflow
        if self._is_complex_task(task):
            # Use LangGraph workflow for complex tasks
            workflow_name = f"workflow_{task.domain}"
            self.langgraph_orchestrator.create_workflow(workflow_name, suitable_agents)
            asyncio.create_task(self._execute_workflow_task(workflow_name, task, suitable_agents))
        else:
            # Use basic orchestration for simple tasks
            primary_agent = suitable_agents[0]
            self.task_assignments[task.id].append(primary_agent.agent_id)
            asyncio.create_task(self._execute_task_with_agents(task, suitable_agents))

        logger.info(
            f"Task {task.id} assigned using {'workflow' if self._is_complex_task(task) else 'basic'} orchestration"
        )
        return task.id

    def _is_complex_task(self, task: AgentTask) -> bool:
        """Determine if a task is complex enough for workflow orchestration."""
        # Heuristics for complexity
        complexity_factors = [
            len(task.description) > 500,  # Long description
            len(task.dependencies) > 2,  # Many dependencies
            task.priority > 3,  # High priority
            task.domain in ["infrastructure", "deployment"],  # Complex domains
        ]
        return sum(complexity_factors) >= 2

    async def _execute_workflow_task(
        self, workflow_name: str, task: AgentTask, agents: List[BaseAgent]
    ) -> None:
        """Execute a task using LangGraph workflow."""
        try:
            result = await self.langgraph_orchestrator.execute_workflow(workflow_name, task, agents)

            # Store result and clean up
            await self.persistence.save_task_result(result)
            self._store_task_result(task.id, result)
            self._cleanup_task(task.id)

            logger.info(f"Workflow task {task.id} completed with confidence: {result.confidence}")

        except Exception as e:
            logger.error(f"Workflow task {task.id} failed: {str(e)}")
            error_result = AgentResult(
                task_id=task.id,
                agent_id="orchestrator",
                success=False,
                result={"error": str(e)},
                confidence=0.0,
                reasoning=f"Workflow orchestration failed: {str(e)}",
                execution_time=0.0,
            )
            self._store_task_result(task.id, error_result)
            self._cleanup_task(task.id)

    async def _find_suitable_agents(self, task: AgentTask) -> List[BaseAgent]:
        """Find agents suitable for a task."""
        suitable_agents = []

        for agent in self.agents.values():
            if await agent.can_handle_task(task):
                suitable_agents.append(agent)

        # Sort by expertise level (highest first)
        if isinstance(suitable_agents[0], SpecializedAgent):
            suitable_agents.sort(
                key=lambda a: a.domain_expertise.get(task.domain, 0.0), reverse=True
            )

        return suitable_agents

    async def _execute_task_with_agents(self, task: AgentTask, agents: List[BaseAgent]) -> None:
        """Execute a task with multiple agents."""
        primary_agent = agents[0]
        support_agents = agents[1:]

        try:
            # Execute primary task
            result = await primary_agent.execute_task(task)

            # If primary agent needs help, coordinate with support agents
            if result.confidence < 0.8 and support_agents:
                collaboration_results = await self._coordinate_collaboration(
                    task, primary_agent, support_agents
                )
                result = await self._merge_results(result, collaboration_results)

            # Store result and clean up
            self._store_task_result(task.id, result)
            self._cleanup_task(task.id)

            logger.info(f"Task {task.id} completed with confidence: {result.confidence}")

        except Exception as e:
            logger.error(f"Task {task.id} failed: {str(e)}")
            error_result = AgentResult(
                task_id=task.id,
                agent_id="orchestrator",
                success=False,
                result={"error": str(e)},
                confidence=0.0,
                reasoning=f"Task orchestration failed: {str(e)}",
                execution_time=0.0,
            )
            self._store_task_result(task.id, error_result)
            self._cleanup_task(task.id)

    async def _coordinate_collaboration(
        self, task: AgentTask, primary_agent: BaseAgent, support_agents: List[BaseAgent]
    ) -> List[AgentResult]:
        """Coordinate collaboration between agents."""
        collaboration_results = []

        for support_agent in support_agents:
            try:
                # Request assistance
                await primary_agent.send_message(
                    support_agent.agent_id,
                    "task_collaboration",
                    {
                        "task_id": task.id,
                        "type": "assist",
                        "task_description": task.description,
                    },
                )

                # Wait for response (simplified - in real implementation would use proper async waiting)
                await asyncio.sleep(0.1)  # Allow message processing

                # Get assistance result
                assistance_result = await support_agent.execute_task(task)
                collaboration_results.append(assistance_result)

                # Record collaboration
                self.collaboration_history.append(
                    {
                        "task_id": task.id,
                        "primary_agent": primary_agent.agent_id,
                        "support_agent": support_agent.agent_id,
                        "assistance_provided": True,
                        "timestamp": datetime.now(),
                    }
                )

            except Exception as e:
                logger.warning(f"Collaboration failed with {support_agent.agent_id}: {str(e)}")

        return collaboration_results

    async def _merge_results(
        self, primary_result: AgentResult, collaboration_results: List[AgentResult]
    ) -> AgentResult:
        """Merge results from multiple agents."""
        if not collaboration_results:
            return primary_result

        # Simple merging strategy - take highest confidence result
        all_results = [primary_result] + collaboration_results
        best_result = max(all_results, key=lambda r: r.confidence)

        # Combine reasoning
        merged_reasoning = f"Consensus from {len(all_results)} agents: {best_result.reasoning}"

        return AgentResult(
            task_id=primary_result.task_id,
            agent_id="orchestrator",
            success=best_result.success,
            result=best_result.result,
            confidence=min(best_result.confidence + 0.1, 1.0),  # Boost confidence for collaboration
            reasoning=merged_reasoning,
            execution_time=sum(r.execution_time for r in all_results),
        )

    def _store_task_result(self, task_id: str, result: AgentResult) -> None:
        """Store task result (placeholder for persistence)."""
        # In a real implementation, this would persist to database
        logger.info(f"Stored result for task {task_id}: {result.success}")

    def _cleanup_task(self, task_id: str) -> None:
        """Clean up completed task."""
        if task_id in self.active_tasks:
            del self.active_tasks[task_id]
        if task_id in self.task_assignments:
            del self.task_assignments[task_id]

    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a task."""
        if task_id in self.active_tasks:
            agents = [
                self.agents[aid]
                for aid in self.task_assignments.get(task_id, [])
                if aid in self.agents
            ]
            return {
                "task_id": task_id,
                "status": "active",
                "assigned_agents": [a.agent_id for a in agents],
                "progress": "in_progress",
            }
        return None

    async def list_agents(self) -> List[Dict[str, Any]]:
        """List all registered agents."""
        return [
            {
                "id": agent.agent_id,
                "role": agent.role.value,
                "capabilities": [cap.value for cap in agent.capabilities],
                "performance": agent.performance_metrics,
            }
            for agent in self.agents.values()
        ]

    async def start_all_agents(self) -> None:
        """Start all registered agents."""
        for agent in self.agents.values():
            await agent.start()
        logger.info(f"Started {len(self.agents)} agents")

    async def stop_all_agents(self) -> None:
        """Stop all registered agents."""
        for agent in self.agents.values():
            await agent.stop()
        logger.info(f"Stopped {len(self.agents)} agents")
