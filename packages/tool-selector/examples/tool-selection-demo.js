#!/usr/bin/env node
/*
 * Tool Selector Demo
 * Demonstrates autoSelectToolCommand for multiple goblins and intents.
 */
import { getToolSelector } from "../dist/index.js";

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

async function main() {
  const selector = getToolSelector();

  const tests = [
    { goblin: "dregg-embercode", intent: "build production bundle" },
    { goblin: "magnolia-nightbloom", intent: "analyze tests" },
    { goblin: "launcey-gauge", intent: "run linters" },
    { goblin: "vanta-lumin", intent: "start portfolio dev server" },
    { goblin: "mags-charietto", intent: "analyze logs for errors" },
    { goblin: "sentenial-ledgerwarden", intent: "rotate secrets" },
    { goblin: "hex-oracle", intent: "forecast release risk" },
  ];

  for (const t of tests) {
    try {
      const result = selector.autoSelectToolCommand(t.goblin, t.intent);
      console.log(`\n➤ Goblin: ${t.goblin} | Intent: "${t.intent}"`);
      console.log(pretty(result));
    } catch (err) {
      console.error(`\n⚠️ Error selecting tool for ${t.goblin}:`, err.message);
    }
  }

  // Demonstrate multi-tool selection
  console.log("\n➤ Multi-tool selection (analyze tests and triage regression)");
  const multi = selector.autoSelectToolChain(
    "magnolia-nightbloom",
    "analyze tests and triage regression",
  );
  console.log(pretty(multi));
}

main();
