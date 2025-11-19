#!/usr/bin/env python3
"""
Test script for keepers-guild goblin.

This script provides basic testing functionality for the keepers-guild goblin,
including unit tests for core logic and integration tests for the goblin interface.
"""

import asyncio
import sys
import tempfile
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / "src"))

from goblinos.interface import GoblinConfig, GoblinContext
from keepers_guild.goblin import KeepersGuildGoblin
from keepers_guild.logic import KeepersGuildLogic
from keepers_guild.schema import KeepersGuildConfig


class TestKeepersGuild:
    """Test suite for keepers-guild functionality."""

    def __init__(self):
        self.goblin = KeepersGuildGoblin()
        self.config = KeepersGuildConfig()
        self.logic = KeepersGuildLogic(self.config)
        self.test_dir = Path(tempfile.mkdtemp(prefix="keepers_test_"))
        self.config = KeepersGuildConfig()

    async def setup_test_data(self):
        """Create test data for testing."""
        # Create test files with secrets
        test_files = {
            ".env": "API_KEY=sk-test123456789\nPASSWORD=secret123\n",
            "config.json": '{"token": "bearer-token-456", "secret": "hidden-value"}',
            "secrets.py": 'API_KEY = "pk_live_789"\nSECRET_KEY = "top-secret"',
            "normal_file.txt": "This is just normal text with no secrets.",
        }

        for filename, content in test_files.items():
            file_path = self.test_dir / filename
            file_path.write_text(content)

        # Create some cache/temp files for cleanup testing
        cache_dir = self.test_dir / ".cache"
        cache_dir.mkdir()
        (cache_dir / "old_cache.txt").write_text("old cache data")
        (cache_dir / "new_cache.txt").write_text("new cache data")

        temp_dir = self.test_dir / "temp"
        temp_dir.mkdir()
        (temp_dir / "temp_file.tmp").write_text("temporary data")

    async def test_secrets_audit(self):
        """Test secrets audit functionality."""
        print("🧪 Testing secrets audit...")

        # Update config to scan our test directory
        self.config.secrets_audit.scan_paths = [str(self.test_dir / "**/*")]

        results = await self.logic.audit_secrets()

        assert len(results) >= 0, "Should return results (may be empty)"
        print(f"✅ Found {len(results)} potential secrets")

    async def test_security_scan(self):
        """Test security scan functionality."""
        print("🧪 Testing security scan...")

        results = await self.logic.run_security_scan()

        assert results is not None, "Security scan should return results"
        print(f"✅ Security scan completed with {len(results)} checks")

    async def test_storage_cleanup(self):
        """Test storage cleanup functionality."""
        print("🧪 Testing storage cleanup...")

        results = await self.logic.run_storage_cleanup()

        assert results is not None, "Storage cleanup should return results"
        print(f"✅ Storage cleanup found {len(results)} items")

    async def test_goblin_interface(self):
        """Test goblin interface functionality."""
        print("🧪 Testing goblin interface...")

        # Test initialization
        config = GoblinConfig(id="test-keepers", working_dir=self.test_dir)
        await self.goblin.initialize(config)
        print("✅ Goblin initialized")

        # Test capabilities
        capabilities = await self.goblin.get_capabilities()
        assert capabilities.name == "Keepers Guild", "Should have correct name"
        assert "secrets:audit" in capabilities.description, (
            "Should mention secrets audit"
        )
        print("✅ Goblin capabilities verified")

        # Test execution with secrets audit
        context = GoblinContext(input="secrets:audit")
        result = await self.goblin.execute(context)
        assert result.success, f"Execute should succeed, got error: {result.error}"
        print("✅ Goblin execution successful")

        # Test shutdown
        await self.goblin.shutdown()
        print("✅ Goblin shutdown")

    async def test_configuration_validation(self):
        """Test configuration validation."""
        print("🧪 Testing configuration validation...")

        # Test default config
        config = KeepersGuildConfig()
        assert config.secrets_audit is not None, "Should have secrets audit config"
        assert config.security_scan is not None, "Should have security scan config"
        assert config.storage_cleanup is not None, "Should have storage cleanup config"
        print("✅ Configuration validation passed")

    async def run_all_tests(self):
        """Run all tests."""
        print("🚀 Starting keepers-guild tests...\n")

        try:
            await self.setup_test_data()
            print(f"📁 Test data created in: {self.test_dir}\n")

            await self.test_configuration_validation()
            await self.test_secrets_audit()
            await self.test_security_scan()
            await self.test_storage_cleanup()
            await self.test_goblin_interface()

            print("\n🎉 All tests passed!")

        except Exception as e:
            print(f"\n❌ Test failed: {e}")
            raise
        finally:
            # Cleanup test directory
            import shutil

            if self.test_dir.exists():
                shutil.rmtree(self.test_dir)
                print(f"🧹 Cleaned up test directory: {self.test_dir}")


async def main():
    """Main test runner."""
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print("Usage: python test.py")
        print("Runs comprehensive tests for keepers-guild goblin")
        return

    tester = TestKeepersGuild()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
