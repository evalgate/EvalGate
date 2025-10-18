import {
  ClientConfig,
  Trace,
  CreateTraceParams,
  ListTracesParams,
  Evaluation,
  CreateEvaluationParams,
  UpdateEvaluationParams,
  ListEvaluationsParams,
  LLMJudgeResult,
  RunLLMJudgeParams,
  TestCase,
  CreateTestCaseParams,
  EvaluationRun,
  CreateRunParams,
  Span,
  CreateSpanParams,
  OrganizationLimits,
} from './types';
import { EvalAIError, createErrorFromResponse } from './errors';
import { Logger, createLogger, RequestLogger } from './logger';
import { mergeWithContext } from './context';

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
export class AIEvalClient {
  private apiKey: string;
  private baseUrl: string;
  private organizationId?: number;
  private timeout: number;
  private logger: Logger;
  private requestLogger: RequestLogger;
  private retryConfig: {
    maxAttempts: number;
    backoff: 'exponential' | 'linear' | 'fixed';
    retryableErrors: string[];
  };

  public traces: TraceAPI;
  public evaluations: EvaluationAPI;
  public llmJudge: LLMJudgeAPI;

  constructor(config: ClientConfig = {}) {
    // Tier 1.1: Zero-config with env variable detection
    this.apiKey = config.apiKey || process.env.EVALAI_API_KEY || process.env.AI_EVAL_API_KEY || '';
    
    if (!this.apiKey) {
      throw new EvalAIError(
        'API key is required',
        'MISSING_API_KEY',
        0
      );
    }

    // Auto-detect organization ID from env
    const orgIdFromEnv = process.env.EVALAI_ORGANIZATION_ID || process.env.AI_EVAL_ORGANIZATION_ID;
    this.organizationId = config.organizationId || (orgIdFromEnv ? parseInt(orgIdFromEnv, 10) : undefined);

    // Default to relative URLs for browser, or allow custom baseUrl
    const isBrowser = typeof (globalThis as any).window !== 'undefined';
    this.baseUrl = config.baseUrl || (isBrowser ? '' : 'http://localhost:3000');
    this.timeout = config.timeout || 30000;

    // Tier 4.17: Debug mode with request logging
    const logLevel = config.logLevel || (config.debug ? 'debug' : 'info');
    this.logger = createLogger({
      level: logLevel,
      pretty: config.debug,
      prefix: 'EvalAI'
    });
    this.requestLogger = new RequestLogger(this.logger);

    // Retry configuration
    this.retryConfig = {
      maxAttempts: config.retry?.maxAttempts || 3,
      backoff: config.retry?.backoff || 'exponential',
      retryableErrors: config.retry?.retryableErrors || [
        'RATE_LIMIT_EXCEEDED',
        'TIMEOUT',
        'NETWORK_ERROR',
        'INTERNAL_SERVER_ERROR'
      ]
    };

    // Initialize API modules
    this.traces = new TraceAPI(this);
    this.evaluations = new EvaluationAPI(this);
    this.llmJudge = new LLMJudgeAPI(this);

    this.logger.info('SDK initialized', {
      hasOrganizationId: !!this.organizationId,
      baseUrl: this.baseUrl
    });
  }

  /**
   * Zero-config initialization using environment variables
   * 
   * Environment variables:
   * - EVALAI_API_KEY or AI_EVAL_API_KEY: Your API key
   * - EVALAI_ORGANIZATION_ID or AI_EVAL_ORGANIZATION_ID: Your organization ID
   * - EVALAI_BASE_URL: Custom API base URL (optional)
   * 
   * @example
   * ```typescript
   * // Set env vars:
   * // EVALAI_API_KEY=your-key
   * // EVALAI_ORGANIZATION_ID=123
   * 
   * const client = AIEvalClient.init();
   * ```
   */
  static init(config: Partial<ClientConfig> = {}): AIEvalClient {
    return new AIEvalClient({
      baseUrl: process.env.EVALAI_BASE_URL,
      ...config
    });
  }

