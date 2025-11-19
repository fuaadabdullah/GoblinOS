import { describe, it, expect } from 'vitest';
import { CapabilityVerifier } from '../src/capability-verifier';
import jwt from 'jsonwebtoken';

// Set a deterministic secret for testing
process.env.TOOL_LAYER_JWT_SECRET = 'test-secret';

describe('capability verifier', () => {
  it('generates and verifies tokens', () => {
    const cv = new CapabilityVerifier();
    const token = cv.generateToken({ permissions: ['exec:scripts'] });
    expect(cv.verify(token)).toBe(true);
    const decoded = cv.decodeToken(token);
    expect(decoded).toBeTruthy();
    expect(decoded.permissions).toBeDefined();
  });

  it('rejects invalid token', () => {
    const cv = new CapabilityVerifier();
    expect(cv.verify('invalid-token')).toBe(false);
    expect(cv.decodeToken('invalid-token')).toBeNull();
  });
});
