import { ToolDefinition } from '../types';
import { MonorepoCliAdapter } from './adapters/monorepo-cli';
import { ConfigManagerAdapter } from './adapters/config-manager';
import { MetricsApiAdapter } from './adapters/metrics-api';
import { GithubPrAdapter } from './adapters/github-pr';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private adapters: Map<string, any> = new Map();

  constructor() {
    this.registerTool({
      id: 'monorepo_cli',
      display_name: 'Monorepo CLI',
      description: 'Run scripts in the monorepo',
      functions: [
        {
          name: 'run_script',
          description: 'Execute a registered script with arguments',
          input_schema: {
            type: 'object',
            properties: {
              script_name: { type: 'string' },
              args: { type: 'array', items: { type: 'string' } },
              env: { type: 'object', additionalProperties: { type: 'string' } },
              working_dir: { type: 'string' },
            },
            required: ['script_name'],
          },
          output_schema: {
            type: 'object',
            properties: {
              exit_code: { type: 'integer' },
              stdout: { type: 'string' },
              stderr: { type: 'string' },
              duration_ms: { type: 'integer' },
            },
          },
          timeout_seconds: 300,
          audit_level: 'medium',
        },
      ],
      required_permissions: ['exec:scripts'],
    });
    this.adapters.set('monorepo_cli', new MonorepoCliAdapter());

    // Add other tools similarly
    this.registerTool({
      id: 'config_manager',
      display_name: 'Config Manager',
      description: 'Manage configuration files',
      functions: [
        {
          name: 'update_yaml',
          description: 'Update a YAML file with a JSON patch',
          input_schema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              operation: { enum: ['patch', 'set'] },
              patch: { type: 'object' },
              key: { type: 'string' },
              value: { type: 'any' },
            },
            required: ['path', 'operation'],
          },
          output_schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              change_id: { type: 'string' },
            },
          },
          timeout_seconds: 30,
          audit_level: 'high',
        },
      ],
      required_permissions: ['edit:config'],
    });
    this.adapters.set('config_manager', new ConfigManagerAdapter());

    // Metrics API
    this.registerTool({
      id: 'metrics_api',
      display_name: 'Metrics API',
      description: 'Query metrics and gauges',
      functions: [
        {
          name: 'query_gauge',
          description: 'Query a gauge metric',
          input_schema: {
            type: 'object',
            properties: {
              metric_name: { type: 'string' },
              window: { enum: ['5m', '1h', '24h'] },
              labels: { type: 'object' },
            },
            required: ['metric_name', 'window'],
          },
          output_schema: {
            type: 'object',
            properties: {
              points: { type: 'array', items: { type: 'object' } },
              summary: { type: 'object' },
            },
          },
          timeout_seconds: 10,
          audit_level: 'low',
        },
      ],
      required_permissions: ['metrics:read'],
    });
    this.adapters.set('metrics_api', new MetricsApiAdapter());

    // GitHub PR
    this.registerTool({
      id: 'github_pr',
      display_name: 'GitHub PR',
      description: 'Query GitHub PR status',
      functions: [
        {
          name: 'get_status_check',
          description: 'Get status check for a PR',
          input_schema: {
            type: 'object',
            properties: {
              pr_id: { type: 'integer' },
              check_name: { type: 'string' },
            },
            required: ['pr_id', 'check_name'],
          },
          output_schema: {
            type: 'object',
            properties: {
              status: { enum: ['success', 'failure', 'pending', 'not_found'] },
              details: { type: 'object' },
            },
          },
          timeout_seconds: 10,
          audit_level: 'low',
        },
      ],
      required_permissions: ['github:read'],
    });
    this.adapters.set('github_pr', new GithubPrAdapter());
  }

  registerTool(tool: ToolDefinition) {
    this.tools.set(tool.id, tool);
  }

  getTool(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  getAdapter(id: string): any {
    return this.adapters.get(id);
  }
}