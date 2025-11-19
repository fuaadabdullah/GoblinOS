export interface AdapterResult {
  code: number;
  output: any;
}

export interface ToolAdapter {
  run(functionName: string, args: any, dryRun: boolean): Promise<AdapterResult>;
}