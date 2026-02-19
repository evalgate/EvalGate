import { z } from "zod";

/**
 * Request validation schemas using Zod
 * Centralized validation for API requests
 */

// Common schemas
export const idSchema = z.number().int().positive();
export const organizationIdSchema = z.number().int().positive();
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(1000).default(50),
  offset: z.number().int().min(0).default(0),
});

/** Schema for parsing limit/offset from URL query params (coerces strings to numbers) */
const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Parse limit and offset from URLSearchParams using paginationSchema.
 * Use this in all list endpoints for consistency.
 */
export function parsePaginationParams(searchParams: URLSearchParams): {
  limit: number;
  offset: number;
} {
  return paginationQuerySchema.parse({
    limit: searchParams.get("limit") ?? 50,
    offset: searchParams.get("offset") ?? 0,
  });
}

// Trace schemas
export const createTraceSchema = z.object({
  name: z.string().min(1).max(255),
  traceId: z.string().min(1).max(255),
  organizationId: organizationIdSchema,
  status: z.enum(["pending", "success", "error"]).default("pending"),
  durationMs: z.number().int().min(0).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

export const listTracesSchema = z.object({
  organizationId: organizationIdSchema.optional(),
  status: z.enum(["pending", "success", "error"]).optional(),
  search: z.string().optional(),
  ...paginationSchema.shape,
});

// Evaluation schemas
const executionSettingsSchema = z
  .object({
    batchSize: z.number().int().min(1).max(1000).optional(),
    parallelRuns: z.number().int().min(1).max(100).optional(),
    timeout: z.number().int().min(1).max(3600).optional(), // seconds
    retry: z
      .object({
        maxRetries: z.number().int().min(0).max(10).optional(),
        retryDelay: z.number().int().min(0).optional(),
      })
      .optional(),
    stopOnFailure: z.boolean().optional(),
  })
  .optional();

const modelSettingsSchema = z
  .object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).optional(),
    topP: z.number().min(0).max(1).optional(),
  })
  .optional();

const testCaseItemSchema = z.object({
  name: z.string().optional(),
  input: z.union([z.string(), z.any()]),
  expectedOutput: z.union([z.string(), z.any()]).optional(),
  metadata: z.any().optional(),
  label: z.string().optional(),
});

/** Client-provided body for POST /api/evaluations (org/createdBy added server-side) */
export const createEvaluationBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.string().min(1),
  executionSettings: executionSettingsSchema,
  modelSettings: modelSettingsSchema,
  customMetrics: z.array(z.any()).optional(),
  config: z.any().optional(),
  templates: z.array(z.any()).optional(),
  testCases: z.array(testCaseItemSchema).optional(),
});

export const createEvaluationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.string().min(1),
  organizationId: organizationIdSchema,
  createdBy: z.string(),
  executionSettings: executionSettingsSchema,
  modelSettings: modelSettingsSchema,
  customMetrics: z.array(z.any()).optional(),
  config: z.any().optional(),
});

/** Body for PATCH /api/evaluations/:id */
export const updateEvaluationBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  config: z.any().optional(),
});

/** Body for PUT /api/evaluations?id= (update by query) */
export const putEvaluationBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

/** Body for POST /api/evaluations/:id/runs */
export const createRunBodySchema = z
  .object({
    environment: z.enum(["dev", "staging", "prod"]).optional(),
  })
  .default({});

const ciContextSchema = z
  .object({
    provider: z.enum(["github", "gitlab", "circle", "unknown"]).optional(),
    repo: z.string().optional(),
    sha: z.string().optional(),
    branch: z.string().optional(),
    pr: z.number().optional(),
    runUrl: z.string().optional(),
    actor: z.string().optional(),
  })
  .optional();

/** Body for POST /api/evaluations/:id/runs/import */
export const importRunBodySchema = z
  .object({
    environment: z.enum(["dev", "staging", "prod"]).optional().default("dev"),
    importClientVersion: z.string().optional(),
    ci: ciContextSchema,
    /** CheckReport from evalai check --onFail import; stored in traceLog.import.checkReport */
    checkReport: z.record(z.any()).optional(),
    results: z
      .array(
        z.object({
          testCaseId: z.number().int().positive(),
          status: z.enum(["passed", "failed"]),
          output: z.string(),
          latencyMs: z.number().int().min(0).optional(),
          costUsd: z.number().min(0).optional(),
          assertionsJson: z.record(z.any()).optional(),
        }),
      )
      .min(1),
  })
  .refine(
    (data) => {
      const ids = data.results.map((r) => r.testCaseId);
      return ids.length === new Set(ids).size;
    },
    { message: "Duplicate testCaseId in results" },
  );

