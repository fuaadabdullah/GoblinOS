#!/usr/bin/env node

import { GoblinLoader } from './dist/goblin-loader.js';

async function testGoblinLoader() {
  console.log('🧪 Testing GoblinLoader with overmind goblin...\n');

  const loader = new GoblinLoader();

  try {
    // Test loading (which includes discovery internally)
    console.log('📥 Loading goblins...');
    await loader.loadAllGoblins();
    console.log(`✅ Loaded ${loader.getLoadedGoblinCount()} goblins`);

    // Test capabilities summary
    console.log('\n📊 Capabilities summary:');
    const summary = loader.getCapabilitiesSummary();
    console.log(JSON.stringify(summary, null, 2));

    // Test initialization
    console.log('\n🚀 Initializing goblins...');
    await loader.initializeAllGoblins();
    console.log('✅ All goblins initialized');

    // Test shutdown
    console.log('\n🛑 Shutting down goblins...');
    await loader.shutdownAllGoblins();
    console.log('✅ All goblins shut down');

    console.log('\n🎉 GoblinLoader test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testGoblinLoader();
