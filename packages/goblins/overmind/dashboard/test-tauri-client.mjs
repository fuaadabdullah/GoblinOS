import { TauriClient } from "./src/api/tauri-client.js";

// Simple test to verify TauriClient can be imported and initialized
async function testTauriClient() {
	console.log("Testing TauriClient...");

	try {
		const client = new TauriClient();
		console.log("TauriClient created successfully");

		// Test a simple method call (this will fail in web environment but should not crash)
		console.log(
			"TauriClient methods:",
			Object.getOwnPropertyNames(TauriClient.prototype),
		);
		console.log("Test completed successfully");
	} catch (error) {
		console.error("Error creating TauriClient:", error);
	}
}

testTauriClient();
