const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "src/__tests__/cost-tracker.test.ts");
let content = fs.readFileSync(file, "utf8");

// Fix task: `task-${i}`duration pattern (missing comma and tokens)
content = content.replace(
	/task:\s*`([^`]+)`\s*duration:/g,
	"task: `$1`,\n        tokens: {\n          inputTokens: 100,\n          outputTokens: 200,\n          totalTokens: 300,\n        },\n        duration:",
);

// Fix any remaining task: 'xxx'tokens: patterns (missing comma)
content = content.replace(
	/task:\s*'([^']+)'\s*tokens:/g,
	"task: '$1',\n        tokens:",
);

// Fix any remaining task: "xxx"tokens: patterns (missing comma)
content = content.replace(
	/task:\s*"([^"]+)"\s*tokens:/g,
	'task: "$1",\n        tokens:',
);

fs.writeFileSync(file, content);
console.log("✅ Fixed all syntax errors");
