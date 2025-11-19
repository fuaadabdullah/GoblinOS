import fs from "fs";
import nacl from "tweetnacl";
import { canonicalize } from "./canonicalize.js";

function b64(buf) {
	return Buffer.from(buf).toString("base64");
}

// Load keypair from environment variables or KMS. No repo fallback for security.
async function loadKeypair() {
	// First try environment variables (for local dev/PoC)
	if (process.env.SECRET_KEY_BASE64 && process.env.PUBKEY_BASE64) {
		return {
			secretKey: process.env.SECRET_KEY_BASE64,
			publicKey: process.env.PUBKEY_BASE64,
		};
	}

	// Try KMS loading (for production)
	if (process.env.KMS_KEY_ID) {
		return await loadKeypairFromKMS(process.env.KMS_KEY_ID);
	}

	throw new Error(
		"Audit signing keys not found. Set SECRET_KEY_BASE64/PUBKEY_BASE64 env vars for local dev, or KMS_KEY_ID for production KMS loading.",
	);
}

// Load keypair from AWS KMS or Azure Key Vault
async function loadKeypairFromKMS(kmsKeyId) {
	// For PoC, we'll simulate KMS loading with a mock
	// In production, this would use AWS KMS SDK or Azure Key Vault SDK

	if (process.env.NODE_ENV === "test") {
		// Use test keys for unit tests
		return {
			secretKey:
				"Vn25s4tnrbRBtOUxpCjvdSdCIkRcOHIAsS+4i0+YuI/9lyAJM4ED7L/M9/Dw7t3hYHrVT1uM9NlpH9jaR/CUvQ==",
			publicKey: "/ZcgCTOBA+y/zPfw8O7d4WB61U9bjPTZaR/Y2kfwlL0=",
		};
	}

	// Mock KMS loading - in real implementation, this would:
	// 1. Use AWS KMS: kms.getPublicKey() and kms.sign() for signing
	// 2. Use Azure Key Vault: Key Vault client to get key and sign
	throw new Error(
		"KMS loading not implemented for this PoC. Use env vars SECRET_KEY_BASE64 and PUBKEY_BASE64 instead.",
	);
}

// Send signed audit event. If DEBUG_AUDIT_BYTES=1 is set, print canonicalized payload
// and base64 of payload bytes and signature for byte-level debugging.
export async function sendSignedAudit(envelopeFields, opts = {}) {
	const auditUrl =
		opts.auditUrl || process.env.AUDIT_URL || "http://localhost:9001/audit";
	const kp = await loadKeypair();
	const secretKey = Buffer.from(kp.secretKey, "base64");

	// Build the payload object to sign (explicit fields) — do NOT include signature/pubkey here
	const payload = { ...envelopeFields };

	// Canonicalize payload (sorted keys compact JSON)
	const canonical = canonicalize(payload);
	const payloadBytes = Buffer.from(canonical, "utf8");

	const sig = nacl.sign.detached(payloadBytes, secretKey);
	const signature = b64(sig);

	// Debug output for byte-level comparison between Node and Python
	if (process.env.DEBUG_AUDIT_BYTES === "1" || opts.debug) {
		console.log("---AUDIT DEBUG---");
		console.log("canonical_json:", canonical);
		console.log(
			"payload_bytes_base64:",
			Buffer.from(payloadBytes).toString("base64"),
		);
		console.log("signature_base64:", signature);
		console.log("pubkey_base64:", kp.publicKey);
		console.log("---END AUDIT DEBUG---");
	}

	// Compose final event: payload fields at top-level + metadata
	const event = {
		...payload,
		signature,
		pubkey: kp.publicKey,
		canonicalization: "sort-keys-v1",
	};

	// POST to audit service (best-effort). Use global fetch (Node 18+).
	try {
		const res = await fetch(auditUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(event),
		});
		if (!res.ok) {
			console.warn("audit service returned", res.status);
		}
	} catch (err) {
		console.warn("audit send failed", err && err.message ? err.message : err);
	}

	return event;
}
