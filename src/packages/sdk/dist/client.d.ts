import { ClientConfig, Trace, CreateTraceParams, ListTracesParams, Evaluation, CreateEvaluationParams, UpdateEvaluationParams, ListEvaluationsParams, LLMJudgeResult, RunLLMJudgeParams, TestCase, CreateTestCaseParams, EvaluationRun, CreateRunParams, Span, CreateSpanParams, OrganizationLimits, Annotation, CreateAnnotationParams, ListAnnotationsParams, AnnotationTask, CreateAnnotationTaskParams, ListAnnotationTasksParams, AnnotationItem, CreateAnnotationItemParams, ListAnnotationItemsParams, APIKey, APIKeyWithSecret, CreateAPIKeyParams, UpdateAPIKeyParams, ListAPIKeysParams, APIKeyUsage, Webhook, CreateWebhookParams, UpdateWebhookParams, ListWebhooksParams, WebhookDelivery, ListWebhookDeliveriesParams, UsageStats, GetUsageParams, UsageSummary, LLMJudgeConfig, CreateLLMJudgeConfigParams, ListLLMJudgeConfigsParams, ListLLMJudgeResultsParams, LLMJudgeAlignment, GetLLMJudgeAlignmentParams, Organization } from './types';
import { Logger } from './logger';
/**
 * AI Evaluation Platform SDK Client
 *
 * @example
 * ```typescript
 * import { AIEvalClient } from '@ai-eval-platform/sdk';
 *
 * // Zero-config initialization (uses env variables)
 * const client = AIEvalClient.init();
 *
 * // Or with explicit config
 * const client = new AIEvalClient({
 *   apiKey: 'your-api-key',
 *   organizationId: 123,
 *   debug: true
 * });
 *
 * // Create a trace with automatic context propagation
 * const trace = await client.traces.create({
 *   name: 'User Query',
 *   traceId: 'trace-123'
 * });
 * ```
 */
export declare class AIEvalClient {
    private apiKey;
    private baseUrl;
    private organizationId?;
    private timeout;
    private logger;
    private requestLogger;
    private cache;
    private batcher;
    private retryConfig;
    traces: TraceAPI;
    evaluations: EvaluationAPI;
    llmJudge: LLMJudgeAPI;
    annotations: AnnotationsAPI;
    developer: DeveloperAPI;
    organizations: OrganizationsAPI;
    constructor(config?: ClientConfig);
    /**
     * Zero-config initialization using environment variables
     *
     * Works in both Node.js and browsers. In Node.js, reads from environment variables.
     * In browsers, you must provide config explicitly.
     *
     * Environment variables (Node.js only):
     * - EVALAI_API_KEY or AI_EVAL_API_KEY: Your API key
     * - EVALAI_ORGANIZATION_ID or AI_EVAL_ORGANIZATION_ID: Your organization ID
     * - EVALAI_BASE_URL: Custom API base URL (optional)
     *
     * @example
     * ```typescript
     * // Node.js - reads from env vars:
     * // EVALAI_API_KEY=your-key
     * // EVALAI_ORGANIZATION_ID=123
     * const client = AIEvalClient.init();
     *
     * // Browser - must provide config:
     * const client = AIEvalClient.init({
     *   apiKey: 'your-key',
     *   organizationId: 123
     * });
     * ```
     */
    static init(config?: Partial<ClientConfig>): AIEvalClient;
    /**
     * Internal method to make HTTP requests with retry logic and error handling
     */
    request<T>(endpoint: string, options?: RequestInit, attempt?: number): Promise<T>;
    /**
     * Calculate backoff delay for retries
     */
    private calculateBackoff;
    getOrganizationId(): number | undefined;
    /**
     * Get the logger instance for custom logging
     */
    getLogger(): Logger;
    /**
     * Get organization resource limits and usage
     * Returns feature usage data for per-organization quotas
     *
     * @example
     * ```typescript
     * const limits = await client.getOrganizationLimits();
     * console.log('Traces:', limits.traces_per_organization);
     * console.log('Evaluations:', limits.evals_per_organization);
     * ```
     */
    getOrganizationLimits(): Promise<OrganizationLimits>;
}
/**
 * Trace API methods
 */
declare class TraceAPI {
    private client;
    constructor(client: AIEvalClient);
    /**
     * Create a new trace with automatic context propagation
     *
     * @example
     * ```typescript
     * const trace = await client.traces.create({
     *   name: 'User Query',
     *   traceId: 'trace-123',
     *   metadata: { userId: '456' }
     * });
     * ```
     */
    create<TMetadata = Record<string, any>>(params: CreateTraceParams<TMetadata>): Promise<Trace<TMetadata>>;
    /**
     * List traces with optional filtering
     */
    list(params?: ListTracesParams): Promise<Trace[]>;
    /**
     * Delete a trace by ID
     */
    delete(id: number): Promise<{
        message: string;
    }>;
    /**
     * Get a single trace by ID
     */
    get(id: number): Promise<Trace>;
    /**
     * Create a span for a trace
     */
    createSpan(traceId: number, params: CreateSpanParams): Promise<Span>;
    /**
     * List spans for a trace
     */
    listSpans(traceId: number): Promise<Span[]>;
}
/**
 * Evaluation API methods
 */
