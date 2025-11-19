import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import { app, handleQuestion } from "../server.js";

// Simple mock response/res objects
function makeRes() {
	let statusCode = 200;
	let body = null;
	return {
		status(code) {
			statusCode = code;
			return this;
		},
		json(obj) {
			body = obj;
			// emulate express behavior
			this._body = obj;
			this._status = statusCode;
			return obj;
		},
		_getBody() {
			return body;
		},
	};
}

describe("overmind server handler", () => {
	let origFetch;

	beforeEach(() => {
		origFetch = global.fetch;
	});

	afterEach(() => {
		global.fetch = origFetch;
		// clear any test-injected audit sender
		delete app.locals.auditSender;
	});

	test("uses LiteBrain-provided ticket_id when present", async () => {
		// LiteBrain returns an object with ticket_id
		global.fetch = async () => ({
			json: async () => ({ ticket_id: "LB-42", answer: "ok" }),
		});

		let capturedEnvelope = null;
		const mockAuditSender = async (envelope, opts) => {
			capturedEnvelope = envelope;
			return { event_id: envelope.event_id, signature: "sig", pubkey: "pk" };
		};

		// inject mock audit sender
		app.locals.auditSender = mockAuditSender;

		const req = { query: { input: "hi" }, app };
		const res = makeRes();

		await handleQuestion(req, res);

		assert(capturedEnvelope, "audit envelope should be emitted");
		assert.strictEqual(capturedEnvelope.resource.type, "ticket");
		assert.strictEqual(capturedEnvelope.resource.id, "LB-42");
	});

	test("falls back to generated UUID when LiteBrain does not provide ticket_id", async () => {
		global.fetch = async () => ({ json: async () => ({ answer: "ok" }) });

		let capturedEnvelope = null;
		const mockAuditSender = async (envelope, opts) => {
			capturedEnvelope = envelope;
			return { event_id: envelope.event_id, signature: "sig", pubkey: "pk" };
		};

		app.locals.auditSender = mockAuditSender;

		const req = { query: { input: "hi" }, app };
		const res = makeRes();

		await handleQuestion(req, res);

		assert(capturedEnvelope, "audit envelope should be emitted");
		assert.strictEqual(capturedEnvelope.resource.type, "ticket");
		// id should be a non-empty string and not the literal 'TBD'
		assert.ok(
			typeof capturedEnvelope.resource.id === "string" &&
				capturedEnvelope.resource.id.length > 0,
		);
		assert.notStrictEqual(capturedEnvelope.resource.id, "TBD");
	});
});
