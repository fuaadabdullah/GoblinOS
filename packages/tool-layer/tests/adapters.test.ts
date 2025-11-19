import { describe, it, expect } from 'vitest';
import { MonorepoCliAdapter } from '../src/adapters/monorepo-cli';
import { ConfigManagerAdapter } from '../src/adapters/config-manager';
import { MetricsApiAdapter } from '../src/adapters/metrics-api';
import { GithubPrAdapter } from '../src/adapters/github-pr';

describe('Adapters', () => {
  describe('MonorepoCliAdapter', () => {
    it('should run script in dry mode', async () => {
      const adapter = new MonorepoCliAdapter();
      const result = await adapter.run('run_script', { script_name: 'forge:benchmark', args: ['--target=core'] }, true);
      expect(result.code).toBe(0);
      expect(result.output.message).toContain('Would run');
    });

    it('should reject unknown scripts', async () => {
      const adapter = new MonorepoCliAdapter();
      await expect(adapter.run('run_script', { script_name: 'unknown' }, false)).rejects.toThrow('Script not allowed');
    });
  });

  describe('ConfigManagerAdapter', () => {
    it('should update config in dry mode', async () => {
      const adapter = new ConfigManagerAdapter();
      const result = await adapter.run('update_yaml', { path: 'biome.json', operation: 'set', key: 'test', value: 'value' }, true);
      expect(result.code).toBe(0);
      expect(result.output.message).toContain('Would update');
    });

    it('should reject unknown paths', async () => {
      const adapter = new ConfigManagerAdapter();
      await expect(adapter.run('update_yaml', { path: 'unknown.json' }, false)).rejects.toThrow('Path not allowed');
    });
  });

  describe('MetricsApiAdapter', () => {
    it('should query gauge', async () => {
      const adapter = new MetricsApiAdapter();
      const result = await adapter.run('query_gauge', { metric_name: 'p99_latency', window: '5m' }, false);
      expect(result.code).toBe(0);
      expect(result.output.summary).toBeDefined();
    });
  });

  describe('GithubPrAdapter', () => {
    it('should get status check', async () => {
      const adapter = new GithubPrAdapter();
      const result = await adapter.run('get_status_check', { pr_id: 42, check_name: 'test' }, false);
      expect(result.code).toBe(0);
      expect(result.output.status).toBe('success');
    });
  });
});