  /**
   * Internal method to make HTTP requests with retry logic and error handling
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    attempt: number = 1
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const startTime = Date.now();

    // Log request
    this.requestLogger.logRequest({
      method: options.method || 'GET',
      url,
      headers: options.headers as Record<string, string>,
      body: options.body
    });

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      let data: any;
      try {
        data = await response.json();
      } catch (e) {
        data = {};
      }

      // Log response
      this.requestLogger.logResponse({
        method: options.method || 'GET',
        url,
        status: response.status,
        duration,
        body: data
      });

      if (!response.ok) {
        const error = createErrorFromResponse(response, data);
        
        // Retry logic
        if (
          attempt < this.retryConfig.maxAttempts &&
          this.retryConfig.retryableErrors.includes(error.code)
        ) {
          const delay = this.calculateBackoff(attempt);
          this.logger.warn(`Retrying request (attempt ${attempt + 1}/${this.retryConfig.maxAttempts}) after ${delay}ms`, {
            error: error.code,
            url
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.request<T>(endpoint, options, attempt + 1);
        }

        throw error;
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof EvalAIError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new EvalAIError(
            'Request timeout',
            'TIMEOUT',
            408
          );
        }
        throw new EvalAIError(
          error.message,
          'NETWORK_ERROR',
          0
        );
      }

      throw error;
    }
  }

  /**
   * Calculate backoff delay for retries
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = 1000; // 1 second
    
    switch (this.retryConfig.backoff) {
      case 'exponential':
        return baseDelay * Math.pow(2, attempt - 1);
      case 'linear':
        return baseDelay * attempt;
      case 'fixed':
      default:
        return baseDelay;
    }
  }

  getOrganizationId(): number | undefined {
    return this.organizationId;
  }

  /**
   * Get the logger instance for custom logging
   */
  getLogger(): Logger {
    return this.logger;
  }

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
  async getOrganizationLimits(): Promise<OrganizationLimits> {
    const orgId = this.getOrganizationId();
    if (!orgId) {
      throw new EvalAIError(
        'Organization ID is required',
        'MISSING_ORGANIZATION_ID',
        0
      );
    }

    return this.request<OrganizationLimits>(`/api/organizations/${orgId}/limits`);
  }
}

/**
 * Trace API methods
 */
class TraceAPI {
  constructor(private client: AIEvalClient) {}

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
  async create<TMetadata = Record<string, any>>(
    params: CreateTraceParams<TMetadata>
  ): Promise<Trace<TMetadata>> {
    const orgId = params.organizationId || this.client.getOrganizationId();
    if (!orgId) {
      throw new EvalAIError(
        'Organization ID is required',
        'MISSING_ORGANIZATION_ID',
        0
      );
    }

    // Merge with context
    const metadata = mergeWithContext(params.metadata || {});

    return this.client.request<Trace<TMetadata>>('/api/traces', {
      method: 'POST',
      body: JSON.stringify({ ...params, organizationId: orgId, metadata }),
    });
  }

  /**
   * List traces with optional filtering
   */
  async list(params: ListTracesParams = {}): Promise<Trace[]> {
    const searchParams = new URLSearchParams();
    
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    if (params.organizationId) searchParams.set('organizationId', params.organizationId.toString());
    if (params.status) searchParams.set('status', params.status);
    if (params.search) searchParams.set('search', params.search);

    const query = searchParams.toString();
    const endpoint = query ? `/api/traces?${query}` : '/api/traces';

    return this.client.request<Trace[]>(endpoint);
  }

