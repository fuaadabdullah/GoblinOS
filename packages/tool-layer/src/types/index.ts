export interface ToolDefinition {
  id: string;
  display_name: string;
  description: string;
  functions: FunctionDefinition[];
  required_permissions: string[];
}

export interface FunctionDefinition {
  name: string;
  description: string;
  input_schema: any; // JSON Schema
  output_schema: any; // JSON Schema
  timeout_seconds: number;
  audit_level: 'low' | 'medium' | 'high';
}

export interface Invocation {
  request_id: string;
  caller_id: string;
  capability_token: string;
  tool_id: string;
  function_name: string;
  args: any;
  metadata?: {
    trace_id?: string;
    pr_id?: number;
    dry_run?: boolean;
  };
}

export interface Response {
  request_id: string;
  status: 'ok' | 'error';
  code: number;
  output?: any;
  error?: {
    type: string;
    message: string;
    details?: any;
  };
  signature: string;
}

export interface AuditEvent {
  event_id: string;
  request_id: string;
  caller_id: string;
  tool_id: string;
  function_name: string;
  args: any;
  result_code: number;
  timestamp: number;
  signature: string;
}