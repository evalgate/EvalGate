"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIEvalClient = void 0;
const errors_1 = require("./errors");
const logger_1 = require("./logger");
const context_1 = require("./context");
const cache_1 = require("./cache");
const batch_1 = require("./batch");
/**
 * Safe environment variable access (works in both Node.js and browsers)
 */
function getEnvVar(name) {
    if (typeof process !== 'undefined' && process.env) {
        return process.env[name];
    }
    return undefined;
}
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
class AIEvalClient {
    constructor(config = {}) {
        // Tier 1.1: Zero-config with env variable detection (works in Node.js and browsers)
        this.apiKey = config.apiKey || getEnvVar('EVALAI_API_KEY') || getEnvVar('AI_EVAL_API_KEY') || '';
        if (!this.apiKey) {
            throw new errors_1.EvalAIError('API key is required. Provide via config.apiKey or EVALAI_API_KEY environment variable.', 'MISSING_API_KEY', 0);
        }
        // Auto-detect organization ID from env
        const orgIdFromEnv = getEnvVar('EVALAI_ORGANIZATION_ID') || getEnvVar('AI_EVAL_ORGANIZATION_ID');
        this.organizationId = config.organizationId || (orgIdFromEnv ? parseInt(orgIdFromEnv, 10) : undefined);
        // Default to relative URLs for browser, or allow custom baseUrl
        const isBrowser = typeof globalThis.window !== 'undefined';
        this.baseUrl = config.baseUrl || (isBrowser ? '' : 'http://localhost:3000');
        this.timeout = config.timeout || 30000;
        // Tier 4.17: Debug mode with request logging
        const logLevel = config.logLevel || (config.debug ? 'debug' : 'info');
        this.logger = (0, logger_1.createLogger)({
            level: logLevel,
            pretty: config.debug,
            prefix: 'EvalAI'
        });
        this.requestLogger = new logger_1.RequestLogger(this.logger);
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
        // Initialize cache for GET requests
        this.cache = new cache_1.RequestCache(config.cacheSize || 1000);
        // Initialize request batcher if enabled (default: enabled)
        if (config.enableBatching !== false) {
            this.batcher = new batch_1.RequestBatcher(async (requests) => {
                // Batch execution placeholder - will be implemented per API
                return requests.map(req => ({
                    id: req.id,
                    status: 200,
                    data: null,
                }));
            }, {
                maxBatchSize: config.batchSize || 10,
                batchDelay: config.batchDelay || 50,
            });
        }
        else {
            this.batcher = null;
        }
        // Initialize API modules
        this.traces = new TraceAPI(this);
        this.evaluations = new EvaluationAPI(this);
        this.llmJudge = new LLMJudgeAPI(this);
        this.annotations = new AnnotationsAPI(this);
        this.developer = new DeveloperAPI(this);
        this.organizations = new OrganizationsAPI(this);
        this.logger.info('SDK initialized', {
            hasOrganizationId: !!this.organizationId,
            baseUrl: this.baseUrl
        });
    }
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
    static init(config = {}) {
        return new AIEvalClient({
            baseUrl: getEnvVar('EVALAI_BASE_URL'),
            ...config
        });
    }
    /**
     * Internal method to make HTTP requests with retry logic and error handling
     */
    async request(endpoint, options = {}, attempt = 1) {
        const method = (options.method || 'GET').toUpperCase();
        const url = `${this.baseUrl}${endpoint}`;
        // Check cache for GET requests
        if (method === 'GET' && (0, cache_1.shouldCache)(method, endpoint)) {
            const cached = this.cache.get(method, endpoint, options.body);
            if (cached !== null) {
                this.logger.debug('Cache hit', { endpoint });
                return cached;
            }
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        const startTime = Date.now();
        // Log request
        this.requestLogger.logRequest({
            method: options.method || 'GET',
            url,
            headers: options.headers,
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
            let data;
            try {
                data = await response.json();
            }
            catch (e) {
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
                const error = (0, errors_1.createErrorFromResponse)(response, data);
                // Retry logic
                if (attempt < this.retryConfig.maxAttempts &&
                    this.retryConfig.retryableErrors.includes(error.code)) {
                    const delay = this.calculateBackoff(attempt);
                    this.logger.warn(`Retrying request (attempt ${attempt + 1}/${this.retryConfig.maxAttempts}) after ${delay}ms`, {
                        error: error.code,
                        url
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.request(endpoint, options, attempt + 1);
                }
                throw error;
            }
            // Cache successful GET responses
            if (method === 'GET' && (0, cache_1.shouldCache)(method, endpoint)) {
                const ttl = (0, cache_1.getTTL)(endpoint);
                this.cache.set(method, endpoint, data, ttl, options.body);
                this.logger.debug('Cached response', { endpoint, ttl });
            }
            // Invalidate cache for mutation operations
            if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
                // Invalidate related cached entries
                const resourceMatch = endpoint.match(/\/api\/(\w+)/);
                if (resourceMatch) {
                    this.cache.invalidatePattern(resourceMatch[1]);
                }
            }
            return data;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof errors_1.EvalAIError) {
                throw error;
            }
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new errors_1.EvalAIError('Request timeout', 'TIMEOUT', 408);
                }
                throw new errors_1.EvalAIError(error.message, 'NETWORK_ERROR', 0);
            }
            throw error;
        }
    }
    /**
     * Calculate backoff delay for retries
     */
    calculateBackoff(attempt) {
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
    getOrganizationId() {
        return this.organizationId;
    }
    /**
     * Get the logger instance for custom logging
     */
    getLogger() {
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
    async getOrganizationLimits() {
        const orgId = this.getOrganizationId();
        if (!orgId) {
            throw new errors_1.EvalAIError('Organization ID is required', 'MISSING_ORGANIZATION_ID', 0);
        }
        return this.request(`/api/organizations/${orgId}/limits`);
    }
}
exports.AIEvalClient = AIEvalClient;
/**
 * Trace API methods
 */
class TraceAPI {
    constructor(client) {
        this.client = client;
    }
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
    async create(params) {
        const orgId = params.organizationId || this.client.getOrganizationId();
        if (!orgId) {
            throw new errors_1.EvalAIError('Organization ID is required', 'MISSING_ORGANIZATION_ID', 0);
        }
        // Merge with context
        const metadata = (0, context_1.mergeWithContext)(params.metadata || {});
        return this.client.request('/api/traces', {
            method: 'POST',
            body: JSON.stringify({ ...params, organizationId: orgId, metadata }),
        });
    }
    /**
     * List traces with optional filtering
     */
    async list(params = {}) {
        const searchParams = new URLSearchParams();
        if (params.limit)
            searchParams.set('limit', params.limit.toString());
        if (params.offset)
            searchParams.set('offset', params.offset.toString());
        if (params.organizationId)
            searchParams.set('organizationId', params.organizationId.toString());
        if (params.status)
            searchParams.set('status', params.status);
        if (params.search)
            searchParams.set('search', params.search);
        const query = searchParams.toString();
        const endpoint = query ? `/api/traces?${query}` : '/api/traces';
        return this.client.request(endpoint);
    }
    /**
     * Delete a trace by ID
     */
    async delete(id) {
        return this.client.request(`/api/traces?id=${id}`, {
            method: 'DELETE',
        });
    }
    /**
     * Get a single trace by ID
     */
    async get(id) {
        return this.client.request(`/api/traces/${id}`);
    }
    /**
     * Create a span for a trace
     */
    async createSpan(traceId, params) {
        return this.client.request(`/api/traces/${traceId}/spans`, {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    /**
     * List spans for a trace
     */
    async listSpans(traceId) {
        return this.client.request(`/api/traces/${traceId}/spans`);
    }
}
/**
 * Evaluation API methods
 */
class EvaluationAPI {
    constructor(client) {
        this.client = client;
    }
    /**
     * Create a new evaluation
     */
    async create(params) {
        const orgId = params.organizationId || this.client.getOrganizationId();
        if (!orgId) {
            throw new errors_1.EvalAIError('Organization ID is required', 'MISSING_ORGANIZATION_ID', 0);
        }
        return this.client.request('/api/evaluations', {
            method: 'POST',
            body: JSON.stringify({ ...params, organizationId: orgId }),
        });
    }
    /**
     * Get a single evaluation by ID
     */
    async get(id) {
        return this.client.request(`/api/evaluations?id=${id}`);
    }
    /**
     * List evaluations with optional filtering
     */
    async list(params = {}) {
        const searchParams = new URLSearchParams();
        if (params.limit)
            searchParams.set('limit', params.limit.toString());
        if (params.offset)
            searchParams.set('offset', params.offset.toString());
        if (params.organizationId)
            searchParams.set('organizationId', params.organizationId.toString());
        if (params.type)
            searchParams.set('type', params.type);
        if (params.status)
            searchParams.set('status', params.status);
        if (params.search)
            searchParams.set('search', params.search);
        const query = searchParams.toString();
        const endpoint = query ? `/api/evaluations?${query}` : '/api/evaluations';
        return this.client.request(endpoint);
    }
    /**
     * Update an evaluation
     */
    async update(id, params) {
        return this.client.request(`/api/evaluations?id=${id}`, {
            method: 'PUT',
            body: JSON.stringify(params),
        });
    }
    /**
     * Delete an evaluation
     */
    async delete(id) {
        return this.client.request(`/api/evaluations?id=${id}`, {
            method: 'DELETE',
        });
    }
    /**
     * Create a test case for an evaluation
     */
    async createTestCase(evaluationId, params) {
        return this.client.request(`/api/evaluations/${evaluationId}/test-cases`, {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    /**
     * List test cases for an evaluation
     */
    async listTestCases(evaluationId) {
        return this.client.request(`/api/evaluations/${evaluationId}/test-cases`);
    }
    /**
     * Create a run for an evaluation
     */
    async createRun(evaluationId, params) {
        return this.client.request(`/api/evaluations/${evaluationId}/runs`, {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    /**
     * List runs for an evaluation
     */
    async listRuns(evaluationId) {
        return this.client.request(`/api/evaluations/${evaluationId}/runs`);
    }
    /**
     * Get a specific run
     */
    async getRun(evaluationId, runId) {
        return this.client.request(`/api/evaluations/${evaluationId}/runs/${runId}`);
    }
}
/**
 * LLM Judge API methods
 */
class LLMJudgeAPI {
    constructor(client) {
        this.client = client;
    }
    /**
     * Run an LLM judge evaluation
     */
    async evaluate(params) {
        return this.client.request('/api/llm-judge/evaluate', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    /**
     * Create an LLM judge configuration
     */
    async createConfig(params) {
        return this.client.request('/api/llm-judge/configs', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    /**
     * List LLM judge configurations
     */
    async listConfigs(params = {}) {
        const searchParams = new URLSearchParams();
        if (params.organizationId)
            searchParams.set('organizationId', params.organizationId.toString());
        if (params.limit)
            searchParams.set('limit', params.limit.toString());
        if (params.offset)
            searchParams.set('offset', params.offset.toString());
        const query = searchParams.toString();
        const endpoint = query ? `/api/llm-judge/configs?${query}` : '/api/llm-judge/configs';
        return this.client.request(endpoint);
    }
    /**
     * List LLM judge results
     */
    async listResults(params = {}) {
        const searchParams = new URLSearchParams();
        if (params.configId)
            searchParams.set('configId', params.configId.toString());
        if (params.evaluationId)
            searchParams.set('evaluationId', params.evaluationId.toString());
        if (params.limit)
            searchParams.set('limit', params.limit.toString());
        if (params.offset)
            searchParams.set('offset', params.offset.toString());
        const query = searchParams.toString();
        const endpoint = query ? `/api/llm-judge/results?${query}` : '/api/llm-judge/results';
        return this.client.request(endpoint);
    }
    /**
     * Get alignment analysis
     */
    async getAlignment(params) {
        const searchParams = new URLSearchParams();
        searchParams.set('configId', params.configId.toString());
        if (params.startDate)
            searchParams.set('startDate', params.startDate);
        if (params.endDate)
            searchParams.set('endDate', params.endDate);
        const query = searchParams.toString();
        return this.client.request(`/api/llm-judge/alignment?${query}`);
    }
}
/**
 * Annotations API methods
 */
class AnnotationsAPI {
    constructor(client) {
        this.client = client;
        this.tasks = new AnnotationTasksAPI(client);
    }
    /**
     * Create an annotation
     */
    async create(params) {
        return this.client.request('/api/annotations', {
            method: 'POST',
            body: JSON.stringify(params),
        }).then(res => res.annotation);
    }
    /**
     * List annotations
     */
    async list(params = {}) {
        const searchParams = new URLSearchParams();
        if (params.evaluationRunId)
            searchParams.set('evaluationRunId', params.evaluationRunId.toString());
        if (params.testCaseId)
            searchParams.set('testCaseId', params.testCaseId.toString());
        if (params.limit)
            searchParams.set('limit', params.limit.toString());
        if (params.offset)
            searchParams.set('offset', params.offset.toString());
        const query = searchParams.toString();
        const endpoint = query ? `/api/annotations?${query}` : '/api/annotations';
        return this.client.request(endpoint).then(res => res.annotations);
    }
}
/**
 * Annotation Tasks API methods
 */
class AnnotationTasksAPI {
    constructor(client) {
        this.client = client;
        this.items = new AnnotationTaskItemsAPI(client);
    }
    /**
     * Create an annotation task
     */
    async create(params) {
        return this.client.request('/api/annotations/tasks', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    /**
     * List annotation tasks
     */
    async list(params = {}) {
        const searchParams = new URLSearchParams();
        if (params.organizationId)
            searchParams.set('organizationId', params.organizationId.toString());
        if (params.status)
            searchParams.set('status', params.status);
        if (params.limit)
            searchParams.set('limit', params.limit.toString());
        if (params.offset)
            searchParams.set('offset', params.offset.toString());
        const query = searchParams.toString();
        const endpoint = query ? `/api/annotations/tasks?${query}` : '/api/annotations/tasks';
        return this.client.request(endpoint);
    }
    /**
     * Get an annotation task
     */
    async get(taskId) {
        return this.client.request(`/api/annotations/tasks/${taskId}`);
    }
}
/**
 * Annotation Task Items API methods
 */
class AnnotationTaskItemsAPI {
    constructor(client) {
        this.client = client;
    }
    /**
     * Create an annotation item
     */
    async create(taskId, params) {
        return this.client.request(`/api/annotations/tasks/${taskId}/items`, {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    /**
     * List annotation items
     */
    async list(taskId, params = {}) {
        const searchParams = new URLSearchParams();
        if (params.limit)
            searchParams.set('limit', params.limit.toString());
        if (params.offset)
            searchParams.set('offset', params.offset.toString());
        const query = searchParams.toString();
        const endpoint = query ? `/api/annotations/tasks/${taskId}/items?${query}` : `/api/annotations/tasks/${taskId}/items`;
        return this.client.request(endpoint);
    }
}
/**
 * Developer API methods
 */
class DeveloperAPI {
    constructor(client) {
        this.client = client;
        this.apiKeys = new APIKeysAPI(client);
        this.webhooks = new WebhooksAPI(client);
    }
    /**
     * Get usage statistics
     */
    async getUsage(params) {
        const searchParams = new URLSearchParams();
        searchParams.set('organizationId', params.organizationId.toString());
        if (params.startDate)
            searchParams.set('startDate', params.startDate);
        if (params.endDate)
            searchParams.set('endDate', params.endDate);
        const query = searchParams.toString();
        return this.client.request(`/api/developer/usage?${query}`);
    }
    /**
     * Get usage summary
     */
    async getUsageSummary(organizationId) {
        return this.client.request(`/api/developer/usage/summary?organizationId=${organizationId}`);
    }
}
/**
 * API Keys API methods
 */
class APIKeysAPI {
    constructor(client) {
        this.client = client;
    }
    /**
     * Create an API key
     */
    async create(params) {
        return this.client.request('/api/developer/api-keys', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    /**
     * List API keys
     */
    async list(params = {}) {
        const searchParams = new URLSearchParams();
        if (params.organizationId)
            searchParams.set('organizationId', params.organizationId.toString());
        if (params.limit)
            searchParams.set('limit', params.limit.toString());
        if (params.offset)
            searchParams.set('offset', params.offset.toString());
        const query = searchParams.toString();
        const endpoint = query ? `/api/developer/api-keys?${query}` : '/api/developer/api-keys';
        return this.client.request(endpoint);
    }
    /**
     * Update an API key
     */
    async update(keyId, params) {
        return this.client.request(`/api/developer/api-keys/${keyId}`, {
            method: 'PATCH',
            body: JSON.stringify(params),
        });
    }
    /**
     * Revoke an API key
     */
    async revoke(keyId) {
        return this.client.request(`/api/developer/api-keys/${keyId}`, {
            method: 'DELETE',
        });
    }
    /**
     * Get API key usage
     */
    async getUsage(keyId) {
        return this.client.request(`/api/developer/api-keys/${keyId}/usage`);
    }
}
/**
 * Webhooks API methods
 */
class WebhooksAPI {
    constructor(client) {
        this.client = client;
    }
    /**
     * Create a webhook
     */
    async create(params) {
        return this.client.request('/api/developer/webhooks', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    /**
     * List webhooks
     */
    async list(params) {
        const searchParams = new URLSearchParams();
        searchParams.set('organizationId', params.organizationId.toString());
        if (params.status)
            searchParams.set('status', params.status);
        if (params.limit)
            searchParams.set('limit', params.limit.toString());
        if (params.offset)
            searchParams.set('offset', params.offset.toString());
        const query = searchParams.toString();
        return this.client.request(`/api/developer/webhooks?${query}`);
    }
    /**
     * Get a webhook
     */
    async get(webhookId) {
        return this.client.request(`/api/developer/webhooks/${webhookId}`);
    }
    /**
     * Update a webhook
     */
    async update(webhookId, params) {
        return this.client.request(`/api/developer/webhooks/${webhookId}`, {
            method: 'PATCH',
            body: JSON.stringify(params),
        });
    }
    /**
     * Delete a webhook
     */
    async delete(webhookId) {
        return this.client.request(`/api/developer/webhooks/${webhookId}`, {
            method: 'DELETE',
        });
    }
    /**
     * Get webhook deliveries
     */
    async getDeliveries(webhookId, params = {}) {
        const searchParams = new URLSearchParams();
        if (params.limit)
            searchParams.set('limit', params.limit.toString());
        if (params.offset)
            searchParams.set('offset', params.offset.toString());
        if (params.success !== undefined)
            searchParams.set('success', params.success.toString());
        const query = searchParams.toString();
        const endpoint = query ? `/api/developer/webhooks/${webhookId}/deliveries?${query}` : `/api/developer/webhooks/${webhookId}/deliveries`;
        return this.client.request(endpoint);
    }
}
/**
 * Organizations API methods
 */
class OrganizationsAPI {
    constructor(client) {
        this.client = client;
    }
    /**
     * Get current organization
     */
    async getCurrent() {
        return this.client.request('/api/organizations/current');
    }
}
