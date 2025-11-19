import { TauriClient } from "./src/api/tauri-client.js";

async function testTauriClient() {
	console.log("Testing TauriClient...");

	const client = new TauriClient();

	try {
		// Test basic connection
		console.log("Testing getGoblins...");
		const goblins = await client.getGoblins();
		console.log("Goblins:", goblins);

		console.log("Testing getStats...");
		const stats = await client.getStats("test-goblin");
		console.log("Stats:", stats);

		console.log("Testing getHistory...");
		const history = await client.getHistory("test-goblin");
		console.log("History:", history);

		console.log("All tests passed!");
	} catch (error) {
		console.error("Test failed:", error);
	}
}

testTauriClient();
