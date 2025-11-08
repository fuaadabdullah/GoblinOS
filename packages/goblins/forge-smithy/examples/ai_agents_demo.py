#!/usr/bin/env python3
"""
Example usage of Smithy AI Agent Framework with CrewAI and LangGraph

This script demonstrates how to create and orchestrate AI-powered agents
for automated tasks using the smithy automation framework.
"""

import asyncio
import importlib.util
import os

from smithy.automation import (
    AgentCapability,
    AgentOrchestrator,
    AgentRole,
    AgentTask,
    AIModelConfig,
    CrewAIAgent,
    InfrastructureAgent,
    PerformanceAgent,
    QualityAgent,
    SecurityAgent,
)


async def main():
    """Main demonstration function."""
    print("🚀 Smithy AI Agent Framework Demo")
    print("=" * 50)

    # Initialize orchestrator
    orchestrator = AgentOrchestrator()

    # Create AI model configurations (using environment variables for API keys)
    openai_config = AIModelConfig(
        provider="openai",
        model_name="gpt-4",
        api_key=os.getenv("OPENAI_API_KEY"),
        temperature=0.7,
    )

    # Create specialized agents
    print("\n🤖 Creating AI-powered agents...")

    # CrewAI-powered Security Agent
    security_agent = CrewAIAgent(
        agent_id="crewai_security_1",
        role=AgentRole.SECURITY,
        capabilities=[
            AgentCapability.VULNERABILITY_SCANNING,
            AgentCapability.SECRETS_DETECTION,
            AgentCapability.COMPLIANCE_CHECKING,
            AgentCapability.THREAT_ANALYSIS,
        ],
        model_config=openai_config,
        system_prompt="You are an expert security analyst specializing in code security, vulnerability assessment, and compliance.",
    )

    # CrewAI-powered Performance Agent
    performance_agent = CrewAIAgent(
        agent_id="crewai_performance_1",
        role=AgentRole.PERFORMANCE,
        capabilities=[
            AgentCapability.CODE_OPTIMIZATION,
            AgentCapability.PERFORMANCE_MONITORING,
            AgentCapability.BOTTLENECK_IDENTIFICATION,
            AgentCapability.RESOURCE_ANALYSIS,
        ],
        model_config=openai_config,
        system_prompt="You are a performance optimization expert focusing on code efficiency, system monitoring, and bottleneck identification.",
    )

    # Basic agents (fallback when CrewAI not available)
    quality_agent = QualityAgent("quality_1")
    infra_agent = InfrastructureAgent("infra_1")

    # Register agents with orchestrator
    await orchestrator.register_agent(security_agent)
    await orchestrator.register_agent(performance_agent)
    await orchestrator.register_agent(quality_agent)
    await orchestrator.register_agent(infra_agent)

    print(f"✅ Registered {len(orchestrator.agents)} agents")

    # Start all agents
    await orchestrator.start_all_agents()
    print("✅ All agents started")

    # Create sample tasks
    tasks = [
        AgentTask(
            id="security_audit_001",
            title="Security Code Review",
            description="Perform comprehensive security audit of the authentication module, checking for vulnerabilities, secrets exposure, and compliance issues.",
            domain="security",
            priority=4,
            context={"module": "auth", "lines_of_code": 500},
        ),
        AgentTask(
            id="performance_optimization_001",
            title="Database Query Optimization",
            description="Analyze and optimize slow database queries in the user management system. Identify bottlenecks and suggest improvements.",
            domain="performance",
            priority=3,
            context={"system": "user_mgmt", "query_count": 25},
        ),
        AgentTask(
            id="quality_assessment_001",
            title="Code Quality Analysis",
            description="Review code quality metrics, run static analysis, and generate improvement recommendations for the API layer.",
            domain="quality",
            priority=2,
            context={"component": "api_layer", "files": 15},
        ),
        AgentTask(
            id="infrastructure_scaling_001",
            title="Auto-scaling Configuration",
            description="Design and implement auto-scaling policies for the web application based on current load patterns and performance metrics.",
            domain="infrastructure",
            priority=4,
            context={"app": "web_app", "current_load": "75%"},
        ),
    ]

    print(f"\n📋 Submitting {len(tasks)} tasks for execution...")

    # Submit tasks for execution
    task_ids = []
    for task in tasks:
        task_id = await orchestrator.submit_task(task)
        task_ids.append(task_id)
        print(f"📝 Submitted task: {task.title} (ID: {task_id})")

    # Wait for tasks to complete (with timeout)
    print("\n⏳ Waiting for task completion...")
    await asyncio.sleep(5)  # Allow time for async execution

    # Check task statuses
    print("\n📊 Task Status Report:")
    print("-" * 30)

    for task_id in task_ids:
        status = await orchestrator.get_task_status(task_id)
        if status:
            print(f"Task {task_id}: {status['status']} - Agents: {len(status['assigned_agents'])}")
        else:
            print(f"Task {task_id}: Completed")

    # Get agent performance metrics
    print("\n📈 Agent Performance Metrics:")
    print("-" * 35)

    agents_info = await orchestrator.list_agents()
    for agent_info in agents_info:
        metrics = agent_info["performance"]
        print(f"{agent_info['id']} ({agent_info['role']}):")
        print(f"  Tasks completed: {metrics['tasks_completed']}")
        print(".1f")
        print(".2f")
        print()

    # Cleanup
    await orchestrator.stop_all_agents()
    print("🛑 All agents stopped")
    print("\n🎉 Demo completed successfully!")


async def simple_fallback_demo():
    """Simple demo using basic agents when CrewAI is not available."""
    print("🔧 Smithy Basic Agent Framework Demo (Fallback Mode)")
    print("=" * 55)

    orchestrator = AgentOrchestrator()

    # Create basic agents
    security_agent = SecurityAgent("security_basic")
    performance_agent = PerformanceAgent("performance_basic")
    quality_agent = QualityAgent("quality_basic")
    infra_agent = InfrastructureAgent("infra_basic")

    # Register agents
    await orchestrator.register_agent(security_agent)
    await orchestrator.register_agent(performance_agent)
    await orchestrator.register_agent(quality_agent)
    await orchestrator.register_agent(infra_agent)

    # Start agents
    await orchestrator.start_all_agents()

    # Simple task
    task = AgentTask(
        id="basic_security_check",
        title="Basic Security Check",
        description="Perform basic security analysis on sample code.",
        domain="security",
        priority=2,
    )

    print("📝 Executing basic security task...")
    task_id = await orchestrator.submit_task(task)

    # Wait and check status
    await asyncio.sleep(2)
    status = await orchestrator.get_task_status(task_id)
    print(f"Task status: {status}")

    await orchestrator.stop_all_agents()
    print("✅ Basic demo completed!")


if __name__ == "__main__":
    crewai_available = importlib.util.find_spec("crewai") is not None
    if crewai_available:
        asyncio.run(main())
    else:
        print("⚠️  CrewAI not available, running basic demo...")
        asyncio.run(simple_fallback_demo())
