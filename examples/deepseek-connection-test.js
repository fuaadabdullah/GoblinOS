#!/usr/bin/env node
// Quick sanity check for DeepSeek connectivity via OpenAI-compatible endpoint
// Usage:
//   DEEPSEEK_API_KEY=sk-... node GoblinOS/examples/deepseek-connection-test.js "Say hello in one sentence."

import OpenAI from "openai";

const prompt =
	process.argv.slice(2).join(" ") || "Respond with: hello from deepseek.";

async function main() {
	const base = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
	const model = process.env.DEEPSEEK_DEFAULT_MODEL || "deepseek-r1";
	const apiKey = process.env.DEEPSEEK_API_KEY;
	if (!apiKey) {
		console.error("DEEPSEEK_API_KEY is not set");
		process.exit(1);
	}
	const client = new OpenAI({
		baseURL: `${base.replace(/\/$/, "")}/v1`,
		apiKey,
	});

	const completion = await client.chat.completions.create({
		model,
		messages: [
			{ role: "system", content: "You are a concise assistant." },
			{ role: "user", content: prompt },
		],
	});

	const choice = completion.choices?.[0];
	const content = Array.isArray(choice?.message?.content)
		? choice.message.content
				.map((p) => (typeof p === "string" ? p : p?.text || ""))
				.join("")
		: choice?.message?.content || "";

	console.log("Model:", completion.model);
	console.log("Reply:", content);
}

main().catch((err) => {
	console.error("Failed to connect to DeepSeek:", err?.message || err);
	process.exit(1);
});
