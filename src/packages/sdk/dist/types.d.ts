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
export declare const EvaluationTemplates: {
    readonly UNIT_TESTING: "unit-testing";
    readonly OUTPUT_QUALITY: "output-quality";
    readonly PROMPT_OPTIMIZATION: "prompt-optimization";
    readonly CHAIN_OF_THOUGHT: "chain-of-thought";
    readonly LONG_CONTEXT_TESTING: "long-context-testing";
    readonly MODEL_STEERING: "model-steering";
    readonly REGRESSION_TESTING: "regression-testing";
    readonly CONFIDENCE_CALIBRATION: "confidence-calibration";
    readonly SAFETY_COMPLIANCE: "safety-compliance";
    readonly RAG_EVALUATION: "rag-evaluation";
    readonly CODE_GENERATION: "code-generation";
    readonly SUMMARIZATION: "summarization";
};
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
export declare class SDKError extends Error {
    code: string;
    statusCode: number;
    details?: any;
    documentation?: string;
    solutions?: string[];
    retryable?: boolean;
    retryAfter?: number;
    constructor(message: string, code: string, statusCode: number, details?: any);
}
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
    onProgress?: (progress: {
        processed: number;
        total: number;
    }) => void;
    signal?: AbortSignal;
}
export type ExportFormat = 'json' | 'csv' | 'jsonl';
/**
 * Annotation object representing human feedback
 */
export interface Annotation {
    id: number;
    evaluationRunId: number;
    testCaseId: number;
    annotatorId: string;
    rating: number | null;
    feedback: string | null;
    labels: Record<string, any>;
    metadata: Record<string, any>;
    createdAt: string;
    annotator?: {
        id: string;
        name: string;
        email: string;
    };
    testCase?: {
        name: string;
    };
}
/**
 * Parameters for creating an annotation
 */
export interface CreateAnnotationParams {
    evaluationRunId: number;
    testCaseId: number;
    rating?: number;
    feedback?: string;
    labels?: Record<string, any>;
    metadata?: Record<string, any>;
}
/**
 * Parameters for listing annotations
 */
export interface ListAnnotationsParams {
    evaluationRunId?: number;
    testCaseId?: number;
    limit?: number;
    offset?: number;
}
/**
 * Annotation task object
 */
export interface AnnotationTask {
    id: number;
    name: string;
    description: string | null;
    instructions: string | null;
    type: string;
    status: 'pending' | 'in_progress' | 'completed' | 'archived';
    organizationId: number;
    annotationSettings: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}
/**
 * Parameters for creating an annotation task
 */
export interface CreateAnnotationTaskParams {
    name: string;
    description?: string;
    instructions?: string;
    type: string;
    organizationId: number;
    annotationSettings?: Record<string, any>;
}
/**
 * Parameters for listing annotation tasks
 */
export interface ListAnnotationTasksParams {
    organizationId?: number;
    status?: 'pending' | 'in_progress' | 'completed' | 'archived';
    limit?: number;
    offset?: number;
}
/**
 * Annotation item object
 */
export interface AnnotationItem {
    id: number;
    taskId: number;
    content: string;
    annotation: any | null;
    annotatedBy: string | null;
    annotatedAt: string | null;
    createdAt: string;
}
/**
 * Parameters for creating an annotation item
 */
export interface CreateAnnotationItemParams {
    content: string;
    annotation?: any;
    annotatedBy?: string;
    annotatedAt?: string;
}
/**
 * Parameters for listing annotation items
 */
export interface ListAnnotationItemsParams {
    limit?: number;
    offset?: number;
}
/**
 * API Key object
 */
export interface APIKey {
    id: number;
    userId: string;
    organizationId: number;
    keyPrefix: string;
    name: string;
    scopes: string[];
    lastUsedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
    createdAt: string;
}
/**
 * API Key with full key (only returned on creation)
 */
export interface APIKeyWithSecret extends APIKey {
    apiKey: string;
}
/**
 * Parameters for creating an API key
 */
export interface CreateAPIKeyParams {
    name: string;
    organizationId: number;
    scopes: string[];
    expiresAt?: string;
}
/**
 * Parameters for updating an API key
 */
export interface UpdateAPIKeyParams {
    name?: string;
    scopes?: string[];
    expiresAt?: string;
}
/**
 * Parameters for listing API keys
 */
