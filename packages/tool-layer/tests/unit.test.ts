import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../src/tool-registry';
import { CapabilityVerifier } from '../src/capability-verifier';

describe('ToolRegistry', () => {
  it('should register and retrieve tools', () => {
    const registry = new ToolRegistry();
    const tool = registry.getTool('monorepo_cli');
    expect(tool).toBeDefined();
    expect(tool?.id).toBe('monorepo_cli');
  });

  it('should return undefined for unknown tool', () => {
    const registry = new ToolRegistry();
    const tool = registry.getTool('unknown');
    expect(tool).toBeUndefined();
  });
});

describe('CapabilityVerifier', () => {
  it('should generate and verify tokens', () => {
    const verifier = new CapabilityVerifier();
    const token = verifier.generateToken({ tool: 'monorepo_cli' });
    expect(verifier.verify(token)).toBe(true);
  });

  it('should reject invalid tokens', () => {
    const verifier = new CapabilityVerifier();
    expect(verifier.verify('invalid')).toBe(false);
  });
});