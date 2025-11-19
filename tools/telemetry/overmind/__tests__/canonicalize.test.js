import assert from "node:assert";
import { describe, test } from "node:test";
import { canonicalize } from "../canonicalize.js";

describe("canonicalize", () => {
	test("sorts object keys alphabetically", () => {
		const obj = { z: 1, a: 2, m: 3 };
		assert.strictEqual(canonicalize(obj), '{"a":2,"m":3,"z":1}');
	});

	test("handles nested objects recursively", () => {
		const obj = { b: { z: 1, a: 2 }, a: 1 };
		assert.strictEqual(canonicalize(obj), '{"a":1,"b":{"a":2,"z":1}}');
	});

	test("handles arrays", () => {
		const obj = { arr: [3, 1, 2], a: 1 };
		assert.strictEqual(canonicalize(obj), '{"a":1,"arr":[3,1,2]}');
	});

	test("handles arrays with objects", () => {
		const obj = {
			arr: [
				{ b: 1, a: 2 },
				{ d: 3, c: 4 },
			],
		};
		assert.strictEqual(
			canonicalize(obj),
			'{"arr":[{"a":2,"b":1},{"c":4,"d":3}]}',
		);
	});

	test("handles null values", () => {
		const obj = { a: null, b: 1 };
		assert.strictEqual(canonicalize(obj), '{"a":null,"b":1}');
	});

	test("handles primitive values", () => {
		assert.strictEqual(canonicalize("string"), '"string"');
		assert.strictEqual(canonicalize(42), "42");
		assert.strictEqual(canonicalize(true), "true");
		assert.strictEqual(canonicalize(null), "null");
	});

	test("produces consistent output", () => {
		const obj1 = { z: 1, a: 2, m: 3 };
		const obj2 = { a: 2, m: 3, z: 1 };
		assert.strictEqual(canonicalize(obj1), canonicalize(obj2));
	});

	test('matches Python json.dumps with sort_keys=True, separators=(",", ":"), ensure_ascii=False', () => {
		// This test ensures parity with Python canonicalization
		const obj = {
			action: "test",
			actor: "user",
			context: { note: "test", trace_id: "123" },
		};
		const expected =
			'{"action":"test","actor":"user","context":{"note":"test","trace_id":"123"}}';
		assert.strictEqual(canonicalize(obj), expected);
	});
});