export interface ListAPIKeysParams {
    organizationId?: number;
    limit?: number;
    offset?: number;
}
/**
 * API Key usage statistics
 */
export interface APIKeyUsage {
    keyId: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    lastUsedAt: string | null;
    usageByEndpoint: Record<string, number>;
    usageByDay: Array<{
        date: string;
        requests: number;
    }>;
}
/**
 * Webhook object
 */
export interface Webhook {
    id: number;
    organizationId: number;
    url: string;
    events: string[];
    secret: string;
    status: 'active' | 'inactive';
    lastTriggeredAt: string | null;
    createdAt: string;
    updatedAt: string;
}
/**
 * Parameters for creating a webhook
 */
export interface CreateWebhookParams {
    organizationId: number;
    url: string;
    events: string[];
}
/**
 * Parameters for updating a webhook
 */
export interface UpdateWebhookParams {
    url?: string;
    events?: string[];
    status?: 'active' | 'inactive';
}
/**
 * Parameters for listing webhooks
 */
export interface ListWebhooksParams {
    organizationId: number;
    status?: 'active' | 'inactive';
    limit?: number;
    offset?: number;
}
/**
 * Webhook delivery object
 */
export interface WebhookDelivery {
    id: number;
    webhookId: number;
    event: string;
    payload: Record<string, any>;
    response: string | null;
    statusCode: number | null;
    success: boolean;
    attempt: number;
    createdAt: string;
}
/**
 * Parameters for listing webhook deliveries
 */
export interface ListWebhookDeliveriesParams {
    limit?: number;
    offset?: number;
    success?: boolean;
}
/**
 * Usage statistics
 */
export interface UsageStats {
    organizationId: number;
    period: {
        start: string;
        end: string;
    };
    traces: {
        total: number;
        byStatus: Record<string, number>;
    };
    evaluations: {
        total: number;
        byType: Record<string, number>;
    };
    apiCalls: {
        total: number;
        byEndpoint: Record<string, number>;
    };
}
/**
 * Parameters for getting usage stats
 */
export interface GetUsageParams {
    organizationId: number;
    startDate?: string;
    endDate?: string;
}
/**
 * Usage summary
 */
export interface UsageSummary {
    organizationId: number;
    currentPeriod: {
        traces: number;
        evaluations: number;
        annotations: number;
        apiCalls: number;
    };
    limits: OrganizationLimits;
    billingPeriod: {
        start: string;
        end: string;
    };
}
/**
 * LLM Judge configuration object
 */
export interface LLMJudgeConfig {
    id: number;
    name: string;
    description: string | null;
    model: string;
    rubric: string;
    temperature: number;
    maxTokens: number;
    organizationId: number;
    createdBy: number;
    createdAt: string;
    updatedAt: string;
}
/**
 * Parameters for creating an LLM judge config
 */
export interface CreateLLMJudgeConfigParams {
    name: string;
    description?: string;
    model: string;
    rubric: string;
    temperature?: number;
    maxTokens?: number;
    organizationId: number;
    createdBy: number;
}
/**
 * Parameters for listing LLM judge configs
 */
export interface ListLLMJudgeConfigsParams {
    organizationId?: number;
    limit?: number;
    offset?: number;
}
/**
 * Parameters for listing LLM judge results
 */
export interface ListLLMJudgeResultsParams {
    configId?: number;
    evaluationId?: number;
    limit?: number;
    offset?: number;
}
/**
 * LLM Judge alignment analysis
 */
export interface LLMJudgeAlignment {
    configId: number;
    totalEvaluations: number;
    averageScore: number;
    alignmentMetrics: {
        accuracy: number;
        precision: number;
        recall: number;
        f1Score: number;
    };
    scoreDistribution: Record<string, number>;
    comparisonWithHuman?: {
        agreement: number;
        correlation: number;
    };
}
/**
 * Parameters for getting alignment analysis
 */
export interface GetLLMJudgeAlignmentParams {
    configId: number;
    startDate?: string;
    endDate?: string;
}
/**
 * Organization object
 */
export interface Organization {
    id: number;
    name: string;
    slug: string;
    plan: string;
    status: 'active' | 'suspended' | 'cancelled';
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, any>;
}
