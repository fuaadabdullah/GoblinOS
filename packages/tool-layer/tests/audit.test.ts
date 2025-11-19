import { describe, it, expect } from 'vitest';
import { AuditLogger } from '../src/audit-logger';
import fs from 'fs';

describe('AuditLogger', () => {
  const dbPath = './test-audit.db';

  afterEach(() => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should log audit events', async () => {
    const logger = new AuditLogger(dbPath);
    await logger.log({
      request_id: 'test-req',
      caller_id: 'test-agent',
      tool_id: 'monorepo_cli',
      function_name: 'run_script',
      args: { script: 'test' },
      result_code: 0,
      timestamp: Date.now(),
    });

    const events = logger.getEvents('test-req');
    expect(events.length).toBe(1);
    expect(events[0].caller_id).toBe('test-agent');
  });
});