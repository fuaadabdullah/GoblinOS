#!/usr/bin/env node
// CommonJS-compatible smoke test using global fetch (Node 18+)
(async function run() {
  try {
    const res = await fetch('http://localhost:3030/api/memory/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Smoke test content ' + Date.now() }),
    });
    const body = await res.text();
    console.log('STATUS', res.status);
    console.log('BODY', body);
  } catch (err) {
    console.error('Request failed', err);
    process.exit(1);
  }
})();
