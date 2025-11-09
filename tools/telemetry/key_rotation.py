#!/usr/bin/env python3
"""
Key Rotation Service for GoblinOS Telemetry Audit System

Handles secure key rotation for Ed25519 signing keys used in audit logging.
Supports AWS KMS, Azure Key Vault, and local key rotation for development.
"""

import os
import json
import base64
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
import nacl.signing
import nacl.public
try:
    import boto3
except ImportError:
    boto3 = None

try:
    from azure.identity import DefaultAzureCredential
    from azure.keyvault.keys import KeyClient
except ImportError:
    DefaultAzureCredential = None
    KeyClient = None


class KeyRotationService:
    def __init__(self):
        self.provider = os.environ.get('KMS_PROVIDER', 'local')  # local, aws, azure
        self.key_id = os.environ.get('KMS_KEY_ID')
        self.rotation_interval_days = int(os.environ.get('KEY_ROTATION_DAYS', '30'))

        # Initialize KMS clients
        if self.provider == 'aws' and boto3:
            self.aws_kms = boto3.client('kms')
        elif self.provider == 'azure' and DefaultAzureCredential and KeyClient:
            self.azure_credential = DefaultAzureCredential()
            self.azure_key_client = KeyClient(
                vault_url=f"https://{os.environ['AZURE_KEY_VAULT_NAME']}.vault.azure.net/",
                credential=self.azure_credential
            )

    def should_rotate_key(self, current_key_metadata: Dict) -> bool:
        """Check if key should be rotated based on age"""
        created_at = datetime.fromisoformat(current_key_metadata['created_at'])
        return datetime.now() - created_at > timedelta(days=self.rotation_interval_days)

    def generate_new_keypair(self) -> Tuple[str, str, Dict]:
        """Generate a new Ed25519 keypair"""
        signing_key = nacl.signing.SigningKey.generate()
        verify_key = signing_key.verify_key

        # Create key metadata
        metadata = {
            'key_id': f"audit-{int(time.time())}",
            'created_at': datetime.now().isoformat(),
            'algorithm': 'Ed25519',
            'provider': self.provider,
            'rotation_interval_days': self.rotation_interval_days
        }

        # Encode keys
        secret_key_b64 = base64.b64encode(bytes(signing_key)).decode('ascii')
        public_key_b64 = base64.b64encode(bytes(verify_key)).decode('ascii')

        return secret_key_b64, public_key_b64, metadata

    def store_key_in_kms(self, key_id: str, secret_key_b64: str, metadata: Dict) -> str:
        """Store the secret key in KMS and return the KMS key ID"""
        if self.provider == 'aws':
            return self._store_aws_kms(key_id, secret_key_b64, metadata)
        elif self.provider == 'azure':
            return self._store_azure_kms(key_id, secret_key_b64, metadata)
        else:
            # Local storage for development
            return self._store_local(key_id, secret_key_b64, metadata)

    def _store_aws_kms(self, key_id: str, secret_key_b64: str, metadata: Dict) -> str:
        """Store key in AWS KMS"""
        # Create a KMS key for signing
        kms_key = self.aws_kms.create_key(
            Description=f"GoblinOS Audit Key: {key_id}",
            KeyUsage='SIGN_VERIFY',
            KeySpec='ECC_NIST_P256',  # AWS KMS doesn't support Ed25519 directly
            Tags=[
                {'TagKey': 'Service', 'TagValue': 'GoblinOS-Audit'},
                {'TagKey': 'KeyId', 'TagValue': key_id}
            ]
        )

        kms_key_id = kms_key['KeyMetadata']['KeyId']

        # Store metadata in key description or tags
        self.aws_kms.tag_resource(
            KeyId=kms_key_id,
            Tags=[
                {'TagKey': 'Metadata', 'TagValue': json.dumps(metadata)},
                {'TagKey': 'PublicKey', 'TagValue': self._get_public_key_from_secret(secret_key_b64)}
            ]
        )

        return kms_key_id

    def _store_azure_kms(self, key_id: str, secret_key_b64: str, metadata: Dict) -> str:
        """Store key in Azure Key Vault"""
        # Create key in Azure Key Vault
        key = self.azure_key_client.create_key(
            name=key_id,
            key_type="EC",
            key_curve="P-256",  # Azure doesn't support Ed25519 directly
            enabled=True,
            tags={
                'service': 'GoblinOS-Audit',
                'metadata': json.dumps(metadata),
                'public_key': self._get_public_key_from_secret(secret_key_b64)
            }
        )

        return key.id

    def _store_local(self, key_id: str, secret_key_b64: str, metadata: Dict) -> str:
        """Store key locally for development"""
        key_data = {
            'key_id': key_id,
            'secret_key': secret_key_b64,
            'public_key': self._get_public_key_from_secret(secret_key_b64),
            'metadata': metadata
        }

        os.makedirs('keys', exist_ok=True)
        with open(f'keys/{key_id}.json', 'w') as f:
            json.dump(key_data, f, indent=2)

        return f"local:{key_id}"

    def _get_public_key_from_secret(self, secret_key_b64: str) -> str:
        """Extract public key from secret key"""
        secret_bytes = base64.b64decode(secret_key_b64)
        if len(secret_bytes) == 64:  # Full keypair
            secret_seed = secret_bytes[:32]
        else:  # Just seed
            secret_seed = secret_bytes

        signing_key = nacl.signing.SigningKey(secret_seed)
        verify_key = signing_key.verify_key
        return base64.b64encode(bytes(verify_key)).decode('ascii')

    def rotate_key(self, current_key_metadata: Dict) -> Dict:
        """Perform key rotation"""
        print(f"Rotating key: {current_key_metadata['key_id']}")

        # Generate new keypair
        secret_key_b64, public_key_b64, new_metadata = self.generate_new_keypair()

        # Store in KMS
        kms_key_id = self.store_key_in_kms(new_metadata['key_id'], secret_key_b64, new_metadata)

        # Return new key configuration
        return {
            'kms_key_id': kms_key_id,
            'public_key': public_key_b64,
            'metadata': new_metadata,
            'previous_key_id': current_key_metadata['key_id']
        }

    def get_current_key_config(self) -> Optional[Dict]:
        """Get current key configuration from environment or KMS"""
        if self.key_id:
            # Load from KMS
            return self._load_key_from_kms(self.key_id)
        else:
            # Load from environment (for backward compatibility)
            secret_key = os.environ.get('SECRET_KEY_BASE64')
            public_key = os.environ.get('PUBKEY_BASE64')
            if secret_key and public_key:
                return {
                    'kms_key_id': None,
                    'public_key': public_key,
                    'metadata': {
                        'key_id': 'env-key',
                        'created_at': '2024-01-01T00:00:00',  # Fallback
                        'algorithm': 'Ed25519',
                        'provider': 'env'
                    }
                }
        return None

    def _load_key_from_kms(self, kms_key_id: str) -> Optional[Dict]:
        """Load key configuration from KMS"""
        if self.provider == 'aws':
            return self._load_aws_kms(kms_key_id)
        elif self.provider == 'azure':
            return self._load_azure_kms(kms_key_id)
        else:
            return self._load_local(kms_key_id)

    def _load_aws_kms(self, kms_key_id: str) -> Optional[Dict]:
        """Load from AWS KMS"""
        try:
            # Get key tags
            tags = self.aws_kms.list_resource_tags(KeyId=kms_key_id)

            # Extract metadata from tags
            metadata = {}
            public_key = None
            for tag in tags['Tags']:
                if tag['TagKey'] == 'Metadata':
                    metadata = json.loads(tag['TagValue'])
                elif tag['TagKey'] == 'PublicKey':
                    public_key = tag['TagValue']

            return {
                'kms_key_id': kms_key_id,
                'public_key': public_key,
                'metadata': metadata
            }
        except Exception as e:
            print(f"Failed to load AWS KMS key {kms_key_id}: {e}")
            return None

    def _load_azure_kms(self, kms_key_id: str) -> Optional[Dict]:
        """Load from Azure Key Vault"""
        try:
            key_name = kms_key_id.split('/')[-1]
            key = self.azure_key_client.get_key(key_name)

            # Extract metadata from tags
            metadata = json.loads(key.properties.tags.get('metadata', '{}'))
            public_key = key.properties.tags.get('public_key')

            return {
                'kms_key_id': kms_key_id,
                'public_key': public_key,
                'metadata': metadata
            }
        except Exception as e:
            print(f"Failed to load Azure KMS key {kms_key_id}: {e}")
            return None

    def _load_local(self, key_id: str) -> Optional[Dict]:
        """Load from local storage"""
        try:
            with open(f'keys/{key_id}.json', 'r') as f:
                data = json.load(f)
            return {
                'kms_key_id': f"local:{key_id}",
                'public_key': data['public_key'],
                'metadata': data['metadata']
            }
        except Exception as e:
            print(f"Failed to load local key {key_id}: {e}")
            return None


