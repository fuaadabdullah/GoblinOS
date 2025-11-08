"""
Environment validation and secrets management for the ForgeMonorepo.

Provides comprehensive validation of environment variables, API keys, and secrets
across all services (ForgeTM, GoblinOS, Overmind) with proper error reporting
and CI integration.
"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from .secrets import SecretsManager


@dataclass
class ValidationError:
    """Represents a validation error with context."""

    service: str
    key: str
    error_type: str  # missing|invalid|weak|expired
    message: str
    severity: str  # error|warning|info
    suggestion: Optional[str] = None


@dataclass
class ValidationResult:
    """Result of environment validation."""

    service: str
    errors: List[ValidationError]
    warnings: List[ValidationError]
    valid_keys: Set[str]

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0

    @property
    def has_warnings(self) -> bool:
        return len(self.warnings) > 0


class EnvironmentValidator:
    """Comprehensive environment and secrets validator for the monorepo."""

    def __init__(self, repo_root: Optional[Path] = None):
        if repo_root is None:
            # Try to find the monorepo root by looking for forge.code-workspace
            current = Path.cwd()
            while current.parent != current:
                if (current / "forge.code-workspace").exists():
                    self.repo_root = current
                    break
                current = current.parent
            else:
                # Fallback to current directory
                self.repo_root = Path.cwd()
        else:
            self.repo_root = repo_root

        self.secrets_manager = SecretsManager()

        # Service-specific validation rules
        self.service_configs = {
            "forgetm": {
                "env_file": self.repo_root / "ForgeTM" / ".env.example",
                "required_keys": [
                    "GEMINI_API_KEY_FORGETM",
                    "GEMINI_API_KEY",
                    "DEEPSEEK_API_KEY",
                    "OPENAI_API_KEY",
                    "POLYGON_API_KEY",
                    "LITELLM_API_KEY",
                ],
                "optional_keys": [
                    "BACKEND_HOST",
                    "BACKEND_PORT",
                    "DATABASE_URL",
                    "REDIS_URL",
                ],
            },
            "forgetm-backend": {
                "env_file": self.repo_root / "ForgeTM" / "apps" / "backend" / ".env.example",
                "required_keys": [
                    "GEMINI_API_KEY_FORGETM",
                    "GEMINI_API_KEY",
                    "DEEPSEEK_API_KEY",
                    "OPENAI_API_KEY",
                    "POLYGON_API_KEY",
                    "LITELLM_API_KEY",
                ],
                "optional_keys": [
                    "BACKEND_HOST",
                    "BACKEND_PORT",
                    "DATABASE_URL",
                    "REDIS_URL",
                    "SECRET_KEY",
                ],
            },
            "goblinos": {
                "env_file": self.repo_root / "GoblinOS" / ".env.example",
                "required_keys": [
                    "GEMINI_API_KEY",
                    "DEEPSEEK_API_KEY",
                    "OPENAI_API_KEY",
                    "POLYGON_API_KEY",
                    "LITELLM_API_KEY",
                ],
                "optional_keys": [
                    "OLLAMA_BASE_URL",
                    "OLLAMA_DEFAULT_MODEL",
                ],
            },
            "overmind": {
                "env_file": self.repo_root
                / "GoblinOS"
                / "packages"
                / "goblins"
                / "overmind"
                / ".env.example",
                "required_keys": [
                    "GEMINI_API_KEY",
                    "DEEPSEEK_API_KEY",
                    "OPENAI_API_KEY",
                ],
                "optional_keys": [
                    "OLLAMA_BASE_URL",
                    "OLLAMA_DEFAULT_MODEL",
                    "OVERMIND_BRIDGE_PORT",
                ],
            },
        }

    def validate_service(self, service: str) -> ValidationResult:
        """Validate environment configuration for a specific service."""
        if service not in self.service_configs:
            raise ValueError(f"Unknown service: {service}")

        config = self.service_configs[service]
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []
        valid_keys: Set[str] = set()

        # Check if .env.example file exists
        if not config["env_file"].exists():
            errors.append(
                ValidationError(
                    service=service,
                    key="",
                    error_type="missing",
                    message=f".env.example file not found: {config['env_file']}",
                    severity="error",
                    suggestion="Create .env.example file with required environment variables",
                )
            )
            return ValidationResult(service, errors, warnings, valid_keys)

        # Parse .env.example file
        env_vars = self._parse_env_file(config["env_file"])

        # Validate required keys exist in .env.example (values can be empty/placeholders)
        for key in config["required_keys"]:
            if key not in env_vars:
                errors.append(
                    ValidationError(
                        service=service,
                        key=key,
                        error_type="missing",
                        message=f"Required key '{key}' not found in .env.example",
                        severity="error",
                        suggestion=f"Add {key}= to {config['env_file']}",
                    )
                )
            else:
                valid_keys.add(key)  # Key is documented, consider it valid

        # Validate actual values from .env file (if exists)
        env_file = config["env_file"].parent / ".env"
        if env_file.exists():
            actual_env_vars = self._parse_env_file(env_file)

            # Validate values for keys that exist in both .env.example and .env
            for key in env_vars:
                if key in actual_env_vars:
                    value = actual_env_vars[key]
                    # Skip validation for optional keys that are empty
                    is_required = key in config["required_keys"]
                    if not is_required and not value.strip():
                        valid_keys.add(key)
                        continue

                    # Validate the actual value from .env file
                    validation = self._validate_key_value(key, value)
                    if not validation["valid"]:
                        if validation["severity"] == "error":
                            errors.append(
                                ValidationError(
                                    service=service,
                                    key=key,
                                    error_type=validation["error_type"],
                                    message=validation["message"],
                                    severity="error",
                                    suggestion=validation["suggestion"],
                                )
                            )
                        else:
                            warnings.append(
                                ValidationError(
                                    service=service,
                                    key=key,
                                    error_type=validation["error_type"],
                                    message=validation["message"],
                                    severity="warning",
                                    suggestion=validation["suggestion"],
                                )
                            )
                    else:
                        valid_keys.add(key)

        # Check for undocumented keys in actual .env file (if exists)
        env_file = config["env_file"].parent / ".env"
        if env_file.exists():
            actual_env_vars = self._parse_env_file(env_file)
            documented_keys = (
                set(env_vars.keys()) | set(config["required_keys"]) | set(config["optional_keys"])
            )

            for key in actual_env_vars:
                if key not in documented_keys and not key.startswith("_"):
                    warnings.append(
                        ValidationError(
                            service=service,
                            key=key,
                            error_type="undocumented",
                            message=f"Key '{key}' found in .env but not documented in .env.example",
                            severity="warning",
                            suggestion="Add this key to .env.example or remove from .env",
                        )
                    )

        return ValidationResult(service, errors, warnings, valid_keys)

    def validate_all_services(self) -> Dict[str, ValidationResult]:
        """Validate environment configuration for all services."""
        results = {}
        for service in self.service_configs:
            results[service] = self.validate_service(service)
        return results

    def sync_env_examples(self, services: Optional[List[str]] = None) -> Dict[str, bool]:
        """Sync .env.example files with current secrets manager state."""
        services = services or list(self.service_configs.keys())
        results = {}

        for service in services:
            if service not in self.service_configs:
                continue

            config = self.service_configs[service]
            env_file = config["env_file"]

            try:
                # Get current secrets
                all_secrets = self.secrets_manager.list()
                service_keys = set(config["required_keys"] + config["optional_keys"])

                # Read current .env.example
                current_vars = self._parse_env_file(env_file) if env_file.exists() else {}

                # Update with available secrets
                updated = False
                for key in service_keys:
                    if key in all_secrets and key not in current_vars:
                        # Add placeholder for available secret
                        current_vars[key] = f"your_{key.lower()}_here"
                        updated = True

                if updated:
                    self._write_env_file(env_file, current_vars)

                results[service] = True
            except Exception as e:
                print(f"Error syncing {service}: {e}")
                results[service] = False

        return results

    def check_secrets_rotation(self, days_threshold: int = 90) -> Dict[str, List[str]]:
        """Check which secrets need rotation based on age."""
        # This would integrate with secret metadata to track rotation dates
        # For now, return empty as we don't have rotation tracking yet
        return {}

    def generate_ci_secrets_report(self) -> str:
        """Generate a CI-friendly report of secrets validation."""
        results = self.validate_all_services()

        report_lines = ["# Secrets Validation Report", f"Date: {self._get_current_date()}", ""]

        total_errors = 0
        total_warnings = 0

        for service, result in results.items():
            report_lines.append(f"## {service.upper()}")
            report_lines.append(f"Status: {'✅ PASS' if result.is_valid else '❌ FAIL'}")

            if result.errors:
                report_lines.append("Errors:")
                for error in result.errors:
                    report_lines.append(f"  - {error.key}: {error.message}")
                    if error.suggestion:
                        report_lines.append(f"    💡 {error.suggestion}")
                total_errors += len(result.errors)

            if result.warnings:
                report_lines.append("Warnings:")
                for warning in result.warnings:
                    report_lines.append(f"  - {warning.key}: {warning.message}")
                    if warning.suggestion:
                        report_lines.append(f"    💡 {warning.suggestion}")
                total_warnings += len(result.warnings)

            report_lines.append(f"Valid keys: {len(result.valid_keys)}")
            report_lines.append("")

        report_lines.append("## Summary")
        report_lines.append(f"Total errors: {total_errors}")
        report_lines.append(f"Total warnings: {total_warnings}")
        report_lines.append(f"Overall status: {'✅ PASS' if total_errors == 0 else '❌ FAIL'}")

        return "\n".join(report_lines)

    def _parse_env_file(self, file_path: Path) -> Dict[str, str]:
        """Parse a .env or .env.example file."""
        env_vars = {}
        if not file_path.exists():
            return env_vars

        for line in file_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, value = line.split("=", 1)
                env_vars[key.strip()] = value.strip()

        return env_vars

    def _write_env_file(self, file_path: Path, env_vars: Dict[str, str]) -> None:
        """Write environment variables to a .env.example file."""
        file_path.parent.mkdir(parents=True, exist_ok=True)

        lines = []
        lines.append("# Environment Configuration")
        lines.append("# This file is auto-generated. Add your actual values to .env")
        lines.append("")

        for key, value in sorted(env_vars.items()):
            lines.append(f"{key}={value}")

        file_path.write_text("\n".join(lines) + "\n")

    def _validate_key_value(self, key: str, value: str) -> Dict[str, Any]:
        """Validate a key-value pair."""
        # Check for placeholder values
        if value in [f"your_{key.lower()}_here", "your_value_here", ""]:
            return {
                "valid": False,
                "error_type": "placeholder",
                "message": f"Key '{key}' contains placeholder value",
                "severity": "error",
                "suggestion": f"Replace with actual {key} value",
            }

        # API key format validation
        if key.endswith("_API_KEY"):
            # Allow "proxy" as a valid value for LiteLLM API key (development default)
            if key == "LITELLM_API_KEY" and value == "proxy":
                pass  # Valid development value
            elif not self._is_valid_api_key_format(value):
                return {
                    "valid": False,
                    "error_type": "invalid_format",
                    "message": f"Key '{key}' does not appear to be a valid API key format",
                    "severity": "warning",
                    "suggestion": "Verify the API key format with the provider",
                }

        # URL validation
        if "URL" in key and value.startswith("http"):
            if not self._is_valid_url(value):
                return {
                    "valid": False,
                    "error_type": "invalid_url",
                    "message": f"Key '{key}' contains invalid URL format",
                    "severity": "error",
                    "suggestion": "Provide a valid URL",
                }

        return {"valid": True}

    def _is_valid_api_key_format(self, value: str) -> bool:
        """Check if value looks like a valid API key."""
        # Basic checks for common API key patterns
        if len(value) < 10:
            return False

        # Check for common API key prefixes
        api_key_prefixes = ["sk-", "pk_", "xoxp-", "Bearer ", "Token "]
        if any(value.startswith(prefix) for prefix in api_key_prefixes):
            return True

        # Check for alphanumeric + special chars pattern
        if re.match(r"^[A-Za-z0-9\-_\.]+$", value):
            return True

        return False

    def _is_valid_url(self, value: str) -> bool:
        """Check if value is a valid URL."""
        try:
            from urllib.parse import urlparse

            result = urlparse(value)
            return all([result.scheme, result.netloc])
        except Exception:
            return False

    def _get_current_date(self) -> str:
        """Get current date in readable format."""
        from datetime import datetime

        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def scan_code_for_env_usage(self) -> Dict[str, List[Dict[str, Any]]]:
        """Scan codebase for environment variable usage patterns."""
        usage_patterns = {
            "python": [
                r"os\.getenv\(['\"]([^'\"]*)['\"]",
                r"os\.environ\.get\(['\"]([^'\"]*)['\"]",
                r"os\.environ\[['\"]([^'\"]*)['\"]\]",
            ],
            "javascript": [
                r"process\.env\.([A-Z_][A-Z0-9_]*)",
            ],
            "typescript": [
                r"process\.env\.([A-Z_][A-Z0-9_]*)",
            ],
        }

        results = {}

        for lang, patterns in usage_patterns.items():
            results[lang] = []
            extensions = {
                "python": ["*.py"],
                "javascript": ["*.js", "*.jsx"],
                "typescript": ["*.ts", "*.tsx"],
            }

            for ext in extensions.get(lang, []):
                for file_path in self.repo_root.rglob(ext):
                    # Skip common exclude patterns
                    if any(
                        skip in str(file_path)
                        for skip in [".venv", "node_modules", "__pycache__", ".git"]
                    ):
                        continue

                    try:
                        content = file_path.read_text()
                        lines = content.splitlines()

                        for line_num, line in enumerate(lines, 1):
                            for pattern in patterns:
                                matches = re.finditer(pattern, line)
                                for match in matches:
                                    var_name = (
                                        match.group(1)
                                        if match.groups()
                                        else match.group(0).split(".")[-1]
                                    )
                                    results[lang].append(
                                        {
                                            "file": str(file_path.relative_to(self.repo_root)),
                                            "line": line_num,
                                            "variable": var_name,
                                            "context": line.strip(),
                                            "pattern": pattern,
                                        }
                                    )
                    except Exception:
                        # Skip files that can't be read
                        continue

        return results

    def generate_env_drift_report(self) -> Dict[str, Any]:
        """Generate comprehensive environment drift analysis."""
        results = self.validate_all_services()
        code_usage = self.scan_code_for_env_usage()

        drift_report = {
            "timestamp": self._get_current_date(),
            "services": {},
            "code_usage": code_usage,
            "undocumented_usage": [],
            "missing_documentation": [],
            "drift_score": 0,
            "recommendations": [],
        }

        # Analyze service validation results
        for service, result in results.items():
            drift_report["services"][service] = {
                "errors": len(result.errors),
                "warnings": len(result.warnings),
                "valid_keys": len(result.valid_keys),
                "is_valid": result.is_valid,
            }

            # Collect undocumented keys
            for warning in result.warnings:
                if "found in .env but not documented" in warning.message:
                    drift_report["undocumented_usage"].append(
                        {
                            "service": service,
                            "key": warning.key,
                            "severity": "warning",
                        }
                    )

            # Collect missing documentation
            for error in result.errors:
                if "not found in .env.example" in error.message:
                    drift_report["missing_documentation"].append(
                        {
                            "service": service,
                            "key": error.key,
                            "severity": "error",
                        }
                    )

        # Analyze code usage vs documentation
        documented_keys = set()
        for service_config in self.service_configs.values():
            if service_config["env_file"].exists():
                documented_keys.update(self._parse_env_file(service_config["env_file"]).keys())

        used_keys = set()
        for lang_usage in code_usage.values():
            for usage in lang_usage:
                used_keys.add(usage["variable"])

        # Find undocumented usage
        undocumented_in_code = used_keys - documented_keys
        for key in undocumented_in_code:
            drift_report["undocumented_usage"].append(
                {
                    "service": "codebase",
                    "key": key,
                    "severity": "error",
                    "source": "code_scan",
                }
            )

        # Calculate drift score
        drift_report["drift_score"] = len(drift_report["undocumented_usage"]) + len(
            drift_report["missing_documentation"]
        )

        # Generate recommendations
        if drift_report["undocumented_usage"]:
            drift_report["recommendations"].append(
                "Add undocumented environment variables to .env.example files"
            )

        if drift_report["missing_documentation"]:
            drift_report["recommendations"].append(
                "Document missing required environment variables"
            )

        if undocumented_in_code:
            drift_report["recommendations"].append(
                "Review code usage of undocumented environment variables"
            )

        return drift_report

    def generate_env_documentation(self) -> str:
        """Generate comprehensive environment documentation in Markdown."""
        docs_lines = [
            "# Environment Variables Reference\n\n",
            "This document is auto-generated from .env.example files and code analysis.\n\n",
            f"Generated: {self._get_current_date()}\n\n",
            "## Monorepo Environment Discipline\n\n",
            "All environment variables must be documented in `.env.example` files.\n",
            "The `.env.example` files serve as the single source of truth for environment configuration.\n\n",
            "### Rules\n\n",
            "- ✅ All environment variables used in code must be documented\n",
            "- ✅ `.env.example` files must list all required and optional variables\n",
            "- ✅ CI will fail PRs with undocumented environment variables\n",
            "- ✅ Documentation is auto-generated and kept current\n\n",
        ]

        # Generate per-service tables
        for service_name, config in self.service_configs.items():
            docs_lines.append(f"## {service_name.upper()}\n\n")

            env_file = config["env_file"]
            if env_file.exists():
                env_vars = self._parse_env_file(env_file)

                if env_vars:
                    docs_lines.extend(
                        [
                            "| Variable | Default Value | Required | Description |",
                            "|----------|---------------|----------|-------------|",
                        ]
                    )

                    for key, value in sorted(env_vars.items()):
                        required = "✅" if key in config["required_keys"] else "❌"
                        default = f"`{value}`" if value else "*(empty)*"
                        description = f"Used in {service_name} service"

                        docs_lines.append(f"| `{key}` | {default} | {required} | {description} |")

                    docs_lines.append("")
                else:
                    docs_lines.append("*No environment variables documented*\n\n")
            else:
                docs_lines.append(f"*Configuration file not found: {env_file}*\n\n")

        # Add code usage summary
        code_usage = self.scan_code_for_env_usage()
        total_usage = sum(len(usage_list) for usage_list in code_usage.values())

        docs_lines.extend(
            [
                "## Code Usage Summary\n\n",
                f"Total environment variable references found in codebase: **{total_usage}**\n\n",
            ]
        )

        for lang, usage_list in code_usage.items():
            if usage_list:
                docs_lines.extend(
                    [
                        f"### {lang.title()} Files\n\n",
                        f"Found {len(usage_list)} environment variable references:\n\n",
                        "| File | Variable | Line |",
                        "|------|----------|------|",
                    ]
                )

                for usage in sorted(usage_list, key=lambda x: (x["file"], x["variable"])):
                    docs_lines.append(
                        f"| `{usage['file']}` | `{usage['variable']}` | {usage['line']} |"
                    )

                docs_lines.append("")

        docs_lines.extend(
            [
                "## Maintenance\n\n",
                "This documentation is automatically updated by the `env-gate` CI workflow.\n",
                "To modify environment variable documentation:\n\n",
                "1. Edit the appropriate `.env.example` file\n",
                "2. Add comments describing the variable's purpose\n",
                "3. Commit changes (CI will update this document)\n\n",
                "---\n\n",
                "*Generated by Smithy Environment Validator*",
            ]
        )

        return "\n".join(docs_lines)


def main():
    """CLI entry point for environment validation."""
    import argparse

    parser = argparse.ArgumentParser(description="Environment and secrets validator")
    parser.add_argument("service", nargs="?", help="Specific service to validate")
    parser.add_argument("--sync", action="store_true", help="Sync .env.example files")
    parser.add_argument("--ci-report", action="store_true", help="Generate CI report")
    parser.add_argument("--repo-root", type=Path, help="Repository root path")

    args = parser.parse_args()

    validator = EnvironmentValidator(args.repo_root)

    if args.sync:
        print("🔄 Syncing .env.example files...")
        results = validator.sync_env_examples()
        for service, success in results.items():
            status = "✅" if success else "❌"
            print(f"{status} {service}")
        return

    if args.ci_report:
        report = validator.generate_ci_secrets_report()
        print(report)
        # Exit with error code if validation failed
        results = validator.validate_all_services()
        has_errors = any(not result.is_valid for result in results.values())
        sys.exit(1 if has_errors else 0)

    if args.service:
        result = validator.validate_service(args.service)
        if result.errors:
            print("❌ Validation failed:")
            for error in result.errors:
                print(f"  {error.key}: {error.message}")
            sys.exit(1)
        else:
            print(f"✅ {args.service} validation passed")
            if result.warnings:
                print("⚠️  Warnings:")
                for warning in result.warnings:
                    print(f"  {warning.key}: {warning.message}")
    else:
        results = validator.validate_all_services()
        has_errors = False

        for service, result in results.items():
            status = "✅" if result.is_valid else "❌"
            print(
                f"{status} {result.service}: {len(result.errors)} errors, {len(result.warnings)} warnings"
            )

            if result.errors:
                has_errors = True
                for error in result.errors:
                    print(f"  ❌ {error.key}: {error.message}")

            if result.warnings:
                for warning in result.warnings:
                    print(f"  ⚠️  {warning.key}: {warning.message}")

        if has_errors:
            print("\n❌ Some services have validation errors")
            sys.exit(1)
        else:
            print("\n🎉 All services validated successfully!")


if __name__ == "__main__":
    main()
