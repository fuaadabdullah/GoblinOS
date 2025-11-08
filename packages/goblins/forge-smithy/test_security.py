#!/usr/bin/env python3
"""
Test script for Smithy security scanning functionality.

This script demonstrates the security scanning capabilities of Phase 3.
"""

import asyncio
import sys
from pathlib import Path

import pytest

# Add the smithy package to the path
sys.path.insert(0, str(Path(__file__).parent))

from smithy.automation import (
    BasicComplianceAuditor,
    BasicDependencyScanner,
    BasicSASTScanner,
    BasicSecretsScanner,
    ComplianceStandard,
    ScanType,
    security_engine,
)

pytestmark = pytest.mark.asyncio


async def test_security_scanning():
    """Test the security scanning functionality."""
    print("🔒 Testing Smithy Security Scanning (Phase 3)")
    print("=" * 50)

    # Get the smithy package directory for testing
    target_path = Path(__file__).parent

    # Register scanners with the global engine
    security_engine.register_scanner(ScanType.SAST, BasicSASTScanner())
    security_engine.register_scanner(ScanType.DEPENDENCY, BasicDependencyScanner())
    security_engine.register_scanner(ScanType.SECRETS, BasicSecretsScanner())
    security_engine.register_compliance_auditor(ComplianceStandard.SOC2, BasicComplianceAuditor())

    print(f"📁 Scanning target: {target_path}")
    print()

    # Run comprehensive security scan
    print("🔍 Running comprehensive security scan...")
    report = await security_engine.comprehensive_scan(
        target_path=target_path,
        scan_types=[ScanType.SAST, ScanType.SECRETS],  # Skip dependency scan for speed
        compliance_standards=[ComplianceStandard.SOC2],
    )

    print("📊 Scan Results:")
    print(f"   Duration: {report.duration_seconds:.2f} seconds")
    print(f"   Security Findings: {report.total_findings}")
    print(f"   Compliance Violations: {report.total_violations}")
    print()

    # Display findings by severity
    if report.findings:
        print("🚨 Security Findings:")
        for finding in sorted(report.findings, key=lambda x: x.severity.value, reverse=True):
            print(f"   {finding.severity.value.upper()}: {finding.title}")
            if finding.file_path:
                print(f"      File: {finding.file_path.name}:{finding.line_number or 'N/A'}")
            if finding.remediation:
                print(f"      Fix: {finding.remediation}")
            print()
    else:
        print("✅ No security findings detected!")

    # Display compliance violations
    if report.compliance_violations:
        print("⚖️  Compliance Violations:")
        for violation in report.compliance_violations:
            print(f"   {violation.standard.value.upper()}: {violation.requirement}")
            print(f"      {violation.description}")
            if violation.remediation:
                print(f"      Fix: {violation.remediation}")
            print()
    else:
        print("✅ No compliance violations detected!")

    print("🎉 Security scanning test completed!")
    return report


async def test_individual_scanners():
    """Test individual scanners separately."""
    print("\n🔬 Testing Individual Scanners:")
    print("-" * 30)

    target_path = Path(__file__).parent

    # Test SAST Scanner
    print("Testing SAST Scanner...")
    sast_scanner = BasicSASTScanner()
    sast_findings = await sast_scanner.scan(target_path)
    print(f"   SAST Findings: {len(sast_findings)}")

    # Test Secrets Scanner
    print("Testing Secrets Scanner...")
    secrets_scanner = BasicSecretsScanner()
    secrets_findings = await secrets_scanner.scan(target_path)
    print(f"   Secrets Findings: {len(secrets_findings)}")

    # Test Compliance Auditor
    print("Testing Compliance Auditor...")
    compliance_auditor = BasicComplianceAuditor()
    compliance_violations = await compliance_auditor.audit(target_path, [ComplianceStandard.SOC2])
    print(f"   Compliance Violations: {len(compliance_violations)}")

    print("✅ Individual scanner tests completed!")


async def main():
    """Main test function."""
    try:
        # Test individual scanners
        await test_individual_scanners()

        # Test comprehensive scanning
        report = await test_security_scanning()

        # Summary
        print("\n📈 Phase 3 Security Scanning Summary:")
        print(f"   • Total findings: {report.total_findings}")
        print(f"   • Critical issues: {report.critical_findings}")
        print(f"   • Compliance violations: {report.total_violations}")
        print("   • Status: ✅ IMPLEMENTED")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback

        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
