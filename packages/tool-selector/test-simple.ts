#!/usr/bin/env node

/**
 * Simple test script for ToolSelector functionality
 * Run with: cd /Users/fuaadabdullah/ForgeMonorepo/GoblinOS && node --loader tsx/esm packages/tool-selector/test-simple.ts
 */

import { ToolSelector } from "./index.js";

function testToolSelector() {
	console.log("🧪 Testing ToolSelector functionality...\n");

	try {
		const selector = new ToolSelector();

		// Test 1: Valid tool selection
		console.log("Test 1: Valid tool selection");
		const result1 = selector.autoSelectToolCommand("dregg-embercode", "build production bundle");
		console.log("Input: 'build production bundle'");
		console.log("Result:", JSON.stringify(result1, null, 2));
		console.log("");

		// Test 2: No tool found
		console.log("Test 2: No tool found");
		const result2 = selector.autoSelectToolCommand("dregg-embercode", "write poetry");
		console.log("Input: 'write poetry'");
		console.log("Result:", JSON.stringify(result2, null, 2));
		console.log("");

		// Test 3: Ownership validation
		console.log("Test 3: Ownership validation");
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
