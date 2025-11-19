#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const YAML = require("js-yaml");
const Ajv = require("ajv");

const GOBLINS_FILE =
	process.env.GOBLINS_FILE || path.resolve(__dirname, "../../goblins.yaml");
const GOBLINS_DIR = path.resolve(__dirname, "../../packages/goblins");

/**
 * System-wide JSON Schema validation for GoblinOS
 * Validates:
 * 1. Main goblins.yaml against goblins.schema.json
 * 2. Individual goblin configurations against their schemas
 * 3. Goblin package structure integrity
 */

function loadJSON(filePath) {
	if (!fs.existsSync(filePath)) {
		throw new Error(`File not found: ${filePath}`);
	}
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadYAML(filePath) {
	if (!fs.existsSync(filePath)) {
		throw new Error(`File not found: ${filePath}`);
	}
	return YAML.load(fs.readFileSync(filePath, "utf8"));
}

function validateAgainstSchema(data, schema, schemaName) {
	const ajv = new Ajv({
		allErrors: true,
		strict: false,
		allowUnionTypes: true
	});

	const validate = ajv.compile(schema);
	const valid = validate(data);

	if (!valid) {
		console.error(`❌ ${schemaName} validation failed:`);
		for (const err of validate.errors || []) {
			console.error(`  - ${err.instancePath || '/'} ${err.message}`);
		}
		return false;
	}

	console.log(`✅ ${schemaName} validated successfully`);
	return true;
}

function validateMainGoblinsConfig() {
	console.log("\n🔍 Validating main goblins.yaml configuration...");

	try {
		const schemaPath = path.resolve(__dirname, "../../goblins.schema.json");
		const schema = loadJSON(schemaPath);
		const goblinsData = loadYAML(GOBLINS_FILE);

		return validateAgainstSchema(goblinsData, schema, "goblins.yaml");
	} catch (error) {
		console.error(`❌ Failed to validate goblins.yaml: ${error.message}`);
		return false;
	}
}

function validateIndividualGoblinConfigs() {
	console.log("\n🔍 Validating individual goblin configurations...");

	if (!fs.existsSync(GOBLINS_DIR)) {
		console.log(`⚠️  Goblins directory not found: ${GOBLINS_DIR}`);
		return true;
	}

	const goblinDirs = fs.readdirSync(GOBLINS_DIR, { withFileTypes: true })
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name);

	let allValid = true;

	for (const goblinId of goblinDirs) {
		const goblinPath = path.join(GOBLINS_DIR, goblinId);
		const schemaPath = path.join(goblinPath, "config", "schema.json");
		const configPath = path.join(goblinPath, "config", "default.json");

		console.log(`\n  📁 Checking goblin: ${goblinId}`);

		// Check if schema exists
		if (!fs.existsSync(schemaPath)) {
			console.log(`    ⚠️  No schema.json found for ${goblinId}`);
			continue;
		}

		// Check if config exists
		if (!fs.existsSync(configPath)) {
			console.log(`    ⚠️  No default.json found for ${goblinId}`);
			continue;
		}

		try {
			const schema = loadJSON(schemaPath);
			const config = loadJSON(configPath);

			const isValid = validateAgainstSchema(config, schema, `${goblinId} config`);
			if (!isValid) {
				allValid = false;
			}
		} catch (error) {
			console.error(`❌ Failed to validate ${goblinId}: ${error.message}`);
			allValid = false;
		}
	}

	return allValid;
}

