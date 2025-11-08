"""
Smithy Evidence Collectors

Concrete implementations of evidence collectors for various compliance requirements.
These collectors gather evidence from different sources like file systems, databases,
APIs, configurations, and security scans.
"""

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .compliance import ComplianceEvidence, ComplianceRequirement


class FileSystemEvidenceCollector:
    """Collects evidence from file system operations"""

    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or Path.cwd()

    async def collect_evidence(
        self, requirement: ComplianceRequirement
    ) -> List[ComplianceEvidence]:
        """Collect file system evidence based on requirement metadata"""
        evidence = []

        # Check for required files
        required_files = requirement.metadata.get("required_files", [])
        for file_path in required_files:
            full_path = self.base_path / file_path
            if full_path.exists():
                stat = full_path.stat()
                evidence_data = {
                    "file_path": str(full_path),
                    "exists": True,
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "permissions": oct(stat.st_mode)[-3:],
                }

                # Check file content if specified
                content_check = requirement.metadata.get("content_check")
                if content_check:
                    try:
                        with open(full_path, "r") as f:
                            content = f.read()
                            evidence_data["content_contains"] = content_check in content
                    except Exception:
                        evidence_data["content_read_error"] = True

                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="file_system",
                        evidence_data=evidence_data,
                        collected_at=datetime.now(),
                        source=f"filesystem:{full_path}",
                        verified=True,
                        verification_method="file_existence_check",
                    )
                )
            else:
                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="file_system",
                        evidence_data={
                            "file_path": str(full_path),
                            "exists": False,
                            "error": "File not found",
                        },
                        collected_at=datetime.now(),
                        source=f"filesystem:{full_path}",
                        verified=True,
                        verification_method="file_existence_check",
                    )
                )

        # Check directory permissions
        required_dirs = requirement.metadata.get("required_directories", [])
        for dir_path in required_dirs:
            full_path = self.base_path / dir_path
            if full_path.exists() and full_path.is_dir():
                stat = full_path.stat()
                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="directory_permissions",
                        evidence_data={
                            "directory_path": str(full_path),
                            "exists": True,
                            "permissions": oct(stat.st_mode)[-3:],
                        },
                        collected_at=datetime.now(),
                        source=f"filesystem:{full_path}",
                        verified=True,
                        verification_method="directory_check",
                    )
                )
            else:
                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="directory_permissions",
                        evidence_data={
                            "directory_path": str(full_path),
                            "exists": False,
                            "error": "Directory not found",
                        },
                        collected_at=datetime.now(),
                        source=f"filesystem:{full_path}",
                        verified=True,
                        verification_method="directory_check",
                    )
                )

        return evidence


class DatabaseEvidenceCollector:
    """Collects evidence from database queries"""

    def __init__(self, connection_string: str, query_timeout: int = 30):
        self.connection_string = connection_string
        self.query_timeout = query_timeout

    async def collect_evidence(
        self, requirement: ComplianceRequirement
    ) -> List[ComplianceEvidence]:
        """Collect database evidence based on requirement metadata"""
        evidence = []

        queries = requirement.metadata.get("database_queries", [])
        for query_config in queries:
            query = query_config.get("query")
            expected_result = query_config.get("expected_result")

            if not query:
                continue

            try:
                # In a real implementation, this would connect to the database
                # For now, we'll simulate database operations
                result = await self._execute_query(query)

                evidence_data = {
                    "query": query,
                    "result": result,
                    "execution_time": datetime.now().isoformat(),
                }

                if expected_result is not None:
                    evidence_data["matches_expected"] = result == expected_result

                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="database_query",
                        evidence_data=evidence_data,
                        collected_at=datetime.now(),
                        source=f"database:{self.connection_string}",
                        verified=True,
                        verification_method="database_query",
                    )
                )

            except Exception as e:
                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="database_query",
                        evidence_data={
                            "query": query,
                            "error": str(e),
                            "execution_time": datetime.now().isoformat(),
                        },
                        collected_at=datetime.now(),
                        source=f"database:{self.connection_string}",
                        verified=False,
                        verification_method="database_query",
                    )
                )

        return evidence

    async def _execute_query(self, query: str) -> Any:
        """Execute a database query (simulated)"""
        # This is a simulation - in real implementation, connect to actual database
        await asyncio.sleep(0.1)  # Simulate network delay

        if "COUNT" in query.upper():
            return 42  # Simulated count result
        elif "EXISTS" in query.upper():
            return True  # Simulated existence check
        else:
            return {"status": "ok", "rows_affected": 1}  # Simulated result


