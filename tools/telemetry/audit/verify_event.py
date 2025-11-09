#!/usr/bin/env python3
import json
import sys
import nacl.signing
#!/usr/bin/env python3
import json
import sys
import nacl.signing
import base64
import argparse

parser = argparse.ArgumentParser(description='Verify the last audit event in a JSONL file')
parser.add_argument('path', help='path to audit JSONL or JSON file')
parser.add_argument('--dump', action='store_true', help='print canonicalized message and base64 bytes for debugging')
args = parser.parse_args()

path = args.path
with open(path, 'r', encoding='utf8') as fh:
    lines = [line.strip() for line in fh.readlines() if line.strip()]
    if not lines:
        print('No events found in', path)
        sys.exit(2)
    last = lines[-1]
    evt = json.loads(last)

pub = base64.b64decode(evt['pubkey'])
sig = base64.b64decode(evt['signature'])

# Build the payload the signer used: remove signature/pubkey/canonicalization then
# serialize using sorted keys and no extra spaces so it matches the Node canonicalizer.
payload = {k: evt[k] for k in evt if k not in ['signature', 'pubkey', 'canonicalization']}
message_str = json.dumps(payload, separators=(',', ':'), ensure_ascii=False, sort_keys=True)
message = message_str.encode('utf8')

if args.dump:
    print('---PY VERIFY DUMP---')
    print('canonical_json:', message_str)
    print('message_bytes_base64:', base64.b64encode(message).decode('ascii'))
    print('signature_base64:', evt['signature'])
    print('pubkey_base64:', evt['pubkey'])
    print('---END PY VERIFY DUMP---')

verify_key = nacl.signing.VerifyKey(pub)
try:
    verify_key.verify(message, sig)
    print('signature OK')
except Exception as e:
    print('signature verification FAILED', e)
    sys.exit(1)
