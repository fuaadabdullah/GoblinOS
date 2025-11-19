// Deterministic JSON canonicalization: recursively sort object keys and
// produce a compact JSON string. Matches Python json.dumps(..., sort_keys=True, separators=(',', ':'), ensure_ascii=False)
export function canonicalize(obj) {
	function sortRec(v) {
		if (v === null) return null;
		if (Array.isArray(v)) return v.map(sortRec);
		if (typeof v === "object") {
			const keys = Object.keys(v).sort();
			const out = {};
			for (const k of keys) {
				out[k] = sortRec(v[k]);
			}
			return out;
		}
		return v;
	}

	const sorted = sortRec(obj);
	// JSON.stringify in Node produces compact output by default (no spaces)
	return JSON.stringify(sorted);
}
