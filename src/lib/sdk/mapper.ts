// src/lib/sdk/mapper.ts
import { z } from "zod";

/**
 * Zod schemas for validating SDK results before database insertion.
 * Ensures data consistency and type safety.
 */

// Assertion result for envelope (optional from SDK)
export const SDKAssertionResultSchema = z.object({
  key: z.string(),
  category: z.enum(["safety", "privacy", "quality", "format", "policy"]),
  passed: z.boolean(),
  score: z.number().min(0).max(1).optional(),
  severity: z.enum(["low", "med", "high"]).optional(),
  details: z.string().optional(),
});

// Individual test result from SDK
export const SDKTestResultSchema = z.object({
  testCaseId: z.number(),
  status: z.enum(["pending", "running", "passed", "failed", "error"]),
  output: z.string().nullable(),
  score: z.number().min(0).max(100).nullable(),
  error: z.string().nullable(),
  durationMs: z.number().min(0),
  messages: z.array(z.any()).optional(),
  toolCalls: z.array(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  assertions: z.array(SDKAssertionResultSchema).optional(),
});

// Batch evaluation result from SDK
export const SDKEvaluationResultSchema = z.object({
  evaluationId: z.number(),
  runId: z.string(),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  totalCases: z.number(),
  processedCases: z.number(),
  passedCases: z.number(),
  failedCases: z.number(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  durationMs: z.number().nullable(),
  results: z.array(SDKTestResultSchema),
  metadata: z.record(z.any()).optional(),
});

// LLM message structure
export const SDKMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool", "function_call", "function_result"]),
  content: z.string(),
  timestamp: z.string().optional(),
  tool_calls: z.array(z.any()).optional(),
});

// Tool call structure
export const SDKToolCallSchema = z.object({
  id: z.string(),
  type: z.string(),
  function: z.object({
    name: z.string(),
    arguments: z.record(z.any()),
  }),
  result: z.any().optional(),
  timestamp: z.string().optional(),
});

// Trace span structure
export const SDKTraceSpanSchema = z.object({
  spanId: z.string(),
  parentSpanId: z.string().nullable(),
  name: z.string(),
  type: z.string(),
  startTime: z.string(),
  endTime: z.string().nullable(),
  durationMs: z.number().nullable(),
  input: z.string().nullable(),
  output: z.string().nullable(),
  messages: z.array(SDKMessageSchema).optional(),
  toolCalls: z.array(SDKToolCallSchema).optional(),
  metadata: z.record(z.any()).optional(),
});

// Full trace structure
export const SDKTraceSchema = z.object({
  traceId: z.string(),
  evaluationId: z.number(),
  runId: z.string(),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  startTime: z.string(),
  endTime: z.string().nullable(),
  durationMs: z.number().nullable(),
  spans: z.array(SDKTraceSpanSchema),
  metadata: z.record(z.any()).optional(),
});

/**
 * Type definitions for SDK results
 */
export type SDKTestResult = z.infer<typeof SDKTestResultSchema>;
export type SDKEvaluationResult = z.infer<typeof SDKEvaluationResultSchema>;
export type SDKMessage = z.infer<typeof SDKMessageSchema>;
export type SDKToolCall = z.infer<typeof SDKToolCallSchema>;
export type SDKTraceSpan = z.infer<typeof SDKTraceSpanSchema>;
export type SDKTrace = z.infer<typeof SDKTraceSchema>;

/**
 * Validation functions for SDK data
 */
export const validateSDKTestResult = (data: unknown): SDKTestResult => {
  return SDKTestResultSchema.parse(data);
};

export const validateSDKEvaluationResult = (data: unknown): SDKEvaluationResult => {
  return SDKEvaluationResultSchema.parse(data);
};

export const validateSDKTrace = (data: unknown): SDKTrace => {
  return SDKTraceSchema.parse(data);
};
