#!/usr/bin/env python3
"""
Test script for PolicyEngine integration with compliance automation
"""

import asyncio
import sys
from pathlib import Path

# Add the smithy package to the path
sys.path.insert(0, str(Path(__file__).parent))

from smithy.automation.policy_engine_integration import demonstrate_compliance_automation


async def main():
    """Run the compliance automation demonstration"""
    try:
        print("🚀 Starting PolicyEngine Integration Test")
        print("=" * 50)

        result = await demonstrate_compliance_automation()

        print("\n✅ Test completed successfully!")
        print("=" * 50)
        print("📊 Results:")
        for key, value in result.items():
            if key == "dashboard_data":
                print(f"  {key}: {value['overview']}")
            else:
                print(f"  {key}: {value}")

        return True

    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
