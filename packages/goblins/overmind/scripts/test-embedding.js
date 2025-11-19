#!/usr/bin/env node
import { createOvermind } from "../dist/index.js";

async function run() {
	const overmind = createOvermind();
	console.log("Overmind created");

	const content = "Test unique embedding content " + Date.now();
	console.log("Storing content:", content);
	const id1 = await overmind.rememberFact(content, { tags: ["test"] });
	console.log("First store id:", id1);

	// Attempt idempotency search by invoking searchMemory
	const searchResults = await overmind.searchMemory(content, 10);
	console.log("Search results after first store:", searchResults);

	// Store again (simulate embedding endpoint trying to store same content)
	const id2 = await overmind.rememberFact(content, { tags: ["test"] });
	console.log("Second store id (should be new id unless de-duplicated):", id2);

	const searchResults2 = await overmind.searchMemory(content, 10);
	console.log("Search results after second store:", searchResults2);

	// Print stats
	const stats = await overmind.getMemoryStats();
	console.log("Memory stats:", stats);
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
