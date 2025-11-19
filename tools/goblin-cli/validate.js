#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const YAML = require("js-yaml");
const Ajv = require("ajv");

const schemaPath =
	process.env.GOBLIN_SCHEMA ||
	path.resolve(__dirname, "../../goblins.schema.json");
const goblinsPath =
	process.env.GOBLINS_FILE || path.resolve(__dirname, "../../goblins.yaml");

function loadJSON(p) {
	if (!fs.existsSync(p)) throw new Error("Schema not found: " + p);
	return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadGoblins(p) {
	if (!fs.existsSync(p)) throw new Error("goblins.yaml not found: " + p);
	return YAML.load(fs.readFileSync(p, "utf8"));
}

function main() {
	try {
		const schema = loadJSON(schemaPath);
		const data = loadGoblins(goblinsPath);
		const ajv = new Ajv({ allErrors: true });
		const validate = ajv.compile(schema);
		const valid = validate(data);
		if (!valid) {
			console.error("goblins.yaml validation failed:");
			for (const err of validate.errors || []) {
				console.error("-", err.instancePath, err.message);
			}
			process.exit(2);
		}
		console.log("goblins.yaml validated OK against", schemaPath);
		process.exit(0);
	} catch (err) {
		console.error(err && err.message ? err.message : String(err));
		process.exit(3);
	}
}

if (require.main === module) main();

module.exports = { main };
