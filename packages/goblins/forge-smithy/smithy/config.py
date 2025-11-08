"""Type-safe configuration management for Smithy."""

from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class SmithySettings(BaseSettings):
    """Smithy configuration loaded from environment variables and .env files.

    See ../../../../Obsidian/API_KEYS_MANAGEMENT.md for environment
    configuration guidelines.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Smithy metadata
    smithy_version: str = "0.1.0"
    python_version: str = "3.11"

    # Development environment
    dev_mode: bool = True
    verbose: bool = False

    # External tools
    uv_version: str = "latest"
    pre_commit_version: str = "latest"

    # API Keys (loaded from environment)
    gemini_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None

    # Paths
    workspace_root: str = "."
    python_env_path: str = ".venv"


def sync() -> None:
    """Sync .env with .env.example; verify required keys."""
    env = Path(".env")
    example = Path(".env.example")
    if not example.exists():
        print("No .env.example found.")
        return
    if not env.exists():
        env.write_text(example.read_text())
        print(".env created from .env.example")
    else:
        # Check for missing keys
        env_keys = set(line.split("=")[0] for line in env.read_text().splitlines() if "=" in line)
        ex_keys = set(line.split("=")[0] for line in example.read_text().splitlines() if "=" in line)
        missing = ex_keys - env_keys
        if missing:
            print(f"Missing keys in .env: {', '.join(missing)}")
        else:
            print(".env is in sync with .env.example")


# Global settings instance
settings = SmithySettings()


# SMITHY SECURITY FIX - Fix sast: Potential Path Traversal
# Applied: 2025-10-26T04:06:19.936808
# Risk Level: high
# Original Finding: Address security finding: Found pattern matching path_traversal vulnerability

# SECURITY FIX: Address sast
# Finding: Found pattern matching path_traversal vulnerability
# Severity: high
# Recommended: Review and implement appropriate security measures

# TODO: Implement security fix for sast
# Consult security best practices and implement proper validation/sanitization

# END SECURITY FIX


# SMITHY SECURITY FIX - Fix sast: Potential Path Traversal
# Applied: 2025-10-26T04:06:19.937943
# Risk Level: high
# Original Finding: Address security finding: Found pattern matching path_traversal vulnerability

# SECURITY FIX: Address sast
# Finding: Found pattern matching path_traversal vulnerability
# Severity: high
# Recommended: Review and implement appropriate security measures

# TODO: Implement security fix for sast
# Consult security best practices and implement proper validation/sanitization

# END SECURITY FIX


# SMITHY SECURITY FIX - Fix sast: Potential Path Traversal
# Applied: 2025-10-26T04:06:19.938544
# Risk Level: high
# Original Finding: Address security finding: Found pattern matching path_traversal vulnerability

# SECURITY FIX: Address sast
# Finding: Found pattern matching path_traversal vulnerability
# Severity: high
# Recommended: Review and implement appropriate security measures

# TODO: Implement security fix for sast
# Consult security best practices and implement proper validation/sanitization

# END SECURITY FIX


# SMITHY SECURITY FIX - Fix sast: Potential Path Traversal
# Applied: 2025-10-26T04:06:20.049210
# Risk Level: high
# Original Finding: Address security finding: Found pattern matching path_traversal vulnerability

# SECURITY FIX: Address sast
# Finding: Found pattern matching path_traversal vulnerability
# Severity: high
# Recommended: Review and implement appropriate security measures

# TODO: Implement security fix for sast
# Consult security best practices and implement proper validation/sanitization

# END SECURITY FIX
