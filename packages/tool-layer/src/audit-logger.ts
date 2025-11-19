import Database from 'better-sqlite3';
import { AuditEvent } from './types';
import crypto from 'crypto';

const REDACTED = '[REDACTED]';

function redactValue(key: string, value: any): any {
  if (value == null) return value;
  const lowerKey = key.toLowerCase();
  // key-name based redaction
  if (/(password|secret|token|api[_-]?key|apikey|key|private[_-]?key|access[_-]?token)/i.test(lowerKey)) {
    return REDACTED;
  }
  // value-based redaction (long alpha-numeric tokens)
  if (typeof value === 'string') {
    if (/^[A-Za-z0-9_-]{32,}$/.test(value.trim())) {
      return REDACTED;
    }
    if (/^(?:[A-Za-z0-9+\/]{40,}|sk-)/.test(value.trim())) {
      return REDACTED;
    }
  }
  return value;
}

function redactArgs(args: any): any {
  if (args == null) return args;
  if (Array.isArray(args)) {
    return args.map((v, i) => redactArgs(v));
  }
  if (typeof args === 'object') {
    const res: any = {};
    for (const [k, v] of Object.entries<any>(args)) {
      if (typeof v === 'object') res[k] = redactArgs(v);
      else res[k] = redactValue(k, v);
    }
    return res;
  }
  return args;
}

export class AuditLogger {
  private db: Database.Database;
  private hmacSecret: string;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initTable();
    this.hmacSecret = process.env.TOOL_LAYER_AUDIT_HMAC_SECRET || process.env.TOOL_LAYER_HMAC_SECRET || '';
    if (!this.hmacSecret && process.env.NODE_ENV !== 'development') {
      throw new Error('TOOL_LAYER_AUDIT_HMAC_SECRET must be set in production to sign audit events');
    }
  }

  private initTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_events (
        event_id TEXT PRIMARY KEY,
        request_id TEXT,
        caller_id TEXT,
        tool_id TEXT,
        function_name TEXT,
        args TEXT,
        result_code INTEGER,
        timestamp INTEGER,
        signature TEXT
      )
    `);
  }

  async log(event: Omit<AuditEvent, 'event_id' | 'signature'>) {
    const eventId = crypto.randomUUID();
    const sanitized = {
      ...event,
      args: JSON.stringify(redactArgs(event.args)),
    };
    const eventData = JSON.stringify(sanitized);
    const signature = crypto.createHmac('sha256', this.hmacSecret || 'dev-secret').update(eventData).digest('base64');

    const stmt = this.db.prepare(`
      INSERT INTO audit_events (event_id, request_id, caller_id, tool_id, function_name, args, result_code, timestamp, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      eventId,
      event.request_id,
      event.caller_id,
      event.tool_id,
      event.function_name,
  sanitized.args,
      event.result_code,
      event.timestamp,
      signature
    );
  }

  getEvents(requestId?: string) {
    let query = 'SELECT * FROM audit_events';
    if (requestId) {
      query += ' WHERE request_id = ?';
      return this.db.prepare(query).all(requestId);
    }
    return this.db.prepare(query).all();
  }
}
