const {spawnSync} = require('child_process');
const path = require('path');
const fs = require('fs');

const cli = path.resolve(__dirname, '..', 'index.js');
const testGoblins = path.resolve(__dirname, 'test_goblins.yaml');

// Create a tiny test goblins file
fs.writeFileSync(testGoblins, `guilds:\n  - id: test-guild\n    name: Test Guild\n    toolbelt:\n      - id: hello\n        name: Hello Goblin\n        command: echo hello\n`);

function run(args, env = {}) {
  const r = spawnSync(process.execPath, [cli, ...args], {env: {...process.env, GOBLINS_FILE: testGoblins, ...env}, encoding: 'utf8'});
  return r;
}

const listRes = run(['list']);
console.log('list stdout:\n', listRes.stdout);
if (listRes.status !== 0) {
  console.error('list failed', listRes.stderr);
  process.exit(2);
}

const dry = run(['run', 'hello', '--dry']);
console.log('dry stdout:\n', dry.stdout);
if (dry.status !== 0) {
  console.error('dry-run failed', dry.stderr);
  process.exit(2);
}

console.log('Test passed');
process.exit(0);
