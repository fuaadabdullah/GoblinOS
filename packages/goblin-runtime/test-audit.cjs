const { sendSignedAudit } = require('./dist/audit-client.js');

async function test() {
  try {
    console.log('Testing audit client...');
    const result = await sendSignedAudit({
      event_id: 'test-event-123',
      occurred_at: new Date().toISOString(),
      actor: 'test-goblin',
      action: 'test_action',
      details: { test: true }
    }, { auditUrl: 'http://invalid-url-that-will-fail' });
    console.log('✅ Audit event signed successfully!');
    console.log('Has signature:', !!result.signature);
    console.log('Has pubkey:', !!result.pubkey);
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

test();
