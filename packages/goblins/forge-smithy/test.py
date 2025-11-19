"""
Test script for Forge Smithy Goblin
"""

import asyncio
import json
from pathlib import Path

from goblinos.interface import GoblinConfig, GoblinContext
from src.goblin import ForgeSmithyGoblin


async def test_forge_smithy_goblin():
    """Test the Forge Smithy Goblin functionality."""
    print("🧪 Testing Forge Smithy Goblin...")

    # Create goblin instance
    goblin = ForgeSmithyGoblin()

    # Initialize
    config = GoblinConfig(
        id="test-smithy",
        config={"environment": "development", "python_version": "3.10"},
        working_dir=str(Path(__file__).parent.parent),
    )

    print("🔧 Initializing goblin...")
    await goblin.initialize(config)

    # Get capabilities
    capabilities = goblin.get_capabilities()
    print(f"📋 Capabilities: {capabilities.name} v{capabilities.version}")
    print(f"📝 Description: {capabilities.description}")

    # Test doctor command
    print("\n🔍 Testing doctor command...")
    context = GoblinContext(input={"command": "doctor"})

    result = await goblin.execute(context)
    print(f"✅ Success: {result.success}")
    print(
        f"📊 Result: {json.dumps(result.output.model_dump() if result.output else None, indent=2)}"
    )

    # Test check command
    print("\n🧹 Testing check command...")
    context = GoblinContext(input={"command": "check"})

    result = await goblin.execute(context)
    print(f"✅ Success: {result.success}")
    if result.output:
        print(f"📊 Result: {json.dumps(result.output.model_dump(), indent=2)}")

    # Shutdown
    print("\n🔌 Shutting down goblin...")
    await goblin.shutdown()

    print("✅ All tests completed!")


if __name__ == "__main__":
    asyncio.run(test_forge_smithy_goblin())
