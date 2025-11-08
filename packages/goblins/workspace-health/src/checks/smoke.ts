export async function runSmoke(url?: string): Promise<number> {
	if (!url) return 0; // optional
	const ok = await fetch(url)
		.then((r) => r.ok)
		.catch(() => false);
	console.log(`[smoke] ${url} -> ${ok ? "OK" : "FAIL"}`);
	return ok ? 0 : 1;
}
