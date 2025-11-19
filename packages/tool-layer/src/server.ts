import Fastify from 'fastify';
import { toolInvocationSchema } from './schemas/tool-invocation';
import { ToolRegistry } from './tool-registry';
import { AuditLogger } from './audit-logger';
import { CapabilityVerifier } from './capability-verifier';

const server = Fastify({
  logger: true,
  ajv: {
    customOptions: {
      allErrors: true,
      removeAdditional: 'all',
    },
  },
});

const toolRegistry = new ToolRegistry();
const auditLogger = new AuditLogger('./audit.db');
const capabilityVerifier = new CapabilityVerifier();

// Register schemas
server.addSchema(toolInvocationSchema);

// Routes
server.post('/invoke', {
  schema: {
    body: { $ref: 'toolInvocation#' },
    response: {
      200: { $ref: 'toolResponse#' },
      400: { $ref: 'errorResponse#' },
      403: { $ref: 'errorResponse#' },
      429: { $ref: 'errorResponse#' },
      500: { $ref: 'errorResponse#' },
    },
  },
}, async (request, reply) => {
  const invocation = request.body as any;

  // Verify capability token and extract claims
  const verified = capabilityVerifier.verify(invocation.capability_token);
  if (!verified) {
    return reply.code(403).send({
      request_id: invocation.request_id,
      status: 'error',
      code: 403,
      error: { type: 'auth', message: 'Invalid capability token' },
    });
  }

  const claims = capabilityVerifier.decodeToken(invocation.capability_token);
  // Short-circuit if token failed to decode
  if (!claims) return reply.code(403).send({ request_id: invocation.request_id, status: 'error', code: 403, error: { type: 'auth', message: 'Invalid capability token' } });

  // Check permissions
  const tool = toolRegistry.getTool(invocation.tool_id);
  if (!tool) {
    return reply.code(400).send({
      request_id: invocation.request_id,
      status: 'error',
      code: 400,
      error: { type: 'validation', message: 'Unknown tool' },
    });
  }

  const functionDef = tool.functions.find(f => f.name === invocation.function_name);
  if (!functionDef) {
    return reply.code(400).send({
      request_id: invocation.request_id,
      status: 'error',
      code: 400,
      error: { type: 'validation', message: 'Unknown function' },
    });
  }

  // Check caller permissions against required_permissions
  const callerPermissions: string[] = (claims && (claims.permissions || claims.scope || claims.scopes)) || [];
  const requiredPerms = tool.required_permissions || [];
  const missing = requiredPerms.filter(p => !callerPermissions.includes(p));
  if (missing.length > 0) {
    return reply.code(403).send({
      request_id: invocation.request_id,
      status: 'error',
      code: 403,
      error: { type: 'auth', message: 'Insufficient permissions', missing, required: requiredPerms },
    });
  }

  // Validate args against input_schema
  const validate = server.ajv.compile(functionDef.input_schema);
  if (!validate(invocation.args)) {
    return reply.code(400).send({
      request_id: invocation.request_id,
      status: 'error',
      code: 400,
      error: { type: 'validation', message: 'Invalid arguments', details: validate.errors },
    });
  }

  // Execute
  try {
    const adapter = toolRegistry.getAdapter(invocation.tool_id);
    const result = await adapter.run(invocation.function_name, invocation.args, invocation.metadata?.dry_run || false);

    // Log audit (auditLogger will redact args before writing)
    await auditLogger.log({
      request_id: invocation.request_id,
      caller_id: invocation.caller_id,
      tool_id: invocation.tool_id,
      function_name: invocation.function_name,
      args: invocation.args, // TODO: redact secrets
      result_code: result.code,
      timestamp: Date.now(),
    });
    // Sign the response to provide tamper-evidence. Use env var to get response signing key.
    const responseHmacKey = process.env.TOOL_LAYER_RESPONSE_HMAC_SECRET || process.env.TOOL_LAYER_AUDIT_HMAC_SECRET || '';
    const responsePayload = {
      request_id: invocation.request_id,
      status: 'ok',
      code: result.code,
      output: result.output,
    };
    const responseSignature = crypto
      .createHmac('sha256', responseHmacKey || 'dev-secret')
      .update(JSON.stringify(responsePayload))
      .digest('base64');

    return {
      request_id: invocation.request_id,
      status: 'ok',
      code: result.code,
      output: result.output,
      signature: responseSignature,
    };
  } catch (error) {
    await auditLogger.log({
      request_id: invocation.request_id,
      caller_id: invocation.caller_id,
      tool_id: invocation.tool_id,
      function_name: invocation.function_name,
      args: invocation.args,
      result_code: 500,
      timestamp: Date.now(),
    });

    return reply.code(500).send({
      request_id: invocation.request_id,
      status: 'error',
      code: 500,
      error: { type: 'execution', message: error.message },
    });
  }
});

// Health check
server.get('/health', async () => ({ status: 'ok' }));

// Start server
const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
