const fs = require("fs");
const path = require("path");

// Fix cost-tracker.test.ts
const costTrackerFile = path.join(
	__dirname,
	"src/__tests__/cost-tracker.test.ts",
);
let content = fs.readFileSync(costTrackerFile, "utf8");

// Fix each tracker.record call - find pattern and replace
// Pattern: tracker.record({ ... inputTokens: X, ... outputTokens: Y, ... })
const recordCalls = content.match(/tracker\.record\(\{[\s\S]*?\}\)/g);

if (recordCalls) {
	recordCalls.forEach((call) => {
		// Check if already has tokens object
		if (call.includes("tokens: {")) {
			return; // Skip already fixed
		}

		// Extract inputTokens and outputTokens values
		const inputMatch = call.match(/inputTokens:\s*(\d+)/);
		const outputMatch = call.match(/outputTokens:\s*(\d+)/);

		if (inputMatch && outputMatch) {
			const input = inputMatch[1];
			const output = outputMatch[1];
			const total = Number.parseInt(input) + Number.parseInt(output);

			// Remove the flat inputTokens and outputTokens lines
			let newCall = call
				.replace(/,?\s*inputTokens:\s*\d+,?\s*(\/\/.*)?(\n|\r\n)?/g, "")
				.replace(/,?\s*outputTokens:\s*\d+,?\s*(\/\/.*)?(\n|\r\n)?/g, "");

			// Find where to insert tokens object (after task field)
			const taskMatch = newCall.match(/(task:\s*'[^']*',?\s*)/);
			if (taskMatch) {
				const insertAfter = taskMatch[0];
				const tokensObj = `tokens: {\n          inputTokens: ${input},\n          outputTokens: ${output},\n          totalTokens: ${total},\n        },\n        `;
				newCall = newCall.replace(
					insertAfter,
					insertAfter + "\n        " + tokensObj,
				);
			}

			content = content.replace(call, newCall);
		}
	});
}

fs.writeFileSync(costTrackerFile, content);
console.log("✅ Fixed cost-tracker.test.ts");
