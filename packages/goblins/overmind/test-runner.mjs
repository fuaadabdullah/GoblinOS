/**
 * Simple Integration Test Runner
 *
 * Runs the integration test to validate Overmind structured outputs
 */

import { runIntegrationTest } from "./src/integration-test.ts";

async function main() {
	try {
		console.log("🧪 Running Overmind Integration Test...\n");
		await runIntegrationTest();
		console.log("\n✅ Integration test completed successfully!");
	} catch (error) {
		console.error("\n❌ Integration test failed:", error);
		process.exit(1);
	}
}

main();
