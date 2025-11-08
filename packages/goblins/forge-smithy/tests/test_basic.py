"""Basic tests for smithy functionality."""

import subprocess
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from smithy.bootstrap import run as bootstrap_run
from smithy.config import SmithySettings
from smithy.config import sync as config_sync
from smithy.doctor import check_tool
from smithy.tasks import check_dependencies, run_lint, run_tests, run_type_check

# Test agent functionality if available
try:
    from smithy.agent import CREWAI_AVAILABLE  # type: ignore

    AGENT_TESTS_ENABLED = True
    AGENT_DEPENDENCIES_AVAILABLE = CREWAI_AVAILABLE
except ImportError:
    AGENT_TESTS_ENABLED = False
    AGENT_DEPENDENCIES_AVAILABLE = False


class TestDoctor:
    """Test doctor module functionality."""

    def test_check_tool_available(self):
        """Test checking an available tool."""
        # Assuming python3 is available
        available, info = check_tool("python", ["python3", "--version"])
        assert available is True
        assert "Python" in info

    def test_check_tool_unavailable(self):
        """Test checking an unavailable tool."""
        available, info = check_tool("nonexistent_tool", ["nonexistent_tool", "--version"])
        assert available is False
        assert "not found in PATH" in info

    @patch("subprocess.run")
    @patch("shutil.which")
    def test_check_tool_timeout(self, mock_which, mock_run):
        """Test tool check with timeout."""
        mock_which.return_value = "/usr/bin/slow_tool"  # Tool exists in PATH
        mock_run.side_effect = subprocess.TimeoutExpired("cmd", 10)
        available, info = check_tool("slow_tool", ["slow_tool", "--version"])
        assert available is False
        assert "timed out" in info


class TestConfig:
    """Test configuration management."""

    def test_settings_creation(self):
        """Test SmithySettings can be created."""
        settings = SmithySettings()
        assert settings.smithy_version == "0.1.0"
        assert settings.python_version == "3.11"

    def test_sync_config_no_example(self, tmp_path):
        """Test config sync when no .env.example exists."""
        with patch("pathlib.Path.cwd", return_value=tmp_path):
            config_sync()  # Should not crash

    def test_sync_config_with_example(self, tmp_path):
        """Test config sync with .env.example present."""
        (tmp_path / ".env.example").write_text("TEST_VAR=value\n")

        with patch("smithy.config.Path") as mock_path:
            # Create mock paths
            mock_env_path = MagicMock()
            mock_env_path.exists.return_value = False
            mock_env_path.write_text = MagicMock()

            mock_example_path = MagicMock()
            mock_example_path.exists.return_value = True
            mock_example_path.read_text.return_value = "TEST_VAR=value\n"

            # Configure the Path mock to return our mocked paths
            def path_side_effect(path_str):
                if path_str == ".env":
                    return mock_env_path
                elif path_str == ".env.example":
                    return mock_example_path
                return MagicMock()  # fallback

            mock_path.side_effect = path_side_effect

            config_sync()

            # Check that write_text was called on the env path
            mock_env_path.write_text.assert_called_once_with("TEST_VAR=value\n")


class TestTasks:
    """Test task execution."""

    @patch("subprocess.run")
    def test_run_lint_success(self, mock_run):
        """Test successful lint run."""
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        success, output = run_lint()
        assert success is True

    @patch("subprocess.run")
    def test_run_lint_failure(self, mock_run):
        """Test failed lint run."""
        mock_run.return_value = MagicMock(returncode=1, stdout="error", stderr="")
        success, output = run_lint()
        assert success is False
        assert "error" in output

    @patch("subprocess.run")
    def test_run_tests_success(self, mock_run):
        """Test successful test run."""
        mock_run.return_value = MagicMock(returncode=0, stdout="passed", stderr="")
        success, output = run_tests()
        assert success is True
        assert "passed" in output

    @patch("subprocess.run")
    def test_run_type_check_mypy_missing(self, mock_run):
        """Test type check when mypy is not available."""
        mock_run.side_effect = FileNotFoundError
        success, output = run_type_check()
        assert success is True  # Should be treated as optional
        assert "not available" in output

    @patch("subprocess.run")
    def test_check_dependencies_uv_missing(self, mock_run):
        """Test dependency check when uv is not available."""
        mock_run.side_effect = FileNotFoundError
        success, output = check_dependencies()
        assert success is True  # Should be treated as optional
        assert "not available" in output


