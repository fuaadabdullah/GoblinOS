import { ToolAdapter, AdapterResult } from './base';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class MonorepoCliAdapter implements ToolAdapter {
  private allowedScripts = ['forge:benchmark', 'pnpm:lint', 'pnpm:test']; // Whitelist

  async run(functionName: string, args: any, dryRun: boolean): Promise<AdapterResult> {
    if (functionName !== 'run_script') {
      throw new Error('Unknown function');
    }

    if (!this.allowedScripts.includes(args.script_name)) {
      throw new Error('Script not allowed');
    }

    if (dryRun) {
      return {
        code: 0,
        output: { message: `Would run: ${args.script_name} ${args.args?.join(' ') || ''}` },
      };
    }

    try {
      const start = Date.now();
      const { stdout, stderr } = await execAsync(
        `cd /Users/fuaadabdullah/ForgeMonorepo && ${args.script_name} ${args.args?.join(' ') || ''}`,
        { timeout: 300000 }
      );
      const duration = Date.now() - start;

      return {
        code: 0,
        output: {
          exit_code: 0,
          stdout,
          stderr,
          duration_ms: duration,
        },
      };
    } catch (error: any) {
      return {
        code: error.code || 1,
        output: {
          exit_code: error.code || 1,
          stdout: error.stdout || '',
          stderr: error.stderr || '',
          duration_ms: 0,
        },
      };
    }
  }
}