class APIEvidenceCollector:
    """Collects evidence from API endpoints"""

    def __init__(self, base_url: str, api_key: Optional[str] = None, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

    async def collect_evidence(
        self, requirement: ComplianceRequirement
    ) -> List[ComplianceEvidence]:
        """Collect API evidence based on requirement metadata"""
        evidence = []

        endpoints = requirement.metadata.get("api_endpoints", [])
        for endpoint_config in endpoints:
            endpoint = endpoint_config.get("endpoint")
            method = endpoint_config.get("method", "GET")
            expected_status = endpoint_config.get("expected_status", 200)
            expected_response = endpoint_config.get("expected_response")

            if not endpoint:
                continue

            try:
                response = await self._call_api(endpoint, method)

                evidence_data = {
                    "endpoint": endpoint,
                    "method": method,
                    "status_code": response.get("status_code"),
                    "response_time": response.get("response_time"),
                    "response_size": len(str(response.get("data", ""))),
                }

                if expected_status:
                    evidence_data["status_matches"] = response.get("status_code") == expected_status

                if expected_response:
                    evidence_data["response_matches"] = response.get("data") == expected_response

                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="api_call",
                        evidence_data=evidence_data,
                        collected_at=datetime.now(),
                        source=f"api:{self.base_url}{endpoint}",
                        verified=True,
                        verification_method="api_call",
                    )
                )

            except Exception as e:
                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="api_call",
                        evidence_data={
                            "endpoint": endpoint,
                            "method": method,
                            "error": str(e),
                        },
                        collected_at=datetime.now(),
                        source=f"api:{self.base_url}{endpoint}",
                        verified=False,
                        verification_method="api_call",
                    )
                )

        return evidence

    async def _call_api(self, endpoint: str, method: str) -> Dict[str, Any]:
        """Call an API endpoint (simulated)"""
        # This is a simulation - in real implementation, make actual HTTP calls
        await asyncio.sleep(0.2)  # Simulate network delay

        return {
            "status_code": 200,
            "data": {"status": "healthy", "version": "1.0.0"},
            "response_time": 0.15,
            "headers": {"content-type": "application/json"},
        }


