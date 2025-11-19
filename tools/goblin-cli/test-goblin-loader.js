const path = require('path');

async function testGoblinLoader() {
  try {
    const goblinRuntime = await import('@goblinos/goblin-runtime');
    console.log('GoblinLoader available:', !!goblinRuntime.GoblinLoader);

    if (goblinRuntime.GoblinLoader) {
      const goblinDir = path.resolve(__dirname, '../../packages/goblins');
      console.log('Testing with goblinDir:', goblinDir);

      const loader = new goblinRuntime.GoblinLoader({ goblinDir });
      console.log('GoblinLoader instance created successfully');
    }
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
  }
}

testGoblinLoader();