declare class EvaluationAPI {
    private client;
    constructor(client: AIEvalClient);
    /**
     * Create a new evaluation
     */
    create(params: CreateEvaluationParams): Promise<Evaluation>;
    /**
     * Get a single evaluation by ID
     */
    get(id: number): Promise<Evaluation>;
    /**
     * List evaluations with optional filtering
     */
    list(params?: ListEvaluationsParams): Promise<Evaluation[]>;
    /**
     * Update an evaluation
     */
    update(id: number, params: UpdateEvaluationParams): Promise<Evaluation>;
    /**
     * Delete an evaluation
     */
    delete(id: number): Promise<{
        message: string;
    }>;
    /**
     * Create a test case for an evaluation
     */
    createTestCase(evaluationId: number, params: CreateTestCaseParams): Promise<TestCase>;
    /**
     * List test cases for an evaluation
     */
    listTestCases(evaluationId: number): Promise<TestCase[]>;
    /**
     * Create a run for an evaluation
     */
    createRun(evaluationId: number, params: CreateRunParams): Promise<EvaluationRun>;
    /**
     * List runs for an evaluation
     */
    listRuns(evaluationId: number): Promise<EvaluationRun[]>;
    /**
     * Get a specific run
     */
    getRun(evaluationId: number, runId: number): Promise<EvaluationRun>;
}
/**
 * LLM Judge API methods
 */
declare class LLMJudgeAPI {
    private client;
    constructor(client: AIEvalClient);
    /**
     * Run an LLM judge evaluation
     */
    evaluate(params: RunLLMJudgeParams): Promise<{
        result: LLMJudgeResult;
        config: any;
    }>;
    /**
     * Create an LLM judge configuration
     */
    createConfig(params: CreateLLMJudgeConfigParams): Promise<LLMJudgeConfig>;
    /**
     * List LLM judge configurations
     */
    listConfigs(params?: ListLLMJudgeConfigsParams): Promise<LLMJudgeConfig[]>;
    /**
     * List LLM judge results
     */
    listResults(params?: ListLLMJudgeResultsParams): Promise<LLMJudgeResult[]>;
    /**
     * Get alignment analysis
     */
    getAlignment(params: GetLLMJudgeAlignmentParams): Promise<LLMJudgeAlignment>;
}
/**
 * Annotations API methods
 */
declare class AnnotationsAPI {
    private client;
    readonly tasks: AnnotationTasksAPI;
    constructor(client: AIEvalClient);
    /**
     * Create an annotation
     */
    create(params: CreateAnnotationParams): Promise<Annotation>;
    /**
     * List annotations
     */
    list(params?: ListAnnotationsParams): Promise<Annotation[]>;
}
/**
 * Annotation Tasks API methods
 */
declare class AnnotationTasksAPI {
    private client;
    readonly items: AnnotationTaskItemsAPI;
    constructor(client: AIEvalClient);
    /**
     * Create an annotation task
     */
    create(params: CreateAnnotationTaskParams): Promise<AnnotationTask>;
    /**
     * List annotation tasks
     */
    list(params?: ListAnnotationTasksParams): Promise<AnnotationTask[]>;
    /**
     * Get an annotation task
     */
    get(taskId: number): Promise<AnnotationTask>;
}
/**
 * Annotation Task Items API methods
 */
declare class AnnotationTaskItemsAPI {
    private client;
    constructor(client: AIEvalClient);
    /**
     * Create an annotation item
     */
    create(taskId: number, params: CreateAnnotationItemParams): Promise<AnnotationItem>;
    /**
     * List annotation items
     */
    list(taskId: number, params?: ListAnnotationItemsParams): Promise<AnnotationItem[]>;
}
/**
 * Developer API methods
 */
declare class DeveloperAPI {
    private client;
    readonly apiKeys: APIKeysAPI;
    readonly webhooks: WebhooksAPI;
    constructor(client: AIEvalClient);
    /**
     * Get usage statistics
     */
    getUsage(params: GetUsageParams): Promise<UsageStats>;
    /**
     * Get usage summary
     */
    getUsageSummary(organizationId: number): Promise<UsageSummary>;
}
/**
 * API Keys API methods
 */
declare class APIKeysAPI {
    private client;
    constructor(client: AIEvalClient);
    /**
     * Create an API key
     */
    create(params: CreateAPIKeyParams): Promise<APIKeyWithSecret>;
    /**
     * List API keys
     */
    list(params?: ListAPIKeysParams): Promise<APIKey[]>;
    /**
     * Update an API key
     */
    update(keyId: number, params: UpdateAPIKeyParams): Promise<APIKey>;
    /**
     * Revoke an API key
     */
    revoke(keyId: number): Promise<{
        message: string;
    }>;
    /**
     * Get API key usage
     */
    getUsage(keyId: number): Promise<APIKeyUsage>;
}
/**
 * Webhooks API methods
 */
declare class WebhooksAPI {
    private client;
    constructor(client: AIEvalClient);
    /**
     * Create a webhook
     */
    create(params: CreateWebhookParams): Promise<Webhook>;
    /**
     * List webhooks
     */
    list(params: ListWebhooksParams): Promise<Webhook[]>;
    /**
     * Get a webhook
     */
    get(webhookId: number): Promise<Webhook>;
    /**
     * Update a webhook
     */
    update(webhookId: number, params: UpdateWebhookParams): Promise<Webhook>;
    /**
     * Delete a webhook
     */
    delete(webhookId: number): Promise<{
        message: string;
    }>;
    /**
     * Get webhook deliveries
     */
    getDeliveries(webhookId: number, params?: ListWebhookDeliveriesParams): Promise<WebhookDelivery[]>;
}
/**
 * Organizations API methods
 */
declare class OrganizationsAPI {
    private client;
    constructor(client: AIEvalClient);
    /**
     * Get current organization
     */
    getCurrent(): Promise<Organization>;
}
export {};
