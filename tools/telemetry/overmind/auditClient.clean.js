import nacl from 'tweetnacl';
import fs from 'fs';
import { canonicalize } from './canonicalize.js';

// file neutralized - do not use
export const __neutralized = true;

// Load in-repo key if present; for PoC only. Prefer env var SECRET_KEY_BASE64 in production.
function loadKeypair() {
  const path = new URL('./ed25519_keypair.json', import.meta.url).pathname;
  if (process.env.SECRET_KEY_BASE64) {
    return { secretKey: process.env.SECRET_KEY_BASE64, publicKey: process.env.PUBKEY_BASE64 };
  }
  if (fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  }
  const kp = nacl.sign.keyPair();
  const kpObj = { publicKey: b64(kp.publicKey), secretKey: b64(kp.secretKey) };
  fs.writeFileSync(path, JSON.stringify(kpObj, null, 2));
  return kpObj;
}

export async function sendSignedAudit(envelopeFields, opts = {}) {
  const auditUrl = opts.auditUrl || process.env.AUDIT_URL || 'http://localhost:9001/audit';
  const kp = loadKeypair();
  const secretKey = Buffer.from(kp.secretKey, 'base64');

  // Build the payload object to sign (explicit fields) — do NOT include signature/pubkey here
  const payload = { ...envelopeFields };

  // Canonicalize payload (sorted keys compact JSON)
  const payloadBytes = Buffer.from(canonicalize(payload));

  const sig = nacl.sign.detached(payloadBytes, secretKey);
  const signature = b64(sig);

  // Compose final event: payload fields at top-level + metadata
  const event = { ...payload, signature, pubkey: kp.publicKey, canonicalization: 'sort-keys-v1' };

  // POST to audit service (best-effort). Use global fetch (Node 18+).
  try {
    const res = await fetch(auditUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    if (!res.ok) {
      console.warn('audit service returned', res.status);
    }
  } catch (err) {
    console.warn('audit send failed', err && err.message ? err.message : err);
  }

  return event;
}
