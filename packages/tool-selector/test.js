#!/usr/bin/env node

/**
 * Simple test script for ToolSelector functionality
 */

import { getToolSelector } from "./dist/index.js";

async function testToolSelector() {
	console.log("🧪 Testing ToolSelector functionality...\n");

	const selector = getToolSelector();

	try {
		// Test 1: Valid tool selection
		console.log("Test 1: Valid tool selection");
		const result1 = selector.autoSelectToolCommand("dregg-embercode", "build production bundle");
		console.log("Input: 'build production bundle'");
		console.log("Result:", result1);
		console.log("");

		// Test 2: No tool found
		console.log("Test 2: No tool found");
		const result2 = selector.autoSelectToolCommand("dregg-embercode", "write poetry");
		console.log("Input: 'write poetry'");
		console.log("Result:", result2);
		console.log("");

		// Test 3: Invalid goblin
		console.log("Test 3: Invalid goblin");
		try {
			const result3 = selector.autoSelectToolCommand("nonexistent-goblin", "build something");
			console.log("This shouldn't print");
		} catch (error) {
			console.log("Expected error:", error.message);
		}
		console.log("");

		// Test 4: Ownership validation
		console.log("Test 4: Ownership validation");
		const ownedTools = selector.getOwnedTools("dregg-embercode");
		console.log("dregg-embercode owns:", ownedTools);

		const canInvoke = selector.canInvokeTool("dregg-embercode", "forge-lite-build");
		console.log("Can dregg-embercode invoke forge-lite-build?", canInvoke);

		console.log("\n✅ All tests completed!");

	} catch (error) {
		console.error("❌ Test failed:", error);
		process.exit(1);
	}
}

testToolSelector();
