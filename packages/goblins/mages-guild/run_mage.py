#!/usr/bin/env python3
"""
CLI wrapper for Mages Guild GoblinOS integration.

This script provides a command-line interface to the Mages Guild goblin,
enabling integration with the GoblinOS toolbelt system.
"""

import asyncio
import sys
from pathlib import Path

# Add the src directory to Python path for local development
src_path = Path(__file__).parent / "src"
if src_path.exists():
    sys.path.insert(0, str(src_path))

from goblinos.interface import GoblinConfig, GoblinContext
from mages_guild.goblin import MagesGuildGoblin


async def main():
    """Main CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: python run_mage.py <command>", file=sys.stderr)
        print("\nAvailable commands:")
        print("  quality:lint      - Run quality gate checks")
        print("  quality:full      - Alias for quality:lint")
        print("  vault:validate    - Validate Obsidian vault integrity")
        print("  anomaly:detect    - Detect anomalies in metrics/logs")
        print("  forecast:risk     - Assess release risk")
        print("  docs:update       - Update documentation")
        sys.exit(1)

    command = sys.argv[1]

    # Create goblin configuration
    config = GoblinConfig(
        {
            "repo_root": Path.cwd(),
            "mages_guild": {},  # Will use defaults
        }
    )

    # Initialize goblin
    goblin = MagesGuildGoblin()
    try:
        await goblin.initialize(config)
    except Exception as e:
        print(f"❌ Failed to initialize Mages Guild: {e}", file=sys.stderr)
        sys.exit(1)

    # Execute command
    context = GoblinContext({"command": command})
    try:
        result = await goblin.execute(context)

        # Display result
        if result.success:
            print("✅ Success")
        else:
            print("❌ Failed")
            sys.exit(1)

        # Print summary if available
        if hasattr(result, "message") and result.message:
            print(result.message)

        # Print detailed results if available
        if hasattr(result, "data") and result.data:
            data = result.data
            if isinstance(data, dict):
                if "quality_report" in data and data["quality_report"]:
                    report = data["quality_report"]
                    print(
                        f"Quality Report: {report.get('total_files_checked', 0)} files checked, {len(report.get('issues_found', []))} issues"
                    )

                if "vault_report" in data and data["vault_report"]:
                    report = data["vault_report"]
                    print(
                        f"Vault Report: {report.get('total_files_checked', 0)} files checked, {len(report.get('issues_found', []))} issues"
                    )

                if "anomaly_report" in data and data["anomaly_report"]:
                    report = data["anomaly_report"]
                    print(
                        f"Anomaly Report: {len(report.get('anomalies_detected', []))} anomalies detected"
                    )

                if "risk_assessment" in data and data["risk_assessment"]:
                    assessment = data["risk_assessment"]
                    risk_score = assessment.get("overall_risk_score", 0)
                    print(f"Risk Assessment: {risk_score:.2f} risk score")

    except Exception as e:
        print(f"❌ Command execution failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        # Clean shutdown
        await goblin.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
