import { ToolAdapter, AdapterResult } from './base';

export class MetricsApiAdapter implements ToolAdapter {
  async run(functionName: string, args: any, dryRun: boolean): Promise<AdapterResult> {
    if (functionName !== 'query_gauge') {
      throw new Error('Unknown function');
    }

    // Mock implementation - in real world, query Prometheus or similar
    const mockData = {
      points: [
        { ts: Date.now() - 300000, value: 95 },
        { ts: Date.now() - 240000, value: 97 },
        { ts: Date.now() - 180000, value: 96 },
      ],
      summary: {
        min: 95,
        max: 97,
        p50: 96,
        p95: 97,
        p99: 97,
      },
    };

    return {
      code: 0,
      output: mockData,
    };
  }
}