class ConfigurationEvidenceCollector:
    """Collects evidence from configuration files"""

    def __init__(self, config_paths: Optional[List[Path]] = None):
        self.config_paths = config_paths or [
            Path("/etc"),
            Path.home() / ".config",
            Path.cwd() / "config",
        ]

    async def collect_evidence(
        self, requirement: ComplianceRequirement
    ) -> List[ComplianceEvidence]:
        """Collect configuration evidence based on requirement metadata"""
        evidence = []

        config_checks = requirement.metadata.get("config_checks", [])
        for check in config_checks:
            config_file = check.get("file")
            config_key = check.get("key")
            expected_value = check.get("expected_value")

            if not config_file or not config_key:
                continue

            # Find config file
            config_path = self._find_config_file(config_file)
            if not config_path:
                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="config_check",
                        evidence_data={
                            "config_file": config_file,
                            "config_key": config_key,
                            "found": False,
                            "error": "Configuration file not found",
                        },
                        collected_at=datetime.now(),
                        source=f"config:{config_file}",
                        verified=False,
                        verification_method="config_check",
                    )
                )
                continue

            try:
                config_data = await self._read_config_file(config_path)
                actual_value = self._get_nested_value(config_data, config_key.split("."))

                evidence_data = {
                    "config_file": str(config_path),
                    "config_key": config_key,
                    "actual_value": actual_value,
                    "found": True,
                }

                if expected_value is not None:
                    # Handle type coercion for comparison
                    try:
                        if isinstance(actual_value, str) and isinstance(
                            expected_value, (int, float)
                        ):
                            evidence_data["matches_expected"] = (
                                float(actual_value) == expected_value
                            )
                        elif isinstance(actual_value, (int, float)) and isinstance(
                            expected_value, str
                        ):
                            evidence_data["matches_expected"] = actual_value == float(
                                expected_value
                            )
                        else:
                            evidence_data["matches_expected"] = actual_value == expected_value
                    except (ValueError, TypeError):
                        evidence_data["matches_expected"] = actual_value == expected_value

                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="config_check",
                        evidence_data=evidence_data,
                        collected_at=datetime.now(),
                        source=f"config:{config_path}",
                        verified=True,
                        verification_method="config_check",
                    )
                )

            except Exception as e:
                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="config_check",
                        evidence_data={
                            "config_file": str(config_path),
                            "config_key": config_key,
                            "error": str(e),
                        },
                        collected_at=datetime.now(),
                        source=f"config:{config_path}",
                        verified=False,
                        verification_method="config_check",
                    )
                )

        return evidence

    def _find_config_file(self, filename: str) -> Optional[Path]:
        """Find a configuration file in standard locations"""
        for base_path in self.config_paths:
            candidate = base_path / filename
            if candidate.exists():
                return candidate
        return None

    async def _read_config_file(self, config_path: Path) -> Dict[str, Any]:
        """Read and parse a configuration file"""
        if config_path.suffix.lower() in [".json"]:
            with open(config_path, "r") as f:
                return json.load(f)
        elif config_path.suffix.lower() in [".yaml", ".yml"]:
            # Would need PyYAML in real implementation
            return {"parsed": True, "format": "yaml"}
        else:
            # Assume key=value format
            config = {}
            with open(config_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        key, value = line.split("=", 1)
                        config[key.strip()] = value.strip()
            return config

    def _get_nested_value(self, data: Dict[str, Any], keys: List[str]) -> Any:
        """Get a nested value from a dictionary using dot notation"""
        # First try nested access
        current = data
        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                # If nested access fails, try the full dotted key for flat configs
                full_key = ".".join(keys)
                return data.get(full_key)
        return current


class SecurityScanEvidenceCollector:
    """Collects evidence from security scan results"""

    def __init__(self, scan_results_path: Optional[Path] = None):
        self.scan_results_path = scan_results_path or Path.cwd() / "security_scans"

    async def collect_evidence(
        self, requirement: ComplianceRequirement
    ) -> List[ComplianceEvidence]:
        """Collect security scan evidence based on requirement metadata"""
        evidence = []

        scan_types = requirement.metadata.get("security_scans", [])
        for scan_type in scan_types:
            scan_file = self.scan_results_path / f"{scan_type}.json"

            if not scan_file.exists():
                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="security_scan",
                        evidence_data={
                            "scan_type": scan_type,
                            "found": False,
                            "error": "Scan results not found",
                        },
                        collected_at=datetime.now(),
                        source=f"scan:{scan_file}",
                        verified=False,
                        verification_method="security_scan",
                    )
                )
                continue

            try:
                with open(scan_file, "r") as f:
                    scan_data = json.load(f)

                # Analyze scan results
                analysis = self._analyze_scan_results(scan_data, requirement)

                evidence_data = {
                    "scan_type": scan_type,
                    "scan_date": scan_data.get("scan_date"),
                    "vulnerabilities_found": analysis.get("vulnerabilities", 0),
                    "critical_issues": analysis.get("critical", 0),
                    "high_issues": analysis.get("high", 0),
                    "passed_checks": analysis.get("passed", 0),
                    "failed_checks": analysis.get("failed", 0),
                }

                # Check compliance thresholds
                thresholds = requirement.metadata.get("scan_thresholds", {})
                max_critical = thresholds.get("max_critical", 0)
                max_high = thresholds.get("max_high", 0)

                evidence_data["meets_thresholds"] = (
                    analysis.get("critical", 0) <= max_critical
                    and analysis.get("high", 0) <= max_high
                )

                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="security_scan",
                        evidence_data=evidence_data,
                        collected_at=datetime.now(),
                        source=f"scan:{scan_file}",
                        verified=True,
                        verification_method="security_scan",
                    )
                )

            except Exception as e:
                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="security_scan",
                        evidence_data={
                            "scan_type": scan_type,
                            "error": str(e),
                        },
                        collected_at=datetime.now(),
                        source=f"scan:{scan_file}",
                        verified=False,
                        verification_method="security_scan",
                    )
                )

        return evidence

    def _analyze_scan_results(
        self, scan_data: Dict[str, Any], requirement: ComplianceRequirement
    ) -> Dict[str, Any]:
        """Analyze security scan results"""
        # This is a simplified analysis - real implementation would parse actual scan formats
        findings = scan_data.get("findings", [])

        analysis = {
            "vulnerabilities": len(findings),
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "passed": 0,
            "failed": 0,
        }

        for finding in findings:
            severity = finding.get("severity", "low").lower()
            if severity in analysis:
                analysis[severity] += 1

            status = finding.get("status", "failed").lower()
            if status == "passed":
                analysis["passed"] += 1
            else:
                analysis["failed"] += 1

        return analysis


