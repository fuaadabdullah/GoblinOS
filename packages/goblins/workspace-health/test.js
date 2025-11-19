#!/usr/bin/env node

/**
 * Test script for workspace-health goblin
 */

import { WorkspaceHealthGoblin } from './dist/index.js';

async function testWorkspaceHealth() {
  console.log('🧪 Testing workspace-health goblin...\n');

  // Create goblin instance
  const goblin = new WorkspaceHealthGoblin({
    config: {
      runEslint: true,
      runTypecheck: true,
      runTests: false, // Skip tests for faster testing
      runSmoke: false, // Skip smoke test for now
      smokeUrl: "http://localhost:3000",
      timeout: 30000
    }
  });

  try {
    // Initialize
    await goblin.initialize();
    console.log('✅ Goblin initialized\n');

    // Execute
    console.log('🏃 Running health checks...');
    const result = await goblin.execute({
      intent: 'run health checks',
      parameters: {}
    });

    console.log('✅ Health checks completed\n');

    // Display results
    console.log('📊 Results:');
    console.log(JSON.stringify(result, null, 2));

    // Shutdown
    await goblin.shutdown();
    console.log('\n✅ Goblin shutdown complete');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testWorkspaceHealth();
