/**
 * Configuration options for the AI Evaluation Platform SDK client
 * Tier 1.4: TypeScript-First with Generics
 */
export interface ClientConfig {
  /** Your API key from the AI Evaluation Platform dashboard */
  apiKey?: string;
  /** Base URL for the API (default: relative URLs in browser, http://localhost:3000 in Node.js) */
  baseUrl?: string;
  /** Organization ID for multi-tenant setups */
  organizationId?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Debug mode - enables request/response logging (default: false) */
  debug?: boolean;
  /** Log level for debug mode (default: 'info') */
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  /** Retry configuration */
  retry?: {
    /** Maximum retry attempts (default: 3) */
    maxAttempts?: number;
    /** Backoff strategy (default: 'exponential') */
    backoff?: 'exponential' | 'linear' | 'fixed';
    /** Retryable error codes */
    retryableErrors?: string[];
  };
}

/**
 * Evaluation template categories
 * Updated with new template types for comprehensive LLM testing
 */
export const EvaluationTemplates = {
  // Core Testing
  UNIT_TESTING: 'unit-testing',
  OUTPUT_QUALITY: 'output-quality',
  
  // Advanced Evaluation
  PROMPT_OPTIMIZATION: 'prompt-optimization',
  CHAIN_OF_THOUGHT: 'chain-of-thought',
  LONG_CONTEXT_TESTING: 'long-context-testing',
  MODEL_STEERING: 'model-steering',
  REGRESSION_TESTING: 'regression-testing',
  CONFIDENCE_CALIBRATION: 'confidence-calibration',
  
  // Safety & Compliance
  SAFETY_COMPLIANCE: 'safety-compliance',
  
  // Domain-Specific
  RAG_EVALUATION: 'rag-evaluation',
  CODE_GENERATION: 'code-generation',
  SUMMARIZATION: 'summarization',
} as const;

export type EvaluationTemplateType = typeof EvaluationTemplates[keyof typeof EvaluationTemplates];

/**
 * Feature usage limits for per-organization quotas
 */
export interface FeatureUsage {
  /** Feature ID (e.g., 'traces_per_project', 'evals_per_project') */
  feature_id: string;
  /** Whether the feature has unlimited usage */
  unlimited: boolean;
  /** Billing interval (month, year, etc.) */
  interval: string;
  /** Remaining balance */
  balance: number;
  /** Current usage amount */
  usage: number;
  /** Total included usage allowance */
  included_usage: number;
  /** When the usage resets */
  next_reset_at: number;
}

/**
 * Organization resource limits
 */
export interface OrganizationLimits {
  /** Traces per organization limit */
  traces_per_organization?: FeatureUsage;
  /** Evaluations per organization limit */
  evals_per_organization?: FeatureUsage;
  /** Annotations per organization limit */
  annotations_per_organization?: FeatureUsage;
}

/**
 * Trace object representing a single execution trace
 * Generic metadata support for type safety
 */
export interface Trace<TMetadata = Record<string, any>> {
  id: number;
  name: string;
  traceId: string;
  organizationId: number;
  status: 'pending' | 'success' | 'error';
  durationMs: number | null;
  metadata: TMetadata | null;
  createdAt: string;
}

/**
 * Parameters for creating a new trace
 */
export interface CreateTraceParams<TMetadata = Record<string, any>> {
  name: string;
  traceId: string;
  organizationId?: number;
  status?: 'pending' | 'success' | 'error';
  durationMs?: number;
  metadata?: TMetadata;
}

/**
 * Parameters for listing traces
 */
export interface ListTracesParams {
  limit?: number;
  offset?: number;
  organizationId?: number;
  status?: 'pending' | 'success' | 'error';
  search?: string;
}

/**
 * Span object representing a sub-operation within a trace
 */
export interface Span<TMetadata = Record<string, any>> {
  id: number;
  traceId: number;
  name: string;
  spanId: string;
  parentSpanId: string | null;
  startTime: string;
  endTime: string | null;
  durationMs: number | null;
  metadata: TMetadata | null;
  createdAt: string;
}

/**
 * Parameters for creating a span
 */
export interface CreateSpanParams<TMetadata = Record<string, any>> {
  name: string;
  spanId: string;
  parentSpanId?: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  metadata?: TMetadata;
}

/**
 * Evaluation object representing a test evaluation
 */
export interface Evaluation<TMetadata = Record<string, any>> {
  id: number;
  name: string;
  description: string | null;
  type: string;
  status: 'draft' | 'active' | 'archived';
  organizationId: number;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  metadata?: TMetadata | null;
}

/**
 * Parameters for creating a new evaluation
 */