def main():
    """CLI interface for key rotation"""
    import argparse

    parser = argparse.ArgumentParser(description='GoblinOS Audit Key Rotation Service')
    parser.add_argument('--rotate', action='store_true', help='Rotate the current key')
    parser.add_argument('--check', action='store_true', help='Check if key rotation is needed')
    parser.add_argument('--status', action='store_true', help='Show current key status')

    args = parser.parse_args()

    service = KeyRotationService()
    current_config = service.get_current_key_config()

    if not current_config:
        print("No current key configuration found")
        return 1

    if args.status:
        print("Current Key Status:")
        print(f"  Key ID: {current_config['metadata']['key_id']}")
        print(f"  Provider: {current_config['metadata']['provider']}")
        print(f"  Created: {current_config['metadata']['created_at']}")
        print(f"  KMS Key ID: {current_config.get('kms_key_id', 'N/A')}")

    elif args.check:
        should_rotate = service.should_rotate_key(current_config['metadata'])
        print(f"Key rotation needed: {should_rotate}")
        if should_rotate:
            days_old = (datetime.now() - datetime.fromisoformat(current_config['metadata']['created_at'])).days
            print(f"Key is {days_old} days old (rotation interval: {service.rotation_interval_days} days)")

    elif args.rotate:
        new_config = service.rotate_key(current_config['metadata'])
        print("Key rotation completed:")
        print(f"  New Key ID: {new_config['metadata']['key_id']}")
        print(f"  KMS Key ID: {new_config['kms_key_id']}")
        print(f"  Previous Key ID: {new_config['previous_key_id']}")
        print("\nUpdate your environment variables:")
        print(f"  KMS_KEY_ID={new_config['kms_key_id']}")
        print(f"  PUBKEY_BASE64={new_config['public_key']}")


if __name__ == '__main__':
    main()
