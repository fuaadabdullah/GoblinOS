import assert from "node:assert";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import nacl from "tweetnacl";
import { sendSignedAudit } from "../auditClient.js";
import { canonicalize } from "../canonicalize.js";

// Mock environment variables for testing
const mockSecretKey =
	"Vn25s4tnrbRBtOUxpCjvdSdCIkRcOHIAsS+4i0+YuI/9lyAJM4ED7L/M9/Dw7t3hYHrVT1uM9NlpH9jaR/CUvQ==";
const mockPublicKey = "/ZcgCTOBA+y/zPfw8O7d4WB61U9bjPTZaR/Y2kfwlL0=";

describe("auditClient", () => {
	beforeEach(() => {
		// Set up mock environment variables
		process.env.SECRET_KEY_BASE64 = mockSecretKey;
		process.env.PUBKEY_BASE64 = mockPublicKey;
		process.env.AUDIT_URL = "http://mock-audit-url";
	});

	afterEach(() => {
		// Clean up environment variables
		delete process.env.SECRET_KEY_BASE64;
		delete process.env.PUBKEY_BASE64;
		delete process.env.AUDIT_URL;
		delete process.env.DEBUG_AUDIT_BYTES;
	});

	test("throws error when keys not in environment", async () => {
		delete process.env.SECRET_KEY_BASE64;
		delete process.env.PUBKEY_BASE64;

		await assert.rejects(
			async () => await sendSignedAudit({ action: "test" }),
			/Audit signing keys not found/,
		);
	});

	test("signs audit event correctly", async () => {
		// Mock fetch
		const mockFetch = mock.fn(() => Promise.resolve({ ok: true }));
		global.fetch = mockFetch;

		const envelopeFields = {
			event_id: "test-123",
			occurred_at: "2025-11-09T12:00:00.000Z",
			actor: "test-user",
			action: "test_action",
			resource: { type: "test", id: "123" },
			context: { note: "test event" },
		};

		const result = await sendSignedAudit(envelopeFields, {
			auditUrl: "http://mock",
		});

		// Verify the result has the expected structure
		assert(result.signature);
		assert(result.pubkey);
		assert.strictEqual(result.canonicalization, "sort-keys-v1");
		assert.strictEqual(result.event_id, "test-123");
		assert.strictEqual(result.actor, "test-user");

		// Verify signature is valid
		const payload = { ...envelopeFields };
		const canonical = canonicalize(payload);
		const payloadBytes = Buffer.from(canonical, "utf8");
		const secretKey = Buffer.from(mockSecretKey, "base64");
		const expectedSig = nacl.sign.detached(payloadBytes, secretKey);
		const expectedSigB64 = Buffer.from(expectedSig).toString("base64");

		assert.strictEqual(result.signature, expectedSigB64);
		assert.strictEqual(result.pubkey, mockPublicKey);
	});

	test("verifies signature roundtrip", async () => {
		// Mock fetch
		const mockFetch = mock.fn(() => Promise.resolve({ ok: true }));
		global.fetch = mockFetch;

		const envelopeFields = {
			action: "test",
			actor: "user",
			context: { note: "test", trace_id: "123" },
		};

		const result = await sendSignedAudit(envelopeFields, {
			auditUrl: "http://mock",
		});

		// Verify the signature using NaCl
		const payload = { ...envelopeFields };
		const canonical = canonicalize(payload);
		const payloadBytes = Buffer.from(canonical, "utf8");
		const signature = Buffer.from(result.signature, "base64");
		const publicKey = Buffer.from(result.pubkey, "base64");

		const isValid = nacl.sign.detached.verify(
			payloadBytes,
			signature,
			publicKey,
		);
		assert(isValid);
	});

	test("tamper detection - modified payload fails verification", async () => {
		// Mock fetch
		const mockFetch = mock.fn(() => Promise.resolve({ ok: true }));
		global.fetch = mockFetch;

		const envelopeFields = {
			action: "test",
			actor: "user",
			context: { note: "test", trace_id: "123" },
		};

		const result = await sendSignedAudit(envelopeFields, {
			auditUrl: "http://mock",
		});

		// Modify the payload after signing
		const tamperedPayload = { ...envelopeFields, action: "tampered" };
		const tamperedCanonical = canonicalize(tamperedPayload);
		const tamperedBytes = Buffer.from(tamperedCanonical, "utf8");
		const signature = Buffer.from(result.signature, "base64");
		const publicKey = Buffer.from(result.pubkey, "base64");

		// Verification should fail
		const isValid = nacl.sign.detached.verify(
			tamperedBytes,
			signature,
			publicKey,
		);
		assert(!isValid);
	});
});