  /**
   * Delete a trace by ID
   */
  async delete(id: number): Promise<{ message: string }> {
    return this.client.request<{ message: string }>(`/api/traces?id=${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get a single trace by ID
   */
  async get(id: number): Promise<Trace> {
    return this.client.request<Trace>(`/api/traces/${id}`);
  }

  /**
   * Create a span for a trace
   */
  async createSpan(traceId: number, params: CreateSpanParams): Promise<Span> {
    return this.client.request<Span>(`/api/traces/${traceId}/spans`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * List spans for a trace
   */
  async listSpans(traceId: number): Promise<Span[]> {
    return this.client.request<Span[]>(`/api/traces/${traceId}/spans`);
  }
}

/**
 * Evaluation API methods
 */
class EvaluationAPI {
  constructor(private client: AIEvalClient) {}

  /**
   * Create a new evaluation
   */
  async create(params: CreateEvaluationParams): Promise<Evaluation> {
    const orgId = params.organizationId || this.client.getOrganizationId();
    if (!orgId) {
      throw new EvalAIError(
        'Organization ID is required',
        'MISSING_ORGANIZATION_ID',
        0
      );
    }

    return this.client.request<Evaluation>('/api/evaluations', {
      method: 'POST',
      body: JSON.stringify({ ...params, organizationId: orgId }),
    });
  }

  /**
   * Get a single evaluation by ID
   */
  async get(id: number): Promise<Evaluation> {
    return this.client.request<Evaluation>(`/api/evaluations?id=${id}`);
  }

  /**
   * List evaluations with optional filtering
   */
  async list(params: ListEvaluationsParams = {}): Promise<Evaluation[]> {
    const searchParams = new URLSearchParams();
    
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    if (params.organizationId) searchParams.set('organizationId', params.organizationId.toString());
    if (params.type) searchParams.set('type', params.type);
    if (params.status) searchParams.set('status', params.status);
    if (params.search) searchParams.set('search', params.search);

    const query = searchParams.toString();
    const endpoint = query ? `/api/evaluations?${query}` : '/api/evaluations';

    return this.client.request<Evaluation[]>(endpoint);
  }

  /**
   * Update an evaluation
   */
  async update(id: number, params: UpdateEvaluationParams): Promise<Evaluation> {
    return this.client.request<Evaluation>(`/api/evaluations?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  }

  /**
   * Delete an evaluation
   */
  async delete(id: number): Promise<{ message: string }> {
    return this.client.request<{ message: string }>(`/api/evaluations?id=${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Create a test case for an evaluation
   */
  async createTestCase(evaluationId: number, params: CreateTestCaseParams): Promise<TestCase> {
    return this.client.request<TestCase>(`/api/evaluations/${evaluationId}/test-cases`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * List test cases for an evaluation
   */
  async listTestCases(evaluationId: number): Promise<TestCase[]> {
    return this.client.request<TestCase[]>(`/api/evaluations/${evaluationId}/test-cases`);
  }

  /**
   * Create a run for an evaluation
   */
  async createRun(evaluationId: number, params: CreateRunParams): Promise<EvaluationRun> {
    return this.client.request<EvaluationRun>(`/api/evaluations/${evaluationId}/runs`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * List runs for an evaluation
   */
  async listRuns(evaluationId: number): Promise<EvaluationRun[]> {
    return this.client.request<EvaluationRun[]>(`/api/evaluations/${evaluationId}/runs`);
  }

  /**
   * Get a specific run
   */
  async getRun(evaluationId: number, runId: number): Promise<EvaluationRun> {
    return this.client.request<EvaluationRun>(`/api/evaluations/${evaluationId}/runs/${runId}`);
  }
}

/**
 * LLM Judge API methods
 */
class LLMJudgeAPI {
  constructor(private client: AIEvalClient) {}

  /**
   * Run an LLM judge evaluation
   */
  async evaluate(params: RunLLMJudgeParams): Promise<{
    result: LLMJudgeResult;
    config: any;
  }> {
    return this.client.request<{ result: LLMJudgeResult; config: any }>(
      '/api/llm-judge/evaluate',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  }
}