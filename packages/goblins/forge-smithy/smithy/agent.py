"""CrewAI and LangGraph agent integration for Smithy."""

from typing import Dict, Any, Optional, List

try:
    from crewai import Agent, Task, Crew  # type: ignore
    from langgraph import StateGraph  # type: ignore
    CREWAI_AVAILABLE = True
except ImportError:
    CREWAI_AVAILABLE = False
    Agent = None  # type: ignore
    Task = None  # type: ignore
    Crew = None  # type: ignore
    StateGraph = None  # type: ignore

from .config import settings


class SmithyAgent:
    """Smithy agent for environment management using CrewAI/LangGraph."""

    def __init__(self):
        if not CREWAI_AVAILABLE:
            raise ImportError("CrewAI and LangGraph are required for agent functionality. Install with: uv sync --extra agent")

        self.agents = {}
        self.workflows = {}
        self._setup_agents()

    def _setup_agents(self):
        """Initialize CrewAI agents for different smithy tasks."""
        if not CREWAI_AVAILABLE or Agent is None:
            return

        # Environment Doctor Agent
        self.agents['doctor'] = Agent(  # type: ignore
            role='Environment Diagnostician',
            goal='Analyze development environment and identify issues',
            backstory='You are an expert at diagnosing development environment problems and providing actionable solutions.',
            allow_delegation=False,
            verbose=settings.verbose
        )

        # Bootstrap Agent
        self.agents['bootstrap'] = Agent(  # type: ignore
            role='Environment Bootstrapper',
            goal='Set up complete development environment with all necessary tools',
            backstory='You specialize in creating reproducible development environments from scratch.',
            allow_delegation=False,
            verbose=settings.verbose
        )

        # Code Quality Agent
        self.agents['quality'] = Agent(  # type: ignore
            role='Code Quality Guardian',
            goal='Ensure code meets high quality standards through linting and testing',
            backstory='You are relentless about code quality and will not compromise on standards.',
            allow_delegation=False,
            verbose=settings.verbose
        )

    def create_doctor_workflow(self) -> Optional[Any]:
        """Create a LangGraph workflow for environment diagnostics."""
        if not CREWAI_AVAILABLE or not StateGraph:
            return None

        def diagnose_environment(state: Dict[str, Any]) -> Dict[str, Any]:
            """Diagnose the current environment."""
            from .doctor import run as doctor_run
            results = doctor_run()
            return {
                **state,
                "diagnosis": results,
                "healthy": len([r for r in results.values() if not r[0]]) == 0
            }

        def generate_report(state: Dict[str, Any]) -> Dict[str, Any]:
            """Generate a diagnostic report."""
            diagnosis = state.get("diagnosis", {})
            healthy = state.get("healthy", False)

            report = f"Environment Health Report\n{'='*30}\n"
            report += f"Overall Status: {'✅ Healthy' if healthy else '❌ Issues Found'}\n\n"

            for tool, (available, info) in diagnosis.items():
                status = "✅" if available else "❌"
                report += f"{status} {tool}: {info}\n"

            return {**state, "report": report}

        workflow = StateGraph(Dict[str, Any])
        workflow.add_node("diagnose", diagnose_environment)
        workflow.add_node("report", generate_report)
        workflow.set_entry_point("diagnose")
        workflow.add_edge("diagnose", "report")

        return workflow.compile()

    def create_bootstrap_workflow(self) -> Optional[Any]:
        """Create a LangGraph workflow for environment bootstrapping."""
        if not CREWAI_AVAILABLE or not StateGraph:
            return None

        def check_requirements(state: Dict[str, Any]) -> Dict[str, Any]:
            """Check if bootstrap requirements are met."""
            from .doctor import run as doctor_run
            results = doctor_run()
            missing = [tool for tool, (available, _) in results.items() if not available]
            return {**state, "missing_tools": missing, "can_bootstrap": len(missing) == 0}

        def bootstrap_environment(state: Dict[str, Any]) -> Dict[str, Any]:
            """Bootstrap the environment."""
            if not state.get("can_bootstrap", False):
                return {**state, "bootstrap_success": False, "error": "Missing required tools"}

            try:
                from .bootstrap import run as bootstrap_run
                bootstrap_run(dev=True)
                return {**state, "bootstrap_success": True}
            except Exception as e:
                return {**state, "bootstrap_success": False, "error": str(e)}

        def verify_bootstrap(state: Dict[str, Any]) -> Dict[str, Any]:
            """Verify bootstrap was successful."""
            success = state.get("bootstrap_success", False)
            if success:
                # Re-run doctor to verify
                from .doctor import run as doctor_run
                results = doctor_run()
                still_missing = [tool for tool, (available, _) in results.items() if not available]
                return {**state, "verification_passed": len(still_missing) == 0, "remaining_issues": still_missing}
            return {**state, "verification_passed": False}

        workflow = StateGraph(Dict[str, Any])
        workflow.add_node("check_reqs", check_requirements)
        workflow.add_node("bootstrap", bootstrap_environment)
        workflow.add_node("verify", verify_bootstrap)
        workflow.set_entry_point("check_reqs")
        workflow.add_edge("check_reqs", "bootstrap")
        workflow.add_edge("bootstrap", "verify")

        return workflow.compile()

    async def run_doctor_crew(self) -> Dict[str, Any]:
        """Run environment diagnostics using CrewAI."""
        if not CREWAI_AVAILABLE or 'doctor' not in self.agents or Task is None or Crew is None:
            return {"error": "CrewAI not available or agent not initialized"}

        doctor_task = Task(  # type: ignore
            description="Diagnose the current development environment and identify any missing tools or configuration issues.",
            agent=self.agents['doctor'],
            expected_output="A comprehensive report of environment health with specific recommendations for fixes."
        )

        crew = Crew(  # type: ignore
            agents=[self.agents['doctor']],
            tasks=[doctor_task],
            verbose=settings.verbose
        )

        result = await crew.kickoff_async()
        return {"diagnosis": str(result), "agent_used": "doctor"}

    async def run_bootstrap_crew(self) -> Dict[str, Any]:
        """Run environment bootstrapping using CrewAI."""
        if not CREWAI_AVAILABLE or 'bootstrap' not in self.agents or Task is None or Crew is None:
            return {"error": "CrewAI not available or agent not initialized"}

        bootstrap_task = Task(  # type: ignore
            description="Bootstrap a complete development environment including virtual environment, dependencies, and development tools.",
            agent=self.agents['bootstrap'],
            expected_output="Confirmation that the environment has been successfully bootstrapped with all necessary tools."
        )

        crew = Crew(  # type: ignore
            agents=[self.agents['bootstrap']],
            tasks=[bootstrap_task],
            verbose=settings.verbose
        )

        result = await crew.kickoff_async()
        return {"bootstrap_result": str(result), "agent_used": "bootstrap"}

    async def run_quality_crew(self) -> Dict[str, Any]:
        """Run code quality checks using CrewAI."""
        if not CREWAI_AVAILABLE or 'quality' not in self.agents or Task is None or Crew is None:
            return {"error": "CrewAI not available or agent not initialized"}

        quality_task = Task(  # type: ignore
            description="Run comprehensive code quality checks including linting, type checking, and testing.",
            agent=self.agents['quality'],
            expected_output="A detailed report of code quality metrics and any issues that need to be addressed."
        )

        crew = Crew(  # type: ignore
            agents=[self.agents['quality']],
            tasks=[quality_task],
            verbose=settings.verbose
        )

        result = await crew.kickoff_async()
        return {"quality_report": str(result), "agent_used": "quality"}

    def list_agents(self) -> List[str]:
        """List available agents."""
        return list(self.agents.keys())

    def get_agent_info(self, agent_name: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific agent."""
        if agent_name not in self.agents:
            return None

        agent = self.agents[agent_name]
        return {
            "name": agent_name,
            "role": agent.role,
            "goal": agent.goal,
            "backstory": agent.backstory
        }


# Global agent instance
_agent_instance: Optional[SmithyAgent] = None

def get_smithy_agent() -> SmithyAgent:
    """Get or create the global Smithy agent instance."""
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = SmithyAgent()
    return _agent_instance
