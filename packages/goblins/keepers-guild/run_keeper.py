#!/usr/bin/env python3
"""
Keepers Guild CLI wrapper for GoblinOS integration.
"""

import asyncio
import sys
from keepers_guild.goblin import KeepersGuildGoblin
from goblinos.interface import GoblinConfig, GoblinContext


async def main():
    if len(sys.argv) < 2:
        print("Usage: python run_keeper.py <command>")
        print("Commands: secrets:audit, security:scan, storage:cleanup, system:clean")
        return

    command = sys.argv[1]
    goblin = KeepersGuildGoblin()

    try:
        # Initialize
        config = GoblinConfig(id=f"keepers-{command.replace(':', '-')}")
        await goblin.initialize(config)

        # Execute
        context = GoblinContext(input=command)
        result = await goblin.execute(context)

        # Report result
        if result.success:
            print("✅ Success")
            if result.output:
                print(f"Output: {result.output}")
        else:
            print(f"❌ Failed: {result.error}")
            sys.exit(1)

    finally:
        await goblin.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