class TestBootstrap:
    """Test bootstrap functionality."""

    @patch("subprocess.run")
    @patch("pathlib.Path.exists")
    @patch("pathlib.Path.write_text")
    def test_bootstrap_success(self, mock_write, mock_exists, mock_run):
        """Test successful bootstrap."""
        mock_exists.return_value = False
        mock_run.return_value = MagicMock(returncode=0)

        bootstrap_run(dev=True)

        # Should have called uv venv, uv sync, pre-commit install
        assert mock_run.call_count >= 3

    @patch("subprocess.run")
    def test_bootstrap_failure(self, mock_run):
        """Test bootstrap failure handling."""
        mock_run.side_effect = subprocess.CalledProcessError(1, "uv venv")

        try:
            bootstrap_run()
            assert False, "Should have exited"
        except SystemExit:
            pass  # Expected


class TestIntegration:
    """Integration tests for smithy functionality."""

    def test_imports(self):
        """Test core modules can be imported."""
        import importlib.util

        # Test that core modules are importable
        modules_to_test = ["smithy.doctor", "smithy.bootstrap", "smithy.config", "smithy.tasks"]
        for module_name in modules_to_test:
            spec = importlib.util.find_spec(module_name)
            assert spec is not None, f"Module {module_name} not found"

    def test_cli_creation(self):
        """Test CLI app can be created."""
        from smithy.cli import app

        assert app is not None
        # Check that commands are registered (Typer stores them in app.registered_commands)
        assert hasattr(app, "registered_commands")
        assert len(app.registered_commands) > 0


@pytest.mark.skipif(not AGENT_DEPENDENCIES_AVAILABLE, reason="Agent dependencies not available")
class TestAgent:
    """Test agent functionality when CrewAI is available."""

    @patch("smithy.agent.CREWAI_AVAILABLE", True)
    @patch("smithy.agent.Agent")
    @patch("smithy.agent.Task")
    @patch("smithy.agent.Crew")
    def test_agent_initialization(self, mock_crew, mock_task, mock_agent):
        """Test agent initialization with mocked CrewAI."""
        from smithy.agent import SmithyAgent

        mock_agent_instance = MagicMock()
        mock_agent.return_value = mock_agent_instance

        agent = SmithyAgent()
        assert "doctor" in agent.agents
        assert "bootstrap" in agent.agents
        assert "quality" in agent.agents

    @pytest.mark.asyncio
    @patch("smithy.agent.CREWAI_AVAILABLE", True)
    @patch("smithy.agent.Agent")
    @patch("smithy.agent.Task")
    @patch("smithy.agent.Crew")
    @patch("smithy.doctor.run")
    async def test_run_doctor_crew(self, mock_doctor_run, mock_crew, mock_task, mock_agent):
        """Test running doctor crew with mocked dependencies."""
        from smithy.agent import SmithyAgent

        # Setup mocks
        mock_agent_instance = MagicMock()
        mock_agent.return_value = mock_agent_instance

        mock_task_instance = MagicMock()
        mock_task.return_value = mock_task_instance

        mock_crew_instance = MagicMock()
        mock_crew.return_value = mock_crew_instance
        mock_crew_instance.kickoff_async = AsyncMock(return_value="Mock diagnosis result")

        mock_doctor_run.return_value = {"python": (True, "Python 3.11"), "uv": (True, "uv 0.1.0")}

        agent = SmithyAgent()
        result = await agent.run_doctor_crew()

        assert "diagnosis" in result
        assert result["agent_used"] == "doctor"
        assert "Mock diagnosis result" in result["diagnosis"]

    @pytest.mark.asyncio
    @patch("smithy.agent.CREWAI_AVAILABLE", False)
    async def test_agent_unavailable(self):
        """Test agent behavior when CrewAI is not available."""
        # This test should be skipped when agents are not available
        pytest.skip("Agent dependencies not available")

    def test_list_agents(self):
        """Test listing available agents."""
        if not AGENT_TESTS_ENABLED:
            pytest.skip("Agent dependencies not available")
        from smithy.agent import SmithyAgent

        agent = SmithyAgent()
        agents = agent.list_agents()
        assert isinstance(agents, list)
        if CREWAI_AVAILABLE:  # type: ignore
            assert len(agents) > 0
        else:
            assert len(agents) == 0

    def test_get_agent_info(self):
        """Test getting agent information."""
        if not AGENT_TESTS_ENABLED:
            pytest.skip("Agent dependencies not available")
        from smithy.agent import SmithyAgent

        agent = SmithyAgent()
        if CREWAI_AVAILABLE:  # type: ignore
            info = agent.get_agent_info("doctor")
            assert info is not None
            assert "role" in info
            assert "goal" in info
        else:
            info = agent.get_agent_info("doctor")
            assert info is None

    def test_get_smithy_agent_singleton(self):
        """Test singleton pattern for smithy agent."""
        if not AGENT_TESTS_ENABLED:
            pytest.skip("Agent dependencies not available")
        from smithy.agent import get_smithy_agent

        agent1 = get_smithy_agent()
        agent2 = get_smithy_agent()
        assert agent1 is agent2