export interface CreateEvaluationParams {
  name: string;
  description?: string;
  type: string;
  organizationId?: number;
  createdBy: number;
  status?: 'draft' | 'active' | 'archived';
}

/**
 * Parameters for updating an evaluation
 */
export interface UpdateEvaluationParams {
  name?: string;
  description?: string;
  type?: string;
  status?: 'draft' | 'active' | 'archived';
}

/**
 * Parameters for listing evaluations
 */
export interface ListEvaluationsParams {
  limit?: number;
  offset?: number;
  organizationId?: number;
  type?: string;
  status?: 'draft' | 'active' | 'archived';
  search?: string;
}

/**
 * Test case for an evaluation
 */
export interface TestCase {
  id: number;
  evaluationId: number;
  input: string;
  expectedOutput: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

/**
 * Parameters for creating a test case
 */
export interface CreateTestCaseParams {
  input: string;
  expectedOutput?: string;
  metadata?: Record<string, any>;
}

/**
 * Evaluation run
 */
export interface EvaluationRun {
  id: number;
  evaluationId: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: Record<string, any> | null;
  createdAt: string;
  completedAt: string | null;
}

/**
 * Parameters for creating an evaluation run
 */
export interface CreateRunParams {
  status?: 'pending' | 'running' | 'completed' | 'failed';
  results?: Record<string, any>;
}

/**
 * LLM Judge evaluation result
 */
export interface LLMJudgeResult {
  id: number;
  configId: number;
  input: string;
  output: string;
  score: number | null;
  reasoning: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

/**
 * Parameters for running an LLM judge evaluation
 */
export interface RunLLMJudgeParams {
  configId: number;
  input: string;
  output: string;
  score?: number;
  reasoning?: string;
  metadata?: Record<string, any>;
}

/**
 * SDK Error class with additional error details
 * 
 * Common error codes:
 * - MISSING_API_KEY: API key not provided
 * - MISSING_ORGANIZATION_ID: Organization ID not provided
 * - MISSING_REQUIRED_FIELDS: Required parameters missing
 * - INVALID_ID: Invalid ID format
 * - NOT_FOUND: Resource not found
 * - UNAUTHORIZED: Authentication required
 * - FORBIDDEN: Access forbidden
 * - RATE_LIMIT_EXCEEDED: Rate limit exceeded
 * - TIMEOUT: Request timed out
 * - NETWORK_ERROR: Network connectivity issue
 * - VALIDATION_ERROR: Request validation failed
 * - INTERNAL_SERVER_ERROR: Server error
 * - FEATURE_LIMIT_REACHED: Feature usage limit reached
 * - UNKNOWN_ERROR: Unknown error occurred
 */
export class SDKError extends Error {
  code: string;
  statusCode: number;
  details?: any;
  documentation?: string;
  solutions?: string[];
  retryable?: boolean;
  retryAfter?: number;

  constructor(message: string, code: string, statusCode: number, details?: any) {
    super(message);
    this.name = 'SDKError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Additional type definitions
export type AIEvalConfig = ClientConfig;
export type TraceData<TMetadata = any> = Trace<TMetadata>;
export type SpanData<TMetadata = any> = Span<TMetadata>;
export type EvaluationData<TMetadata = any> = Evaluation<TMetadata>;
export type LLMJudgeData = LLMJudgeResult;
export type AnnotationData = any;

export interface RetryConfig {
  maxAttempts?: number;
  backoff?: 'exponential' | 'linear' | 'fixed';
  retryableErrors?: string[];
}

export interface GenericMetadata {
  [key: string]: any;
}

export interface TracedResponse<T> {
  data: T;
  traceId?: string;
  metadata?: GenericMetadata;
}

export interface TestResult {
  passed: boolean;
  message?: string;
  expected?: any;
  actual?: any;
  metadata?: GenericMetadata;
}

export interface SnapshotData {
  id: string;
  name: string;
  data: any;
  metadata?: GenericMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'jsonl';
  includeTraces?: boolean;
  includeEvaluations?: boolean;
  includeTestCases?: boolean;
  includeRuns?: boolean;
  dateRange?: {
    from: string;
    to: string;
  };
  organizationId?: number;
  limit?: number;
}

export interface ImportOptions {
  organizationId?: number;
  createdBy?: number;
  skipDuplicates?: boolean;
  dryRun?: boolean;
}

export interface StreamOptions {
  onData: (data: any) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
  signal?: AbortSignal;
}

export interface BatchOptions {
  batchSize?: number;
  concurrency?: number;
  onProgress?: (progress: { processed: number; total: number }) => void;
  signal?: AbortSignal;
}

export type ExportFormat = 'json' | 'csv' | 'jsonl';