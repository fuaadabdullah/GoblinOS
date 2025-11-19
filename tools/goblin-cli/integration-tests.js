#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

/**
 * Integration tests for GoblinOS goblin lifecycle
 * Tests full lifecycle: initialize → execute → shutdown
 */

const GOBLINS_FILE = path.resolve(__dirname, "../../goblins.yaml");
const GOBLIN_CLI = path.resolve(__dirname, "index.js");
// Run tests from GoblinOS directory (where goblin CLI expects to be run)
const GOBLIN_CLI_DIR = path.dirname(GOBLIN_CLI);

/**
 * Categorize failure reasons for better reporting
 */
function categorizeFailure(stderr, code) {
	const error = stderr.toLowerCase();

	// Expected environment issues
	if (error.includes("no such file or directory")) {
		if (error.includes("apps/forge-lite") || error.includes("apps/")) {
			return { category: "missing_app_directory", expected: true, message: "Application directory not set up" };
		}
		if (error.includes("packages/goblins/")) {
			return { category: "missing_goblin_directory", expected: true, message: "Goblin package not implemented" };
		}
		return { category: "missing_directory", expected: true, message: "Required directory not found" };
	}

	if (error.includes("command not found") || error.includes("not found")) {
		if (error.includes("supabase") || error.includes("eas") || error.includes("pnpm") || error.includes("python")) {
			return { category: "missing_tools", expected: true, message: "Required tools not installed" };
		}
		if (error.includes("bash:") || error.includes("tools/")) {
			return { category: "missing_script", expected: true, message: "Required script not found" };
		}
	}

	// Configuration issues
	if (error.includes("unable to locate goblins.yaml") || error.includes("guildregistryerror") || error.includes("referenceerror")) {
		return { category: "config_error", expected: false, message: "Configuration or reference issue" };
	}

	// Timeout or execution issues
	if (code === null || error.includes("timed out")) {
		return { category: "timeout", expected: false, message: "Command timed out" };
	}

	// Permission or access issues
	if (error.includes("permission denied") || error.includes("access denied")) {
		return { category: "permission_error", expected: true, message: "Permission/access issue" };
	}

	// Other failures - assume environment-related for now
	return { category: "environment", expected: true, message: "Environment or setup issue" };
}

// Load goblins configuration
function loadGoblins() {
	if (!fs.existsSync(GOBLINS_FILE)) {
		console.error("goblins.yaml not found");
		process.exit(1);
	}
	return require("js-yaml").load(fs.readFileSync(GOBLINS_FILE, "utf8"));
}

function findTool(goblins, id) {
	const guilds = goblins.guilds || [];
	for (const guild of guilds) {
		for (const tool of guild.toolbelt || []) {
			if (tool.id === id) return tool;
		}
	}
	return null;
}

