/**
 * MCP tool argument validation (Zod).
 * Prevents NaN, bad types, and oversized payloads from reaching services.
 */

import { z } from "zod";

const MAX_METADATA_BYTES = 64 * 1024; // 64KB
const MAX_INPUT_BYTES = 64 * 1024; // 64KB

function isWithinJsonSize(value: unknown, maxBytes: number): boolean {
  try {
    return JSON.stringify(value ?? null).length <= maxBytes;
  } catch {
    return false;
  }
}

const metadataSchema = z
  .record(z.unknown())
  .optional()
  .refine((v) => v == null || isWithinJsonSize(v, MAX_METADATA_BYTES), {
    message: `metadata must be under ${MAX_METADATA_BYTES} bytes`,
  });

const inputSchema = z
  .union([z.string(), z.record(z.unknown()), z.array(z.unknown())])
  .optional()
  .refine((v) => v == null || isWithinJsonSize(v, MAX_INPUT_BYTES), {
    message: `input must be under ${MAX_INPUT_BYTES} bytes`,
  });

export const McpCallBodySchema = z.object({
  tool: z.string().min(1),
  arguments: z.record(z.unknown()).default({}),
});

export const ToolArgs = {
  "eval.quality.latest": z.object({
    evaluationId: z.number().int().positive(),
    baseline: z.enum(["published", "previous", "production"]).optional(),
  }),
  "trace.create": z.object({
    name: z.string().min(1),
    traceId: z.string().min(1),
    status: z.string().optional(),
    durationMs: z.number().int().nonnegative().optional(),
    metadata: metadataSchema,
  }),
  "trace.span.create": z.object({
    traceId: z.number().int().positive(),
    spanId: z.string().min(1),
    name: z.string().min(1),
    type: z.string().min(1),
    parentSpanId: z.string().optional(),
    input: inputSchema,
    output: z.string().optional(),
    durationMs: z.number().int().nonnegative().optional().nullable(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    metadata: metadataSchema,
    evaluationRunId: z.number().int().positive().optional().nullable(),
  }),
  "eval.testcase.add": z.object({
    evaluationId: z.number().int().positive(),
    input: z.string().min(1),
    expectedOutput: z.string().optional(),
    name: z.string().optional(),
    metadata: metadataSchema,
  }),
  "eval.run": z.object({
    evaluationId: z.number().int().positive(),
    environment: z.enum(["dev", "staging", "prod"]).optional(),
  }),
  "eval.get": z.object({
    evaluationId: z.number().int().positive(),
  }),
  "eval.list": z.object({
    limit: z.number().int().positive().max(100).optional(),
    offset: z.number().int().nonnegative().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
  }),
} as const;

export type ToolName = keyof typeof ToolArgs;

export type ToolArgsInferred = {
  [K in ToolName]: z.infer<(typeof ToolArgs)[K]>;
};