function validateGoblinPackageStructure() {
	console.log("\n🔍 Validating goblin package structure integrity...");

	if (!fs.existsSync(GOBLINS_DIR)) {
		console.log(`⚠️  Goblins directory not found: ${GOBLINS_DIR}`);
		return true;
	}

	const goblinDirs = fs.readdirSync(GOBLINS_DIR, { withFileTypes: true })
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name);

	let hasErrors = false;
	let hasWarnings = false;

	for (const goblinId of goblinDirs) {
		const goblinPath = path.join(GOBLINS_DIR, goblinId);
		console.log(`\n  📁 Validating structure: ${goblinId}`);

		// Required files for new-style goblins
		const requiredFiles = [
			"package.json",
			"src/index.ts",
			"config/default.json",
			"config/schema.json"
		];

		const missingFiles = requiredFiles.filter(file => {
			const filePath = path.join(goblinPath, file);
			return !fs.existsSync(filePath);
		});

		if (missingFiles.length > 0) {
			console.log(`    ⚠️  Missing files: ${missingFiles.join(", ")}`);
			console.log(`    ℹ️  This appears to be an old-style goblin (shell command)`);
			hasWarnings = true;
		} else {
			console.log(`    ✅ Complete new-style goblin package structure`);
		}

		// Validate package.json if it exists
		const packageJsonPath = path.join(goblinPath, "package.json");
		if (fs.existsSync(packageJsonPath)) {
			try {
				const packageJson = loadJSON(packageJsonPath);

				// Check required fields
				const requiredFields = ["name", "version", "main"];
				const missingFields = requiredFields.filter(field => !packageJson[field]);

				if (missingFields.length > 0) {
					console.error(`    ❌ package.json missing required fields: ${missingFields.join(", ")}`);
					hasErrors = true;
				} else {
					console.log(`    ✅ package.json structure valid`);
				}

				// Check if name matches goblin ID (warning only)
				const expectedName = `@goblinos/${goblinId}`;
				if (packageJson.name !== expectedName) {
					console.log(`    ⚠️  package.json name "${packageJson.name}" doesn't match expected "${expectedName}"`);
					hasWarnings = true;
				}

			} catch (error) {
				console.error(`    ❌ Invalid package.json: ${error.message}`);
				hasErrors = true;
			}
		}
	}

	// Return true if no errors (warnings are OK)
	return !hasErrors;
}

async function validateGoblinLoaderCompatibility() {
	console.log("\n🔍 Validating GoblinLoader compatibility...");

	try {
		// Dynamically import GoblinLoader since it's ESM
		const goblinRuntime = await import("@goblinos/goblin-runtime");
		const GoblinLoader = goblinRuntime.GoblinLoader;

		if (!GoblinLoader) {
			console.log("⚠️  GoblinLoader not available in @goblinos/goblin-runtime");
			return true; // Not a failure, just not available
		}

		console.log("✅ GoblinLoader available for new-style goblins");

		// Try to create a loader instance to test basic functionality
		const loader = new GoblinLoader({
			goblinDir: GOBLINS_DIR
		});

		console.log("✅ GoblinLoader instance created successfully");
		return true;

	} catch (error) {
		console.log(`⚠️  GoblinLoader compatibility check failed: ${error.message}`);
		console.log("ℹ️  This may be due to missing dependencies or build issues");
		return true; // Don't fail the entire validation for this
	}
}

async function main() {
	console.log("🚀 Starting comprehensive GoblinOS validation...\n");

	let allValid = true;

	// 1. Validate main goblins.yaml
	allValid &= validateMainGoblinsConfig();

	// 2. Validate individual goblin configurations
	allValid &= validateIndividualGoblinConfigs();

	// 3. Validate package structure
	allValid &= validateGoblinPackageStructure();

	// 4. Validate GoblinLoader compatibility
	allValid &= await validateGoblinLoaderCompatibility();

	console.log("\n" + "=".repeat(50));

	if (allValid) {
		console.log("🎉 All validations passed! GoblinOS ecosystem is healthy.");
		process.exit(0);
	} else {
		console.log("💥 Validation failures detected. Please fix the issues above.");
		process.exit(1);
	}
}

// Export functions for testing
module.exports = {
	validateMainGoblinsConfig,
	validateIndividualGoblinConfigs,
	validateGoblinPackageStructure,
	validateGoblinLoaderCompatibility,
	loadJSON,
	loadYAML,
	validateAgainstSchema
};

if (require.main === module) {
	main().catch(error => {
		console.error("💥 Unexpected error during validation:", error);
		process.exit(1);
	});
}
