/**
 * MCP Tool Registry
 * Maps tool names to service calls. MCP call route dispatches here.
 * Args are pre-validated by Zod before dispatch; no Number() coercion.
 */

import type { AuthContext } from "@/lib/api/secure-route";
import { SCOPES } from "@/lib/auth/scopes";
import { evaluationService } from "@/lib/services/evaluation.service";
import { qualityService } from "@/lib/services/quality.service";
import { spanService } from "@/lib/services/span.service";
import { testCaseService } from "@/lib/services/test-case.service";
import { traceService } from "@/lib/services/trace.service";
import { McpToolError } from "./errors";
import type { ToolArgsInferred, ToolName } from "./schemas";
import type { McpToolDefinition } from "./types";

function assertAuthContext(ctx: {
  authType: string;
  organizationId?: number;
}): asserts ctx is AuthContext {
  if (ctx.authType === "anonymous" || ctx.organizationId == null) {
    throw new McpToolError("UNAUTHORIZED", "Authentication required", 401);
  }
}

const TOOL_VERSION = "1";

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "eval.quality.latest",
    description:
      "Get the latest quality score for an evaluation. Returns score, baseline, regression delta.",
    version: TOOL_VERSION,
    inputSchema: {
      type: "object",
      properties: {
        evaluationId: { type: "number", description: "ID of the evaluation" },
        baseline: {
          type: "string",
          description: "Baseline mode",
          enum: ["published", "previous", "production"],
        },
      },
      required: ["evaluationId"],
    },
    requiredScopes: [SCOPES.RUNS_READ],
  },
  {
    name: "trace.create",
    version: TOOL_VERSION,
    description: "Create a new trace for observability.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Trace name" },
        traceId: { type: "string", description: "Unique trace identifier" },
        status: { type: "string", description: "Trace status" },
        durationMs: { type: "number", description: "Duration in ms" },
        metadata: { type: "object", description: "Optional metadata" },
      },
      required: ["name", "traceId"],
    },
    requiredScopes: [SCOPES.TRACES_WRITE],
  },
  {
    name: "trace.span.create",
    version: TOOL_VERSION,
    description: "Create a span within a trace.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "number", description: "Database ID of the trace" },
        spanId: { type: "string", description: "Unique span identifier" },
        name: { type: "string", description: "Span name" },
        type: { type: "string", description: "Span type (e.g. llm, tool)" },
        parentSpanId: { type: "string", description: "Parent span ID" },
        input: { type: "string", description: "Input content" },
        output: { type: "string", description: "Output content" },
        durationMs: { type: "number", description: "Duration in ms" },
        metadata: { type: "object", description: "Optional metadata" },
        evaluationRunId: { type: "number", description: "Optional evaluation run ID" },
      },
      required: ["traceId", "spanId", "name", "type"],
    },
    requiredScopes: [SCOPES.TRACES_WRITE],
  },
  {
    name: "eval.testcase.add",
    version: TOOL_VERSION,
    description: "Add a test case to an evaluation.",
    inputSchema: {
      type: "object",
      properties: {
        evaluationId: { type: "number", description: "ID of the evaluation" },
        name: { type: "string", description: "Test case name" },
        input: { type: "string", description: "Input for the test case" },
        expectedOutput: { type: "string", description: "Expected output" },
        metadata: { type: "object", description: "Optional metadata" },
      },
      required: ["evaluationId", "input"],
    },
    requiredScopes: [SCOPES.EVAL_WRITE],
  },
  {
    name: "eval.run",
    description: "Run an evaluation. Executes test cases and computes results.",
    version: TOOL_VERSION,
    longRunning: true,
    inputSchema: {
      type: "object",
      properties: {
        evaluationId: { type: "number", description: "ID of the evaluation to run" },
        environment: {
          type: "string",
          description: "Environment",
          enum: ["dev", "staging", "prod"],
        },
      },
      required: ["evaluationId"],
    },
    requiredScopes: [SCOPES.RUNS_WRITE],
  },
  {
    name: "eval.get",
    version: TOOL_VERSION,
    description: "Get evaluation details including test cases and recent runs.",
    inputSchema: {
      type: "object",
      properties: {
        evaluationId: { type: "number", description: "ID of the evaluation" },
      },
      required: ["evaluationId"],
    },
    requiredScopes: [SCOPES.EVAL_READ],
  },
  {
    name: "eval.list",
    version: TOOL_VERSION,
    description: "List evaluations for the organization.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results" },
        offset: { type: "number", description: "Offset" },
        status: {
          type: "string",
          description: "Filter by status",
          enum: ["draft", "active", "archived"],
        },
      },
    },
    requiredScopes: [SCOPES.EVAL_READ],
  },
];

export async function executeMcpTool<K extends ToolName>(
  toolName: K,
  args: ToolArgsInferred[K],
  ctx: AuthContext | { authType: "anonymous" },
): Promise<unknown> {
  assertAuthContext(ctx);
  const orgId = ctx.organizationId;

  switch (toolName) {
    case "eval.quality.latest": {
      const a = args as ToolArgsInferred["eval.quality.latest"];
      const result = await qualityService.latest(orgId, a.evaluationId, {
        baseline: a.baseline ?? "published",
      });
      if (result === null) throw new McpToolError("NOT_FOUND", "Evaluation not found", 404);
      return result;
    }

    case "trace.create": {
      const a = args as ToolArgsInferred["trace.create"];
      const [created] = await traceService.create(orgId, {
        name: a.name,
        traceId: a.traceId,
        status: a.status,
        durationMs: a.durationMs,
        metadata: a.metadata,
      });
      return created;
    }

    case "trace.span.create": {
      const a = args as ToolArgsInferred["trace.span.create"];
      const result = await spanService.create(orgId, a.traceId, {
        spanId: a.spanId,
        name: a.name,
        type: a.type,
        parentSpanId: a.parentSpanId,
        input: a.input,
        output: a.output,
        durationMs: a.durationMs ?? undefined,
        metadata: a.metadata,
        evaluationRunId: a.evaluationRunId ?? undefined,
      });
      if (typeof result === "object" && "ok" in result && result.ok === false) {
        throw new McpToolError(
          "FORBIDDEN",
          result.reason === "run_not_in_org"
            ? "Run not in organization"
            : "Trace not in organization",
          403,
        );
      }
      return result;
    }

    case "eval.testcase.add": {
      const a = args as ToolArgsInferred["eval.testcase.add"];
      const result = await testCaseService.create(orgId, a.evaluationId, {
        name: a.name,
        input: a.input,
        expectedOutput: a.expectedOutput,
        metadata: a.metadata,
      });
      if (result === null) throw new McpToolError("NOT_FOUND", "Evaluation not found", 404);
      return result;
    }

    case "eval.run": {
      const a = args as ToolArgsInferred["eval.run"];
      const result = await evaluationService.run(a.evaluationId, orgId, {
        environment: a.environment ?? "dev",
      });
      if (result === null) throw new McpToolError("NOT_FOUND", "Evaluation not found", 404);
      return result;
    }

    case "eval.get": {
      const a = args as ToolArgsInferred["eval.get"];
      const result = await evaluationService.getById(a.evaluationId, orgId);
      if (result === null) throw new McpToolError("NOT_FOUND", "Evaluation not found", 404);
      return result;
    }

    case "eval.list": {
      const a = args as ToolArgsInferred["eval.list"];
      return evaluationService.list(orgId, {
        limit: a.limit ?? 50,
        offset: a.offset ?? 0,
        status: a.status,
      });
    }

    default:
      throw new McpToolError("VALIDATION_ERROR", `Unknown tool: ${toolName}`, 400);
  }
}
