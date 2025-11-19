export const toolInvocationSchema = {
  $id: 'toolInvocation',
  type: 'object',
  properties: {
    request_id: { type: 'string', format: 'uuid' },
    caller_id: { type: 'string' },
    capability_token: { type: 'string' },
    tool_id: { type: 'string' },
    function_name: { type: 'string' },
    args: { type: 'object' },
    metadata: {
      type: 'object',
      properties: {
        trace_id: { type: 'string' },
        pr_id: { type: 'integer' },
        dry_run: { type: 'boolean' },
      },
    },
  },
  required: ['request_id', 'caller_id', 'capability_token', 'tool_id', 'function_name', 'args'],
};

export const toolResponseSchema = {
  $id: 'toolResponse',
  type: 'object',
  properties: {
    request_id: { type: 'string', format: 'uuid' },
    status: { enum: ['ok', 'error'] },
    code: { type: 'integer' },
    output: { type: 'object' },
    error: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'object' },
      },
    },
    signature: { type: 'string' },
  },
  required: ['request_id', 'status', 'code', 'signature'],
};

export const errorResponseSchema = {
  $id: 'errorResponse',
  type: 'object',
  properties: {
    request_id: { type: 'string', format: 'uuid' },
    status: { enum: ['error'] },
    code: { type: 'integer' },
    error: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'object' },
      },
    },
  },
  required: ['request_id', 'status', 'code', 'error'],
};

export const auditEventSchema = {
  $id: 'auditEvent',
  type: 'object',
  properties: {
    event_id: { type: 'string', format: 'uuid' },
    request_id: { type: 'string', format: 'uuid' },
    caller_id: { type: 'string' },
    tool_id: { type: 'string' },
    function_name: { type: 'string' },
    args: { type: 'object' },
    result_code: { type: 'integer' },
    timestamp: { type: 'integer' },
    signature: { type: 'string' },
  },
  required: ['event_id', 'request_id', 'caller_id', 'tool_id', 'function_name', 'args', 'result_code', 'timestamp', 'signature'],
};