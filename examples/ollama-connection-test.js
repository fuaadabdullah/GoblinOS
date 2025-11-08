#!/usr/bin/env node
// Quick sanity check for Ollama connectivity via OpenAI-compatible endpoint
// Usage:
//   OLLAMA_BASE_URL=http://localhost:11434 OLLAMA_DEFAULT_MODEL=llama3.2 \
//   node GoblinOS/examples/ollama-connection-test.js "Say hello in one sentence."

import OpenAI from "openai";

const prompt =
	process.argv.slice(2).join(" ") || "Respond with: hello from ollama.";

async function main() {
	const base = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
	const model = process.env.OLLAMA_DEFAULT_MODEL || "llama3.2";
	const client = new OpenAI({
		baseURL: `${base.replace(/\/$/, "")}/v1`,
		apiKey: "ollama",
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
	console.error("Failed to connect to Ollama:", err?.message || err);
	process.exit(1);
});
