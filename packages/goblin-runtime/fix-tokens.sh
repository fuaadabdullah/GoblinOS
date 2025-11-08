#!/bin/bash
# Fix all CostTracker test token structures

TEST_FILE="/Users/fuaadabdullah/ForgeMonorepo/GoblinOS/packages/goblin-runtime/src/__tests__/cost-tracker.test.ts"

echo "🔧 Fixing CostTracker test token structures..."

# Create a Node.js script to fix the token structures
node << 'EOF'
const fs = require('fs');

const testFile = '/Users/fuaadabdullah/ForgeMonorepo/GoblinOS/packages/goblin-runtime/src/__tests__/cost-tracker.test.ts';
let content = fs.readFileSync(testFile, 'utf8');

// Pattern to match tracker.record calls with flat token properties
const patterns = [
  // Pattern 1: inputTokens and outputTokens on separate lines
  {
    regex: /tracker\.record\(\{([^}]*?)\s+inputTokens:\s*(\d+),([^}]*?)\s+outputTokens:\s*(\d+),([^}]*?)\}\)/gs,
    replacer: (match, before, input, middle, output, after) => {
      // Clean up the parts
      const beforeClean = before.trim();
      const middleClean = middle.trim();
      const afterClean = after.trim();
      const total = parseInt(input) + parseInt(output);

      // Reconstruct without comments in middle/after for simplicity
      const beforeLines = beforeClean.split('\n').map(l => '        ' + l.trim()).join('\n');
      const afterLines = afterClean.split('\n').map(l => '        ' + l.trim()).join('\n');

      return `tracker.record({
${beforeLines},
        tokens: {
          inputTokens: ${input},
          outputTokens: ${output},
          totalTokens: ${total},
        },
${afterLines}
      })`;
    }
  }
];

// Apply all patterns
patterns.forEach(({ regex, replacer }) => {
  content = content.replace(regex, replacer);
});

fs.writeFileSync(testFile, content);
console.log('✅ Fixed token structures in cost-tracker.test.ts');
EOF

echo "✅ Done!"
