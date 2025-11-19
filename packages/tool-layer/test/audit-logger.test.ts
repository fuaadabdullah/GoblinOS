import { describe, it, expect } from 'vitest';
import { redactArgs } from '../src/audit-logger';

describe('audit logger redaction', () => {
  it('redacts obvious keys and long tokens', () => {
    const args = {
      password: 'supersecret',
      token: 'sk-test-abcdefghijklmnop',
      nested: { apiKey: '1234567890ABCDEFGHIJ1234567890', keep: 'ok' },
      list: ['ok', 'sk-sometoken-that-is-long-enough-1234567890']
    };

    const redacted = redactArgs(args);
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.nested.apiKey).toBe('[REDACTED]');
    expect(redacted.nested.keep).toBe('ok');
    expect(Array.isArray(redacted.list)).toBe(true);
    expect(redacted.list[1]).toBe('[REDACTED]');
  });
});
