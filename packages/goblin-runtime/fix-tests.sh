#!/bin/bash
# Auto-fix test API mismatches

set -e

RUNTIME_DIR="/Users/fuaadabdullah/ForgeMonorepo/GoblinOS/packages/goblin-runtime"

echo "🔧 Fixing test API mismatches..."
echo

# Fix 1: cost-tracker.test.ts - recordTask → record
echo "📝 Fixing cost-tracker.test.ts..."
sed -i '' 's/tracker\.recordTask(/tracker.record(/g' "$RUNTIME_DIR/src/__tests__/cost-tracker.test.ts"
echo "  ✅ Changed recordTask() to record()"

# Fix 2: orchestrator.test.ts - Remove instance creation, use static method
echo "📝 Fixing orchestrator.test.ts..."
# Remove "const parser = new OrchestrationParser()" line
sed -i '' '/const parser = new OrchestrationParser()/d' "$RUNTIME_DIR/src/__tests__/orchestrator.test.ts"
# Change parser.parse to OrchestrationParser.parse
sed -i '' 's/parser\.parse(/OrchestrationParser.parse(/g' "$RUNTIME_DIR/src/__tests__/orchestrator.test.ts"
echo "  ✅ Changed to static method calls"

# Fix 3: Add TMPDIR to test script
echo "📝 Updating package.json test scripts..."
cd "$RUNTIME_DIR"
# Use Node.js to safely update JSON
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts.test = 'TMPDIR=/tmp vitest run';
pkg.scripts['test:watch'] = 'TMPDIR=/tmp vitest';
pkg.scripts['test:coverage'] = 'TMPDIR=/tmp vitest run --coverage';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n');
"
echo "  ✅ Added TMPDIR=/tmp to test scripts"

echo
echo "✅ Auto-fixes applied!"
echo
echo "📊 Run tests now:"
echo "   pnpm --filter @goblinos/goblin-runtime test"
echo
echo "📋 Remaining manual fixes needed:"
echo "   - Check CostSummary.avgCostPerTask property"
echo "   - Update server.test.ts response structure assertions"
echo "   - See TEST_FIXES_NEEDED.md for details"