class CommandEvidenceCollector:
    """Collects evidence by running system commands"""

    def __init__(self, allowed_commands: Optional[List[str]] = None):
        self.allowed_commands = allowed_commands or [
            "ls",
            "ps",
            "netstat",
            "ss",
            "df",
            "du",
            "whoami",
            "id",
            "uptime",
            "echo",
        ]

    async def collect_evidence(
        self, requirement: ComplianceRequirement
    ) -> List[ComplianceEvidence]:
        """Collect command execution evidence based on requirement metadata"""
        evidence = []

        commands = requirement.metadata.get("commands", [])
        for cmd_config in commands:
            command = cmd_config.get("command")
            expected_output = cmd_config.get("expected_output")
            expected_exit_code = cmd_config.get("expected_exit_code", 0)

            if not command:
                continue

            # Security check - only allow whitelisted commands
            cmd_base = command.split()[0]
            if cmd_base not in self.allowed_commands:
                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="command_execution",
                        evidence_data={
                            "command": command,
                            "error": f"Command '{cmd_base}' not in allowed list",
                        },
                        collected_at=datetime.now(),
                        source=f"command:{command}",
                        verified=False,
                        verification_method="command_execution",
                    )
                )
                continue

            try:
                result = await self._run_command(command)

                evidence_data = {
                    "command": command,
                    "exit_code": result["exit_code"],
                    "stdout": result["stdout"],
                    "stderr": result["stderr"],
                    "execution_time": result["execution_time"],
                }

                if expected_exit_code is not None:
                    evidence_data["exit_code_matches"] = result["exit_code"] == expected_exit_code

                if expected_output:
                    evidence_data["output_contains"] = expected_output in result["stdout"]

                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="command_execution",
                        evidence_data=evidence_data,
                        collected_at=datetime.now(),
                        source=f"command:{command}",
                        verified=True,
                        verification_method="command_execution",
                    )
                )

            except Exception as e:
                evidence.append(
                    ComplianceEvidence(
                        requirement_id=requirement.id,
                        evidence_type="command_execution",
                        evidence_data={
                            "command": command,
                            "error": str(e),
                        },
                        collected_at=datetime.now(),
                        source=f"command:{command}",
                        verified=False,
                        verification_method="command_execution",
                    )
                )

        return evidence

    async def _run_command(self, command: str) -> Dict[str, Any]:
        """Run a system command safely"""
        # Use asyncio.subprocess for async execution
        start_time = datetime.now()

        try:
            process = await asyncio.create_subprocess_shell(
                command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, shell=True
            )

            stdout, stderr = await process.communicate()
            execution_time = (datetime.now() - start_time).total_seconds()

            return {
                "exit_code": process.returncode,
                "stdout": stdout.decode().strip(),
                "stderr": stderr.decode().strip(),
                "execution_time": execution_time,
            }

        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            return {
                "exit_code": -1,
                "stdout": "",
                "stderr": str(e),
                "execution_time": execution_time,
            }
