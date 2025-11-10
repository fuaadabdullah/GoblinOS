#!/usr/bin/env node
import { createOvermind } from '../dist/index.js';

async function run() {
  const overmind = createOvermind();
  const content = 'Idempotency test content ' + Date.now();
  console.log('Content:', content);

  // First simulate bridge handler
  const existing1 = await overmind.searchMemory(content, 5);
  if (Array.isArray(existing1) && existing1.length > 0) {
    console.log('First handler: existing found', existing1[0]);
  } else {
    const id1 = await overmind.rememberFact(content, { tags: ['test'] });
    console.log('First handler stored id', id1);
  }

  // Second simulate bridge handler (should detect existing and not create new)
  const existing2 = await overmind.searchMemory(content, 5);
  if (Array.isArray(existing2) && existing2.length > 0) {
    console.log('Second handler: existing found', existing2[0]);
  } else {
    const id2 = await overmind.rememberFact(content, { tags: ['test'] });
    console.log('Second handler stored id', id2);
  }

  console.log('Final search: ', await overmind.searchMemory(content, 10));
}

run().catch(err => { console.error(err); process.exit(1); });
