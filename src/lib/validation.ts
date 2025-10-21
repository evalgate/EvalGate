import { z } from 'zod';

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

// Trace schemas
export const createTraceSchema = z.object({
  name: z.string().min(1).max(255),
  traceId: z.string().min(1).max(255),
  organizationId: organizationIdSchema,
  status: z.enum(['pending', 'success', 'error']).default('pending'),
  durationMs: z.number().int().min(0).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

export const listTracesSchema = z.object({
  organizationId: organizationIdSchema.optional(),
  status: z.enum(['pending', 'success', 'error']).optional(),
  search: z.string().optional(),
  ...paginationSchema.shape,
});

// Evaluation schemas
export const createEvaluationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.string().min(1),
  organizationId: organizationIdSchema,
  createdBy: z.string(),
  executionSettings: z.object({
    batchSize: z.number().int().min(1).max(1000).optional(),
    parallelRuns: z.number().int().min(1).max(100).optional(),
    timeout: z.number().int().min(1).max(3600).optional(), // seconds
    retry: z.object({
      maxRetries: z.number().int().min(0).max(10).optional(),
      retryDelay: z.number().int().min(0).optional(),
    }).optional(),
    stopOnFailure: z.boolean().optional(),
  }).optional(),
  modelSettings: z.object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).optional(),
    topP: z.number().min(0).max(1).optional(),
  }).optional(),
  customMetrics: z.array(z.any()).optional(),
  config: z.any().optional(),
});

// API Key schemas
export const createAPIKeySchema = z.object({
  name: z.string().min(1).max(255),
  organizationId: organizationIdSchema,
  scopes: z.array(z.string()).min(1),
  expiresAt: z.string().datetime().optional(),
});

// Webhook schemas
export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  organizationId: organizationIdSchema,
  secret: z.string().optional(),
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
  model: z.string().default('gpt-4'),
  temperature: z.number().min(0).max(2).default(0.7),
  organizationId: organizationIdSchema,
});

/**
 * Validation helper function
 * Validates request body against schema and returns parsed data or throws
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
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
 * Format Zod errors for API responses
 */
export function formatValidationErrors(errors: z.ZodError): {
  message: string;
  fields: Record<string, string[]>;
} {
  const fields: Record<string, string[]> = {};
  
  errors.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!fields[path]) {
      fields[path] = [];
    }
    fields[path].push(err.message);
  });

  return {
    message: 'Validation failed',
    fields,
  };
}