# Placeholder test to ensure pytest runs
def test_placeholder():
    """Placeholder test to ensure pytest runs."""
    assert True


class TestBiome:
    """Test Biome functionality."""

    @patch("smithy.biome.BiomeManager.is_available")
    @patch("smithy.biome.BiomeManager.run_check")
    def test_run_biome_check_success(self, mock_run_check, mock_is_available):
        """Test successful Biome check."""
        from smithy.biome import run_biome_check

        mock_is_available.return_value = True
        mock_run_check.return_value = MagicMock(success=True, output="All good", error_output="")

        success, output = run_biome_check()
        assert success is True
        assert "All good" in output

    @patch("smithy.biome.BiomeManager.is_available")
    @patch("smithy.biome.BiomeManager.run_check")
    def test_run_biome_check_failure(self, mock_run_check, mock_is_available):
        """Test failed Biome check."""
        from smithy.biome import run_biome_check

        mock_is_available.return_value = True
        mock_run_check.return_value = MagicMock(
            success=False, output="", error_output="Linting errors"
        )

        success, output = run_biome_check()
        assert success is False
        assert "Linting errors" in output

    @patch("smithy.biome.BiomeManager.is_available")
    def test_run_biome_check_unavailable(self, mock_is_available):
        """Test Biome check when Biome is not available."""
        from smithy.biome import run_biome_check

        mock_is_available.return_value = False

        success, output = run_biome_check()
        assert success is True  # Should be treated as optional
        assert "not available" in output

    def test_biome_manager_creation(self):
        """Test BiomeManager can be created."""
        from smithy.biome import BiomeManager

        manager = BiomeManager()
        assert manager.root is not None
        assert manager.config_file is not None

    @patch("smithy.biome.BiomeManager.is_available")
    def test_biome_manager_diagnostics(self, mock_is_available):
        """Test BiomeManager diagnostics."""
        from smithy.biome import BiomeManager

        mock_is_available.return_value = True

        manager = BiomeManager()
        diagnostics = manager.get_diagnostics()

        assert "available" in diagnostics
        assert "version" in diagnostics
        assert "config_valid" in diagnostics
        assert "config_path" in diagnostics
        assert "workspace_root" in diagnostics

    @patch("smithy.biome.run_biome_check")
    def test_check_biome_integration(self, mock_biome_check):
        """Test Biome integration in check function."""
        from smithy.tasks import check_biome

        mock_biome_check.return_value = (True, "Biome check passed")

        success, output = check_biome()
        assert success is True
        assert "Biome check passed" in output
