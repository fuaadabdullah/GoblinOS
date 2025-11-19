"""
Keepers Guild Goblin - GoblinInterface implementation
"""

import json
from pathlib import Path
from typing import List, Optional

from goblinos.interface import (
    GoblinInterface,
    GoblinConfig,
    GoblinContext,
    GoblinResult,
    GoblinCapabilities,
)

from .logic import KeepersGuildLogic
from .schema import KeepersGuildConfig


class KeepersGuildGoblin(GoblinInterface):
    """Keepers Guild Goblin - Secrets, compliance, and storage hygiene automation"""

    def __init__(self):
        self.logic: Optional[KeepersGuildLogic] = None
        self.config: Optional[KeepersGuildConfig] = None

    async def initialize(self, config: GoblinConfig) -> None:
        """Initialize the Keepers Guild goblin"""
        try:
            # Load configuration
            config_path = (
                config.working_dir / "config" / "default.json"
                if config.working_dir
                else Path("config/default.json")
            )
            if config_path.exists():
                with open(config_path, "r") as f:
                    config_data = json.load(f)
                self.config = KeepersGuildConfig(**config_data)
            else:
                # Use default configuration
                self.config = KeepersGuildConfig()

            # Override workspace root if provided
            if config.working_dir:
                self.config.workspace_root = str(config.working_dir)

            # Initialize logic
            self.logic = KeepersGuildLogic(self.config)

        except Exception as e:
            raise RuntimeError(f"Failed to initialize Keepers Guild: {e}") from e
            return False

    async def execute(self, context: GoblinContext) -> GoblinResult:
        """Execute Keepers Guild commands"""
        if not self.logic:
            return GoblinResult(
                success=False, error=RuntimeError("Keepers Guild not initialized")
            )

        try:
            # Extract command from context input
            if isinstance(context.input, dict) and "command" in context.input:
                command = context.input["command"]
            elif isinstance(context.input, str):
                # Simple string command
                parts = context.input.split()
                command = parts[0] if parts else ""
            else:
                return GoblinResult(
                    success=False, error=ValueError("Invalid command format")
                )

            if command == "secrets:audit":
                results = await self.logic.audit_secrets()
                return GoblinResult(
                    success=True, output=results, metadata={"command": "secrets:audit"}
                )

            elif command == "security:scan":
                results = await self.logic.run_security_scan()
                return GoblinResult(
                    success=True, output=results, metadata={"command": "security:scan"}
                )

            elif command == "storage:cleanup":
                results = await self.logic.run_storage_cleanup()
                return GoblinResult(
                    success=True,
                    output=results,
                    metadata={"command": "storage:cleanup"},
                )

            elif command == "disk:consolidate":
                results = await self.logic.execute_disk_consolidation()
                return GoblinResult(
                    success=True,
                    output=results,
                    metadata={"command": "disk:consolidate"},
                )

            elif command == "system:clean":
                results = await self.logic.perform_system_clean()
                return GoblinResult(
                    success=True, output=results, metadata={"command": "system:clean"}
                )

            elif command == "compliance:report":
                report = await self.logic.generate_compliance_report()
                return GoblinResult(
                    success=True, output=report, metadata={"command": "compliance:report"}
                )

            elif command == "secrets:playbook":
                playbook = await self.logic.get_secrets_playbook()
                return GoblinResult(
                    success=True,
                    output=playbook,
                    metadata={"command": "secrets:playbook"},
                )
            else:
                return GoblinResult(
                    success=False, error=ValueError(f"Unknown command: {command}")
                )

        except Exception as e:
            return GoblinResult(success=False, error=e)

    async def shutdown(self) -> None:
        """Shutdown the Keepers Guild goblin"""
        try:
            # Cleanup resources if needed
            self.logic = None
            self.config = None
        except Exception as e:
            # Log error but don't raise during shutdown
            print(f"Error during shutdown: {e}")

    async def get_capabilities(self) -> GoblinCapabilities:
        """Get Keepers Guild capabilities"""
        return GoblinCapabilities(
            name="Keepers Guild",
            description="Secrets, compliance, and storage hygiene automation. Commands: secrets:audit, security:scan, storage:cleanup, disk:consolidate, system:clean, compliance:report, secrets:playbook",
            version="0.1.0",
            tags=["security", "compliance", "storage", "secrets"],
        )

    async def _show_help(self):
        """Show help information"""
        capabilities = await self.get_capabilities()
        print(f"\n{capabilities.name} v{capabilities.version}")
        print(f"{capabilities.description}")
        print("\nCommands:")
        for command in capabilities.commands:
            print(f"  {command}")
        print("\nUse: keepers-guild <command> [options]")

    async def _display_secrets_audit_results(self, results: List):
        """Display secrets audit results"""
        if not results:
            print("✅ No secrets found in audit")
            return

        print(f"\n🔍 Secrets Audit Results ({len(results)} findings):")
        print("-" * 80)

        for result in results:
            print(f"📁 {result.file_path}:{result.line_number}")
            print(f"   Type: {result.secret_type}")
            print(f"   Severity: {result.severity.upper()}")
            print(f"   Description: {result.description}")
            print(f"   Recommendation: {result.recommendation}")
            if result.masked_value:
                print(f"   Masked Value: {result.masked_value}")
            print()

    async def _display_security_scan_results(self, results: List):
        """Display security scan results"""
        if not results:
            print("✅ No security issues found")
            return

        print(f"\n🛡️ Security Scan Results ({len(results)} checks):")
        print("-" * 80)

        passed = len([r for r in results if r.status == "pass"])
        failed = len([r for r in results if r.status == "fail"])
        warnings = len([r for r in results if r.status == "warning"])

        print(f"✅ Passed: {passed} | ❌ Failed: {failed} | ⚠️ Warnings: {warnings}")
        print()

        for result in results:
            status_icon = (
                "✅"
                if result.status == "pass"
                else "❌"
                if result.status == "fail"
                else "⚠️"
            )
            print(f"{status_icon} {result.check_name}")
            print(f"   Status: {result.status.upper()}")
            print(f"   Severity: {result.severity.upper()}")
            print(f"   Description: {result.description}")
            if result.details:
                print(f"   Details: {result.details}")
            if result.remediation:
                print(f"   Remediation: {result.remediation}")
            print()

    async def _display_secrets_playbook(self, playbook: List):
        """Display secrets management playbook"""
        print(f"\n📚 Secrets Management Playbook ({len(playbook)} entries):")
        print("=" * 80)

        for entry in playbook:
            print(f"\n🎯 {entry.title}")
            print(f"Priority: {entry.priority.upper()}")
            print(f"Tags: {', '.join(entry.tags)}")
            print(f"\n{entry.description}")
            print("\nSteps:")
            for i, step in enumerate(entry.steps, 1):
                print(f"  {i}. {step}")
            print(f"\nLast Updated: {entry.last_updated.strftime('%Y-%m-%d %H:%M:%S')}")

    async def _display_storage_cleanup_results(self, results: List):
        """Display storage cleanup results"""
        if not results:
            print("🧹 No cleanup operations performed")
            return

        total_space_saved = sum(r.space_saved for r in results)
        total_files_removed = sum(r.files_removed for r in results)

        print("\n🧹 Storage Cleanup Results:")
        print("-" * 80)
        print(f"Total space saved: {total_space_saved / 1024 / 1024:.2f} MB")
        print(f"Total files removed: {total_files_removed}")
        print()

        for result in results:
            print(f"📁 {result.path}")
            print(f"   Type: {result.cleanup_type}")
            print(f"   Size before: {result.size_before / 1024 / 1024:.2f} MB")
            print(f"   Size after: {result.size_after / 1024 / 1024:.2f} MB")
            print(f"   Files removed: {result.files_removed}")
            print(f"   Space saved: {result.space_saved / 1024 / 1024:.2f} MB")
            print()

    async def _display_disk_consolidation_results(self, results: List):
        """Display disk consolidation results"""
        if not results:
            print("📦 No files consolidated")
            return

        successful = len([r for r in results if r.success])
        failed = len([r for r in results if not r.success])

        print("\n📦 Disk Consolidation Results:")
        print("-" * 80)
        print(f"✅ Successful: {successful} | ❌ Failed: {failed}")
        print()

        for result in results:
            status_icon = "✅" if result.success else "❌"
            print(f"{status_icon} {result.source_path.name}")
            print(f"   From: {result.source_path}")
            print(f"   To: {result.target_path}")
            print(f"   Type: {result.consolidation_type}")
            print(f"   Original size: {result.original_size / 1024 / 1024:.2f} MB")
            print(f"   Final size: {result.final_size / 1024 / 1024:.2f} MB")
            if not result.success and result.error_message:
                print(f"   Error: {result.error_message}")
            print()

    async def _display_system_clean_results(self, results: List):
        """Display system clean results"""
        if not results:
            print("🧽 No system cleaning performed")
            return

        total_space_saved = sum(r.total_space_saved for r in results)

        print("\n🧽 System Clean Results:")
        print("-" * 80)
        print(f"Total space saved: {total_space_saved / 1024 / 1024:.2f} MB")
        print()

        for result in results:
            print(f"🗂️ {result.cache_type.title()} Cache")
            print(f"   Paths cleaned: {len(result.paths_cleaned)}")
            print(f"   Space saved: {result.total_space_saved / 1024 / 1024:.2f} MB")
            if result.paths_cleaned:
                print("   Cleaned paths:")
                for path in result.paths_cleaned[:5]:  # Show first 5
                    print(f"     - {path}")
                if len(result.paths_cleaned) > 5:
                    print(f"     ... and {len(result.paths_cleaned) - 5} more")
            print()

    async def _display_compliance_report(self, report):
        """Display comprehensive compliance report"""
        print(
            f"\n📊 Compliance Report - {report.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"
        )
        print("=" * 80)

        print(f"Overall Score: {report.overall_score:.2%}")
        print(f"Critical Issues: {report.critical_issues}")
        print()

        print(f"🔍 Secrets Audit: {len(report.secrets_audit)} findings")
        print(f"🛡️ Security Scans: {len(report.security_scans)} checks")
        print(f"🧹 Storage Cleanup: {len(report.storage_cleanup)} operations")
        print()

        if report.recommendations:
            print("💡 Recommendations:")
            for rec in report.recommendations:
                print(f"   • {rec}")
            print()

        # Show critical issues
        if report.critical_issues > 0:
            print("🚨 Critical Issues:")
            for audit in report.secrets_audit:
                if audit.severity == "critical":
                    print(
                        f"   • {audit.file_path}:{audit.line_number} - {audit.description}"
                    )
            for scan in report.security_scans:
                if scan.status == "fail" and scan.severity == "critical":
                    print(f"   • {scan.check_name} - {scan.description}")
            print()
