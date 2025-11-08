const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "src/__tests__/cost-tracker.test.ts");
let content = fs.readFileSync(file, "utf8");

// Fix missing commas before tokens: {
content = content.replace(/\n(\s*)tokens: {/g, ",\n$1tokens: {");

// Remove duplicate commas
content = content.replace(/,,/g, ",");

fs.writeFileSync(file, content);
console.log("✅ Fixed missing commas");
