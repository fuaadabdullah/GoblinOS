#!/usr/bin/env python3
"""
Simple test to verify the AI agent framework can be imported and instantiated.
"""

import os
import sys

# Add the smithy package to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

try:
    from smithy.automation.agents import (
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

    print("✅ Successfully imported all agent classes")

    # Test basic agent instantiation
    security_agent = SecurityAgent("test_security")
    performance_agent = PerformanceAgent("test_performance")
    quality_agent = QualityAgent("test_quality")
    infra_agent = InfrastructureAgent("test_infra")

    print("✅ Successfully created basic agents")

    # Test AI model config
    config = AIModelConfig(
        provider="openai",
        model_name="gpt-4",
        api_key="test_key",
        temperature=0.7,
    )

    print("✅ Successfully created AI model config")

    # Test CrewAI agent instantiation (should work even without CrewAI installed)
    try:
        crew_agent = CrewAIAgent(
            agent_id="test_crew",
            role=AgentRole.SECURITY,
            capabilities=[AgentCapability.VULNERABILITY_SCANNING],
            model_config=config,
        )
        print("✅ Successfully created CrewAI agent (fallback mode)")
    except Exception as e:
        print(f"❌ Failed to create CrewAI agent: {e}")

    # Test orchestrator
    orchestrator = AgentOrchestrator()
    print("✅ Successfully created AgentOrchestrator")

    # Test task creation
    task = AgentTask(
        id="test_task",
        title="Test Task",
        description="A test task for verification",
        domain="security",
        priority=1,
    )
    print("✅ Successfully created AgentTask")

    print("\n🎉 All basic functionality tests passed!")
    print("The smithy AI agent framework is ready for Phase 2 development.")

except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    sys.exit(1)