/** Body for POST /api/evaluations/:id/publish-run */
export const publishRunBodySchema = z.object({
  runId: z.coerce.number().int().positive(),
});

/** Body for POST /api/quality (recompute) */
export const recomputeQualityBodySchema = z.object({
  runId: z.coerce.number().int().positive(),
});

/** Body for POST /api/evaluations/:id/test-cases */
export const createTestCaseBodySchema = z.object({
  name: z.string().optional(),
  input: z.union([z.string(), z.any()]),
  expectedOutput: z.union([z.string(), z.any()]).optional(),
  metadata: z.any().optional(),
});

// Trace schemas (POST /api/traces)
export const createTraceBodySchema = z.object({
  name: z.string().min(1).max(255),
  traceId: z.string().min(1).max(255),
  status: z.enum(["pending", "success", "error"]).optional(),
  durationMs: z.number().int().min(0).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

/** Body for PATCH /api/traces/:id */
export const updateTraceBodySchema = z.object({
  status: z.enum(["pending", "success", "error"]).optional(),
  durationMs: z.number().int().min(0).optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

/** Body for POST /api/traces/:id/spans */
export const createSpanBodySchema = z.object({
  spanId: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  parentSpanId: z.string().optional(),
  input: z.any().optional(),
  output: z.any().optional(),
  durationMs: z.number().int().min(0).optional().nullable(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  metadata: z.any().optional(),
  evaluationRunId: z.number().int().positive().optional().nullable(),
});

// API Key schemas
export const createAPIKeySchema = z.object({
  name: z.string().min(1).max(255),
  organizationId: organizationIdSchema,
  scopes: z.array(z.string()).min(1),
  expiresAt: z.string().datetime().optional(),
});

/** Body for POST /api/developer/api-keys (organizationId from ctx) */
export const createAPIKeyBodySchema = z
  .object({
    name: z.string().min(1).max(255),
    scopes: z.array(z.string()).min(1),
    expiresAt: z.string().optional(),
  })
  .strict(); // rejects userId, user_id

/** Body for PATCH /api/developer/api-keys/:id */
export const updateAPIKeyBodySchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    scopes: z.array(z.string()).optional(),
  })
  .refine((d) => d.name !== undefined || d.scopes !== undefined, {
    message: "At least one field (name or scopes) must be provided",
  });

// Webhook schemas
export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  organizationId: organizationIdSchema,
  secret: z.string().optional(),
});

/** Body for POST /api/developer/webhooks */
export const createWebhookBodySchema = z.object({
  organizationId: organizationIdSchema,
  url: z
    .string()
    .min(1)
    .refine((s) => s.trim().startsWith("http://") || s.trim().startsWith("https://"), {
      message: "URL must start with http:// or https://",
    }),
  events: z.array(z.string()).min(1),
});

/** Body for PATCH /api/developer/webhooks/:id */
export const updateWebhookBodySchema = z.object({
  url: z
    .string()
    .min(1)
    .refine((s) => s.startsWith("http://") || s.startsWith("https://"))
    .optional(),
  events: z.array(z.string()).min(1).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

// Annotation schemas
export const createAnnotationTaskSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  instructions: z.string().min(1),
  template: z.string().optional(),
  config: z.any().optional(),
  annotationSettings: z.any().optional(),
});

// LLM Judge schemas
export const createLLMJudgeConfigSchema = z.object({
  name: z.string().min(1).max(255),
  prompt: z.string().min(1),
  rubric: z.string().optional(),
  model: z.string().default("gpt-4"),
  temperature: z.number().min(0).max(2).default(0.7),
  organizationId: organizationIdSchema,
});

/**
 * Validation helper function
 * Validates request body against schema and returns parsed data or throws
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}

/**
 * Sanitize user-provided search/filter strings to prevent LIKE injection.
 * Escapes SQL LIKE wildcards (% and _) and enforces a max length.
 */
export function sanitizeSearchInput(input: string, maxLength: number = 500): string {
  if (!input || typeof input !== "string") return "";
  const trimmed = input.trim().slice(0, maxLength);
  return trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Safe parseInt with NaN guard. Returns the default value if parsing fails.
 */
export function safeParseInt(value: string | null | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Format Zod errors for API responses
 */
export function formatValidationErrors(errors: z.ZodError): {
  message: string;
  fields: Record<string, string[]>;
} {
  const fields: Record<string, string[]> = {};

  errors.errors.forEach((err) => {
    const path = err.path.join(".");
    if (!fields[path]) {
      fields[path] = [];
    }
    fields[path].push(err.message);
  });

  return {
    message: "Validation failed",
    fields,
  };
}