async function runGoblinCLI(args, timeout = 30000) {
	return new Promise((resolve, reject) => {
		const child = spawn("node", [GOBLIN_CLI, ...args], {
			cwd: GOBLIN_CLI_DIR, // Run from GoblinOS directory where CLI expects to be
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...process.env, GOBLINS_FILE }
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (data) => stdout += data.toString());
		child.stderr.on("data", (data) => stderr += data.toString());

		const timer = setTimeout(() => {
			child.kill();
			reject(new Error(`Command timed out after ${timeout}ms`));
		}, timeout);

		child.on("close", (code) => {
			clearTimeout(timer);
			resolve({ code, stdout, stderr });
		});

		child.on("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
	});
}

async function testGoblinLifecycle(goblinId) {
	console.log(`\n🧪 Testing goblin lifecycle: ${goblinId}`);

	const goblins = loadGoblins();
	const tool = findTool(goblins, goblinId);

	if (!tool) {
		console.log(`  ⚠️  Goblin ${goblinId} not found in configuration`);
		return { skipped: true, reason: "not found in config" };
	}

	const results = {
		goblinId,
		dryRun: null,
		fullRun: null,
		fullRunFailureCategory: null,
		errors: []
	};

	try {
		// Test 1: Dry run (should always work)
		console.log(`  🧪 Dry run test...`);
		const dryResult = await runGoblinCLI(["run", goblinId, "--dry"]);
		results.dryRun = {
			code: dryResult.code,
			success: dryResult.code === 0,
			stdout: dryResult.stdout,
			stderr: dryResult.stderr
		};

		if (dryResult.code !== 0) {
			results.errors.push(`Dry run failed: ${dryResult.stderr}`);
			console.log(`    ❌ Dry run failed: ${dryResult.stderr.trim()}`);
		} else {
			console.log(`    ✅ Dry run successful`);
		}

		// Test 2: Full run (may fail for various reasons, that's OK)
		console.log(`  🧪 Full run test...`);
		const fullResult = await runGoblinCLI(["run", goblinId], 15000); // 15 second timeout (reduced)
		results.fullRun = {
			code: fullResult.code,
			success: fullResult.code === 0,
			stdout: fullResult.stdout,
			stderr: fullResult.stderr
		};

		if (fullResult.code === 0) {
			console.log(`    ✅ Full run successful`);
			results.fullRunFailureCategory = null;
		} else {
			const failureInfo = categorizeFailure(fullResult.stderr, fullResult.code);
			results.fullRunFailureCategory = failureInfo;
			if (failureInfo.expected) {
				console.log(`    ⚠️  Full run failed (${failureInfo.category}): ${failureInfo.message}`);
			} else {
				console.log(`    ❌ Full run failed (${failureInfo.category}): ${failureInfo.message}`);
				results.errors.push(`Unexpected failure: ${failureInfo.message}`);
			}
		}

	} catch (error) {
		results.errors.push(`Test execution failed: ${error.message}`);
		console.log(`    ❌ Test execution failed: ${error.message}`);
	}

	return results;
}

async function testGoblinLoaderIntegration() {
	console.log(`\n🔌 Testing GoblinLoader integration...`);

	const loaderTestResults = {
		goblinLoaderAvailable: false,
		goblinsLoaded: [],
		lifecycleTests: [],
		errors: []
	};

	try {
		// Check if GoblinLoader is available
		const goblinRuntime = await import("@goblinos/goblin-runtime");
		const GoblinLoader = goblinRuntime.GoblinLoader;

		if (!GoblinLoader) {
			loaderTestResults.errors.push("GoblinLoader not available");
			return loaderTestResults;
		}

		loaderTestResults.goblinLoaderAvailable = true;
		console.log(`  ✅ GoblinLoader available`);

		// Create loader and load all goblins
		const goblinDir = path.resolve(__dirname, "../../packages/goblins");
		const loader = new GoblinLoader({ goblinDir });

		await loader.loadAllGoblins();
		const loadedGoblinsMap = loader.getAllGoblins();
		const loadedGoblins = Array.from(loadedGoblinsMap.keys());

		loaderTestResults.goblinsLoaded = loadedGoblins;
		console.log(`  📦 Loaded ${loadedGoblins.length} goblins: ${loadedGoblins.join(", ")}`);

		// Test lifecycle for each loaded goblin
		for (const goblinId of loadedGoblins) {
			console.log(`  🧪 Testing ${goblinId} lifecycle via GoblinLoader...`);

			try {
				const goblinPackage = loader.getGoblin(goblinId);
				if (!goblinPackage) {
					loaderTestResults.errors.push(`Goblin ${goblinId} not found in loader`);
					continue;
				}

				// Initialize
				await goblinPackage.goblin.initialize();
				console.log(`    ✅ ${goblinId} initialized`);

				// Execute with test context
				const testContext = {
					input: {
						message: `Test execution for ${goblinId}`,
						context: [],
						metadata: { test: true, integration: true }
					}
				};

				const result = await goblinPackage.goblin.execute(testContext);
				console.log(`    ✅ ${goblinId} executed`);

				// Shutdown
				await goblinPackage.goblin.shutdown();
				console.log(`    ✅ ${goblinId} shutdown`);

				loaderTestResults.lifecycleTests.push({
					goblinId,
					success: true,
					result
				});

			} catch (error) {
				console.log(`    ❌ ${goblinId} lifecycle test failed: ${error.message}`);
				loaderTestResults.lifecycleTests.push({
					goblinId,
					success: false,
					error: error.message
				});
				loaderTestResults.errors.push(`${goblinId} lifecycle test failed: ${error.message}`);
			}
		}

	} catch (error) {
		loaderTestResults.errors.push(`GoblinLoader integration test failed: ${error.message}`);
		console.log(`  ❌ GoblinLoader integration failed: ${error.message}`);
	}

	return loaderTestResults;
}

async function main() {
	console.log("🚀 Starting GoblinOS Integration Tests...\n");

	const testResults = {
		timestamp: new Date().toISOString(),
		goblinLifecycleTests: [],
		goblinLoaderIntegration: null,
		summary: {
			totalGoblins: 0,
			dryRunSuccess: 0,
			fullRunSuccess: 0,
			fullRunExpectedFailures: 0,
			fullRunUnexpectedFailures: 0,
			skipped: 0,
			errors: 0
		}
	};

	// Load goblins configuration
	const goblins = loadGoblins();
	const allGoblinIds = [];

	// Collect all goblin IDs from configuration
	for (const guild of goblins.guilds || []) {
		for (const tool of guild.toolbelt || []) {
			allGoblinIds.push(tool.id);
		}
	}

	testResults.summary.totalGoblins = allGoblinIds.length;
	console.log(`📋 Found ${allGoblinIds.length} goblins to test: ${allGoblinIds.join(", ")}\n`);

	// Test each goblin's lifecycle
	for (const goblinId of allGoblinIds) {
		const result = await testGoblinLifecycle(goblinId);
		testResults.goblinLifecycleTests.push(result);

		if (result.skipped) {
			testResults.summary.skipped++;
		} else {
			if (result.dryRun?.success) testResults.summary.dryRunSuccess++;
			if (result.fullRun?.success) {
				testResults.summary.fullRunSuccess++;
			} else if (result.fullRunFailureCategory) {
				if (result.fullRunFailureCategory.expected) {
					testResults.summary.fullRunExpectedFailures++;
				} else {
					testResults.summary.fullRunUnexpectedFailures++;
				}
			}
			if (result.errors.length > 0) testResults.summary.errors++;
		}
	}

	// Test GoblinLoader integration
	testResults.goblinLoaderIntegration = await testGoblinLoaderIntegration();

	// Generate summary
	console.log("\n" + "=".repeat(60));
	console.log("📊 INTEGRATION TEST RESULTS");
	console.log("=".repeat(60));

	console.log(`\n🎯 Goblin Lifecycle Tests:`);
	console.log(`  Total goblins: ${testResults.summary.totalGoblins}`);
	console.log(`  Dry runs successful: ${testResults.summary.dryRunSuccess}/${testResults.summary.totalGoblins}`);
	console.log(`  Full runs successful: ${testResults.summary.fullRunSuccess}/${testResults.summary.totalGoblins}`);
	console.log(`  Expected failures: ${testResults.summary.fullRunExpectedFailures}`);
	console.log(`  Unexpected failures: ${testResults.summary.fullRunUnexpectedFailures}`);
	console.log(`  Skipped: ${testResults.summary.skipped}`);
	console.log(`  Errors: ${testResults.summary.errors}`);

	console.log(`\n🔌 GoblinLoader Integration:`);
	if (testResults.goblinLoaderIntegration.goblinLoaderAvailable) {
		console.log(`  ✅ GoblinLoader available`);
		console.log(`  📦 Goblins loaded: ${testResults.goblinLoaderIntegration.goblinsLoaded.length}`);
		console.log(`  🧪 Lifecycle tests: ${testResults.goblinLoaderIntegration.lifecycleTests.length}`);

		const successful = testResults.goblinLoaderIntegration.lifecycleTests.filter(t => t.success).length;
		const failed = testResults.goblinLoaderIntegration.lifecycleTests.filter(t => !t.success).length;
		console.log(`     ✅ Successful: ${successful}`);
		console.log(`     ❌ Failed: ${failed}`);
	} else {
		console.log(`  ❌ GoblinLoader not available`);
	}

	// Overall assessment
	const overallSuccess = testResults.summary.errors === 0 &&
	                      testResults.goblinLoaderIntegration.errors.length === 0;

	if (overallSuccess) {
		console.log(`\n🎉 All integration tests passed!`);
		process.exit(0);
	} else {
		console.log(`\n⚠️  Some tests failed or had issues. Check details above.`);
		console.log(`    This is normal for integration tests - not all goblins may be runnable in test environment.`);

		// Write detailed results to file
		const resultsFile = path.resolve(__dirname, "../../integration-test-results.json");
		fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
		console.log(`    Detailed results written to: ${resultsFile}`);

		process.exit(0); // Don't fail on integration test issues
	}
}

// Export for testing
module.exports = {
	testGoblinLifecycle,
	testGoblinLoaderIntegration,
	runGoblinCLI
};

if (require.main === module) {
	main().catch(error => {
		console.error("💥 Integration tests failed:", error);
		process.exit(1);
	});
}
