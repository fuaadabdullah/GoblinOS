#!/usr/bin/env python3
import json
import base64
import nacl.signing
import pytest
import tempfile
import os

# Test data - same keys used in Node tests
SECRET_KEY_B64 = 'Vn25s4tnrbRBtOUxpCjvdSdCIkRcOHIAsS+4i0+YuI/9lyAJM4ED7L/M9/Dw7t3hYHrVT1uM9NlpH9jaR/CUvQ=='
PUBKEY_B64 = '/ZcgCTOBA+y/zPfw8O7d4WB61U9bjPTZaR/Y2kfwlL0='

def canonicalize(obj):
    """Python version of canonicalize - matches Node implementation"""
    return json.dumps(obj, separators=(',', ':'), ensure_ascii=False, sort_keys=True)

def sign_payload(payload):
    """Sign a payload using the test keys"""
    # SECRET_KEY_B64 is the full 64-byte keypair (32 secret + 32 public)
    # PyNaCl needs just the 32-byte secret seed
    full_keypair = base64.b64decode(SECRET_KEY_B64)
    secret_key = full_keypair[:32]  # First 32 bytes are the secret seed
    message_str = canonicalize(payload)
    message = message_str.encode('utf8')
    signing_key = nacl.signing.SigningKey(secret_key)
    signed = signing_key.sign(message)
    signature = signed.signature
    return base64.b64encode(signature).decode('ascii'), message_str

def create_test_event(payload):
    """Create a complete audit event with signature"""
    signature, canonical = sign_payload(payload)
    event = {
        **payload,
        'signature': signature,
        'pubkey': PUBKEY_B64,
        'canonicalization': 'sort-keys-v1'
    }
    return event, canonical

class TestAuditVerification:
    def test_canonicalize_matches_node(self):
        """Test that Python canonicalize produces same output as Node"""
        payload = {
            "action": "test",
            "actor": "user",
            "context": {"note": "test", "trace_id": "123"}
        }
        expected = '{"action":"test","actor":"user","context":{"note":"test","trace_id":"123"}}'
        assert canonicalize(payload) == expected

    def test_canonicalize_sorts_keys(self):
        """Test that canonicalize sorts object keys"""
        payload = {"z": 1, "a": 2, "m": 3}
        expected = '{"a":2,"m":3,"z":1}'
        assert canonicalize(payload) == expected

    def test_canonicalize_nested_objects(self):
        """Test canonicalize with nested objects"""
        payload = {"b": {"z": 1, "a": 2}, "a": 1}
        expected = '{"a":1,"b":{"a":2,"z":1}}'
        assert canonicalize(payload) == expected

    def test_sign_and_verify_roundtrip(self):
        """Test that we can sign and verify a payload"""
        payload = {
            "event_id": "test-123",
            "action": "test_action",
            "actor": "test-user"
        }

        event, canonical = create_test_event(payload)

        # Verify the signature
        pub_key = base64.b64decode(PUBKEY_B64)
        sig = base64.b64decode(event['signature'])
        message = canonical.encode('utf8')

        verify_key = nacl.signing.VerifyKey(pub_key)
        verify_key.verify(message, sig)  # Should not raise exception

    def test_tamper_detection(self):
        """Test that modifying signed data fails verification"""
        payload = {"action": "test", "actor": "user"}
        event, _ = create_test_event(payload)

        # Tamper with the payload
        tampered_payload = {"action": "tampered", "actor": "user"}
        tampered_canonical = canonicalize(tampered_payload)
        tampered_message = tampered_canonical.encode('utf8')

        # Try to verify with original signature
        pub_key = base64.b64decode(PUBKEY_B64)
        sig = base64.b64decode(event['signature'])

        verify_key = nacl.signing.VerifyKey(pub_key)
        with pytest.raises(nacl.exceptions.BadSignatureError):
            verify_key.verify(tampered_message, sig)

    def test_verify_event_script(self):
        """Test the verify_event.py script with a temporary file"""
        payload = {"action": "script_test", "actor": "pytest"}
        event, _ = create_test_event(payload)

        # Create temporary JSONL file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
            json.dump(event, f)
            f.write('\n')
            temp_file = f.name

        try:
            # Run the verification script
            import subprocess
            result = subprocess.run([
                'python3', 'audit/verify_event.py', temp_file
            ], capture_output=True, text=True, cwd='/Users/fuaadabdullah/ForgeMonorepo/GoblinOS/tools/telemetry')

            assert result.returncode == 0
            assert 'signature OK' in result.stdout

        finally:
            os.unlink(temp_file)

    def test_verify_event_with_dump(self):
        """Test the verify_event.py script with --dump option"""
        payload = {"action": "dump_test", "actor": "pytest"}
        event, expected_canonical = create_test_event(payload)

        # Create temporary JSONL file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
            json.dump(event, f)
            f.write('\n')
            temp_file = f.name

        try:
            # Run the verification script with --dump
            import subprocess
            result = subprocess.run([
                'python3', 'audit/verify_event.py', '--dump', temp_file
            ], capture_output=True, text=True, cwd='/Users/fuaadabdullah/ForgeMonorepo/GoblinOS/tools/telemetry')

            assert result.returncode == 0
            assert 'signature OK' in result.stdout
            assert '---PY VERIFY DUMP---' in result.stdout
            assert f'canonical_json: {expected_canonical}' in result.stdout
            assert f'pubkey_base64: {PUBKEY_B64}' in result.stdout

        finally:
            os.unlink(temp_file)
