#!/usr/bin/env node
/**
 * Example: How goblins automatically select and invoke tools
 */

import { getToolSelector } from "../packages/tool-selector/dist/index.js";

const selector = getToolSelector();

console.log("🧙 GoblinOS Tool Selection Examples\n");

// Example 1: Forge Master building
console.log("--- Forge Master: Build Production Bundle ---");
const buildResult = selector.autoSelectToolCommand(
	"dregg-embercode",
	"build production bundle",
);
console.log(`Task: "build production bundle"`);
console.log(`Selected Tool: ${buildResult.tool || "None"}`);
console.log(`Command: ${buildResult.command || "N/A"}`);
console.log(`Reason: ${buildResult.reason}\n`);

// Example 2: Glyph Scribe starting dev server
console.log("--- Glyph Scribe: Start UI Development ---");
const devResult = selector.autoSelectToolCommand(
	"vanta-lumin",
	"start forge lite UI development",
);
console.log(`Task: "start forge lite UI development"`);
console.log(`Selected Tool: ${devResult.tool || "None"}`);
console.log(`Command: ${devResult.command || "N/A"}`);
console.log(`Reason: ${devResult.reason}\n`);

// Example 3: Vermin Huntress running tests
console.log("--- Vermin Huntress: Run Tests ---");
const testResult = selector.autoSelectToolCommand(
	"magnolia-nightbloom",
	"run tests",
);
console.log(`Task: "run tests"`);
console.log(`Selected Tool: ${testResult.tool || "None"}`);
console.log(`Command: ${testResult.command || "N/A"}`);
console.log(`Reason: ${testResult.reason}\n`);

// Example 4: Fine Spellchecker linting
console.log("--- Fine Spellchecker: Check Code Quality ---");
const lintResult = selector.autoSelectToolCommand(
	"launcey-gauge",
	"check code quality",
);
console.log(`Task: "check code quality"`);
console.log(`Selected Tool: ${lintResult.tool || "None"}`);
console.log(`Command: ${lintResult.command || "N/A"}`);
console.log(`Reason: ${lintResult.reason}\n`);

// Example 5: Socketwright starting API
console.log("--- Socketwright: Start API Server ---");
const apiResult = selector.autoSelectToolCommand(
	"volt-furnace",
	"start API server",
);
console.log(`Task: "start API server"`);
console.log(`Selected Tool: ${apiResult.tool || "None"}`);
console.log(`Command: ${apiResult.command || "N/A"}`);
console.log(`Reason: ${apiResult.reason}\n`);

// Example 6: Omenfinder analyzing (no tool)
console.log("--- Omenfinder: Analyze Logs ---");
const logResult = selector.autoSelectToolCommand(
	"mags-charietto",
	"analyze logs",
);
console.log(`Task: "analyze logs"`);
console.log(`Selected Tool: ${logResult.tool || "None (brain only)"}`);
console.log(`Command: ${logResult.command || "N/A"}`);
console.log(`Reason: ${logResult.reason}\n`);

// Tool ownership check
console.log("--- Tool Ownership ---");
console.log(
	`forge-lite-build owners:`,
	selector.getToolOwners("forge-lite-build"),
);
console.log(
	`huntress-guild-analyze-tests owners:`,
	selector.getToolOwners("huntress-guild-analyze-tests"),
);
console.log(
	`mages-guild-quality-lint owners:`,
	selector.getToolOwners("mages-guild-quality-lint"),
);
console.log(
	`\nDregg Embercode can invoke forge-lite-build:`,
	selector.canInvokeTool("dregg-embercode", "forge-lite-build"),
);
console.log(
	`Vanta Lumin can invoke forge-lite-dev:`,
	selector.canInvokeTool("vanta-lumin", "forge-lite-dev"),
);
console.log(
	`Volt Furnace can invoke forge-lite-api-dev:`,
	selector.canInvokeTool("volt-furnace", "forge-lite-api-dev"),
);
