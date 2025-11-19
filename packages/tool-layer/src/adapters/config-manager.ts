import { ToolAdapter, AdapterResult } from './base';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

export class ConfigManagerAdapter implements ToolAdapter {
  private allowedPaths = ['biome.json', 'tsconfig.json', 'package.json']; // Whitelist

  async run(functionName: string, args: any, dryRun: boolean): Promise<AdapterResult> {
    if (functionName !== 'update_yaml') {
      throw new Error('Unknown function');
    }

    if (!this.allowedPaths.includes(args.path)) {
      throw new Error('Path not allowed');
    }

    const fullPath = path.join('/Users/fuaadabdullah/ForgeMonorepo', args.path);

    if (dryRun) {
      return {
        code: 0,
        output: { message: `Would update ${args.path} with ${JSON.stringify(args.patch || { [args.key]: args.value })}` },
      };
    }

    try {
      let content = fs.readFileSync(fullPath, 'utf8');
      let data = JSON.parse(content);

      if (args.operation === 'set' && args.key) {
        data[args.key] = args.value;
      } else if (args.operation === 'patch') {
        // Simple patch implementation
        Object.assign(data, args.patch);
      }

      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));

      return {
        code: 0,
        output: {
          success: true,
          change_id: `change-${Date.now()}`,
        },
      };
    } catch (error: any) {
      return {
        code: 1,
        output: {
          success: false,
          error: error.message,
        },
      };
    }
  }
}