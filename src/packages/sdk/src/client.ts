import { RequestBatcher } from "./batch";
import { getTTL, RequestCache, shouldCache } from "./cache";
import { DEFAULT_BASE_URL } from "./constants";
import { mergeWithContext } from "./context";
import { createErrorFromResponse, EvalGateError } from "./errors";
import { createLogger, type Logger, RequestLogger } from "./logger";
import type {
	// Annotations
	Annotation,
	AnnotationItem,
	AnnotationTask,
	// Developer
	APIKey,
	APIKeyUsage,
	APIKeyWithSecret,
	ClientConfig,
	CreateAnnotationItemParams,
	CreateAnnotationParams,
	CreateAnnotationTaskParams,
	CreateAPIKeyParams,
	CreateEvaluationParams,
	CreateLLMJudgeConfigParams,
	CreateRunParams,
	CreateSpanParams,
	CreateTestCaseParams,
	CreateTraceParams,
	CreateWebhookParams,
	Evaluation,
	EvaluationRun,
	EvaluationRunDetail,
	GetLLMJudgeAlignmentParams,
	GetUsageParams,
	ListAnnotationItemsParams,
	ListAnnotationsParams,
	ListAnnotationTasksParams,
	ListAPIKeysParams,
	ListEvaluationsParams,
	ListLLMJudgeConfigsParams,
	ListLLMJudgeResultsParams,
	ListTracesParams,
	ListWebhookDeliveriesParams,
	ListWebhooksParams,
	LLMJudgeAlignment,
	// LLM Judge Extended
	LLMJudgeConfig,
	LLMJudgeEvaluateResult,
	LLMJudgeResult,
	// Organizations
	Organization,
	OrganizationLimits,
	RunLLMJudgeParams,
	Span,
	TestCase,
	Trace,
	TraceDetail,
	UpdateAPIKeyParams,
	UpdateEvaluationParams,
	UpdateTraceParams,
	UpdateWebhookParams,
	UsageStats,
	UsageSummary,
	Webhook,
	WebhookDelivery,
} from "./types";
import { SDK_VERSION, SPEC_VERSION } from "./version";

/**
 * Safe environment variable access (works in both Node.js and browsers).
 * Prefers EVALGATE_* vars; falls back to EVALAI_* with deprecation warning.
 */
function getEnvVar(newName: string, legacyName?: string): string | undefined {
	if (typeof process === "undefined" || !process.env) return undefined;
	const val = process.env[newName];
	if (val) return val;
	if (legacyName && process.env[legacyName]) {
		if (
			typeof process !== "undefined" &&
			!(process as any).__EVALGATE_LEGACY_WARNED
		) {
			console.warn(
				`[EvalGate] Deprecation: ${legacyName} is deprecated. Use ${newName} instead.`,
			);
			(process as any).__EVALGATE_LEGACY_WARNED = true;
		}
		return process.env[legacyName];
	}
	return undefined;
}

/**
 * EvalGate SDK Client
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
	private cache: RequestCache;
	// biome-ignore lint/correctness/noUnusedPrivateClassMembers: used for request batching (assigned in constructor)
	private batcher: RequestBatcher | null;
	private retryConfig: {
		maxAttempts: number;
		backoff: "exponential" | "linear" | "fixed";
		retryableErrors: string[];
	};

	public traces: TraceAPI;
	public evaluations: EvaluationAPI;
	public llmJudge: LLMJudgeAPI;
	public annotations: AnnotationsAPI;
	public developer: DeveloperAPI;
	public organizations: OrganizationsAPI;

	constructor(config: ClientConfig = {}) {
		// Tier 1.1: Zero-config with env variable detection (works in Node.js and browsers)
		this.apiKey =
			config.apiKey ||
			getEnvVar("EVALGATE_API_KEY", "EVALAI_API_KEY") ||
			getEnvVar("AI_EVAL_API_KEY") ||
			"";

		if (!this.apiKey) {
			throw new EvalGateError(
				"API key is required. Provide via config.apiKey or EVALGATE_API_KEY environment variable.",
				"MISSING_API_KEY",
				0,
			);
		}

		// Auto-detect organization ID from env
		const orgIdFromEnv =
			getEnvVar("EVALGATE_ORGANIZATION_ID", "EVALAI_ORGANIZATION_ID") ||
			getEnvVar("AI_EVAL_ORGANIZATION_ID");
		this.organizationId =
			config.organizationId ||
			(orgIdFromEnv ? parseInt(orgIdFromEnv, 10) : undefined);

		const isBrowser = typeof (globalThis as any).window !== "undefined";
		this.baseUrl =
			config.baseUrl ||
			getEnvVar("EVALGATE_BASE_URL", "EVALAI_BASE_URL") ||
			(isBrowser ? "" : DEFAULT_BASE_URL);
		this.timeout = config.timeout || 30000;

		// Tier 4.17: Debug mode with request logging
		const logLevel = config.logLevel || (config.debug ? "debug" : "info");
		this.logger = createLogger({
			level: logLevel,
			pretty: config.debug,
			prefix: "EvalGate",
		});
		this.requestLogger = new RequestLogger(this.logger);

		// Retry configuration
		this.retryConfig = {
			maxAttempts: config.retry?.maxAttempts || 3,
			backoff: config.retry?.backoff || "exponential",
			retryableErrors: config.retry?.retryableErrors || [
				"RATE_LIMIT_EXCEEDED",
				"TIMEOUT",
				"NETWORK_ERROR",
				"INTERNAL_SERVER_ERROR",
			],
		};

		// Initialize cache for GET requests
		this.cache = new RequestCache(config.cacheSize || 1000);

		// Initialize request batcher if enabled (default: enabled)
		if (config.enableBatching !== false) {
			const MAX_CONCURRENCY = 5;

			this.batcher = new RequestBatcher(
				async (requests) => {
					const results: import("./batch").BatchResponse[] = [];
					const executing = new Set<Promise<void>>();

					for (const req of requests) {
						const task = (async () => {
							try {
								const data = await this.request(req.endpoint, {
									method: req.method,
									body: req.body ? JSON.stringify(req.body) : undefined,
									headers: req.headers,
								});
								results.push({ id: req.id, status: 200, data });
							} catch (err: unknown) {
								const errorObj = err as {
									statusCode?: number;
									message?: string;
								};
								results.push({
									id: req.id,
									status: errorObj?.statusCode || 500,
									data: null,
									error: errorObj?.message || "Unknown error",
								});
							}
						})();

						const tracked = task.finally(() => executing.delete(tracked));
						executing.add(tracked);

						if (executing.size >= MAX_CONCURRENCY) {
							await Promise.race(executing);
						}
					}

					await Promise.allSettled(executing);
					return results;
				},
				{
					maxBatchSize: config.batchSize || 10,
					batchDelay: config.batchDelay || 50,
				},
			);
		} else {
			this.batcher = null;
		}

		// Initialize API modules
		this.traces = new TraceAPI(this);
		this.evaluations = new EvaluationAPI(this);
		this.llmJudge = new LLMJudgeAPI(this);
		this.annotations = new AnnotationsAPI(this);
		this.developer = new DeveloperAPI(this);
		this.organizations = new OrganizationsAPI(this);

		this.logger.info("SDK initialized", {
			hasOrganizationId: !!this.organizationId,
			baseUrl: this.baseUrl,
		});
	}

	/**
	 * Zero-config initialization using environment variables
	 *
	 * Works in both Node.js and browsers. In Node.js, reads from environment variables.
	 * In browsers, you must provide config explicitly.
	 *
	 * Environment variables (Node.js only):
	 * - EVALGATE_API_KEY (or EVALAI_API_KEY): Your API key
	 * - EVALGATE_ORGANIZATION_ID (or EVALAI_ORGANIZATION_ID): Your organization ID
	 * - EVALGATE_BASE_URL (or EVALAI_BASE_URL): Custom API base URL (optional)
	 *
	 * @example
	 * ```typescript
	 * // Node.js - reads from env vars:
	 * // EVALGATE_API_KEY=your-key
	 * // EVALGATE_ORGANIZATION_ID=123
	 * const client = AIEvalClient.init();
	 *
	 * // Browser - must provide config:
	 * const client = AIEvalClient.init({
	 *   apiKey: 'your-key',
	 *   organizationId: 123
	 * });
	 * ```
	 */
	static init(config: Partial<ClientConfig> = {}): AIEvalClient {
		return new AIEvalClient({
			baseUrl: getEnvVar("EVALGATE_BASE_URL", "EVALAI_BASE_URL"),
			...config,
		});
	}

	/**
	 * Internal method to make HTTP requests with retry logic and error handling
	 */
	async request<T>(
		endpoint: string,
		options: RequestInit = {},
		attempt: number = 1,
	): Promise<T> {
		const method = (options.method || "GET").toUpperCase();
		const url = `${this.baseUrl}${endpoint}`;

		// Check cache for GET requests
		if (method === "GET" && shouldCache(method, endpoint)) {
			const cached = this.cache.get<T>(method, endpoint, options.body);
			if (cached !== null) {
				this.logger.debug("Cache hit", { endpoint });
				return cached;
			}
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);
		const startTime = Date.now();

		// Log request
		this.requestLogger.logRequest({
			method: options.method || "GET",
			url,
			headers: options.headers as Record<string, string>,
			body: options.body,
		});

		try {
			const response = await fetch(url, {
				...options,
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
					"X-EvalGate-SDK-Version": SDK_VERSION,
					"X-EvalGate-Spec-Version": SPEC_VERSION,
					...options.headers,
				},
				signal: controller.signal,
			});

			clearTimeout(timeoutId);
			const duration = Date.now() - startTime;

			let data: unknown;
			try {
				data = await response.json();
			} catch (_e) {
				data = {};
			}

			// Log response
			this.requestLogger.logResponse({
				method: options.method || "GET",
				url,
				status: response.status,
				duration,
				body: data,
			});

			if (!response.ok) {
				const error = createErrorFromResponse(response, data);

				// Retry logic
				if (
					attempt < this.retryConfig.maxAttempts &&
					this.retryConfig.retryableErrors.includes(error.code)
				) {
					const delay = this.calculateBackoff(attempt);
					this.logger.warn(
						`Retrying request (attempt ${attempt + 1}/${this.retryConfig.maxAttempts}) after ${delay}ms`,
						{
							error: error.code,
							url,
						},
					);

					await new Promise((resolve) => setTimeout(resolve, delay));
					return this.request<T>(endpoint, options, attempt + 1);
				}

				throw error;
			}

			// Cache successful GET responses
			if (method === "GET" && shouldCache(method, endpoint)) {
				const ttl = getTTL(endpoint);
				this.cache.set(method, endpoint, data, ttl, options.body);
				this.logger.debug("Cached response", { endpoint, ttl });
			}

			// Invalidate cache for mutation operations
			if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
				// Invalidate related cached entries
				const resourceMatch = endpoint.match(/\/api\/(\w+)/);
				if (resourceMatch) {
					this.cache.invalidatePattern(resourceMatch[1]);
				}
			}

			return data as T;
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof EvalGateError) {
				throw error;
			}

			if (error instanceof Error) {
				if (error.name === "AbortError") {
					throw new EvalGateError("Request timeout", "TIMEOUT", 408);
				}
				throw new EvalGateError(error.message, "NETWORK_ERROR", 0);
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
			case "exponential":
				return baseDelay * 2 ** (attempt - 1);
			case "linear":
				return baseDelay * attempt;
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
	 * @deprecated The /api/organizations/:id/limits endpoint does not exist.
	 * Use `organizations.getCurrent()` to get org info instead.
	 */
	async getOrganizationLimits(): Promise<OrganizationLimits> {
		return {} as OrganizationLimits;
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
	async create<TMetadata = Record<string, unknown>>(
		params: CreateTraceParams<TMetadata>,
	): Promise<Trace<TMetadata>> {
		const orgId = params.organizationId || this.client.getOrganizationId();
		if (!orgId) {
			throw new EvalGateError(
				"Organization ID is required",
				"MISSING_ORGANIZATION_ID",
				0,
			);
		}

		// Merge with context
		const metadata = mergeWithContext(params.metadata || {});

		return this.client.request<Trace<TMetadata>>("/api/traces", {
			method: "POST",
			body: JSON.stringify({ ...params, organizationId: orgId, metadata }),
		});
	}

	/**
	 * List traces with optional filtering
	 */
	async list(params: ListTracesParams = {}): Promise<Trace[]> {
		const searchParams = new URLSearchParams();

		if (params.limit) searchParams.set("limit", params.limit.toString());
		if (params.offset) searchParams.set("offset", params.offset.toString());
		if (params.organizationId)
			searchParams.set("organizationId", params.organizationId.toString());
		if (params.status) searchParams.set("status", params.status);
		if (params.search) searchParams.set("search", params.search);

		const query = searchParams.toString();
		const endpoint = query ? `/api/traces?${query}` : "/api/traces";

		return this.client.request<Trace[]>(endpoint);
	}

	/**
	 * Delete a trace by ID
	 */
	async delete(id: number): Promise<{ message: string }> {
		return this.client.request<{ message: string }>(`/api/traces?id=${id}`, {
			method: "DELETE",
		});
	}

	/**
	 * Get a single trace by ID, including its spans
	 */
	async get(id: number): Promise<TraceDetail> {
		return this.client.request<TraceDetail>(`/api/traces/${id}`);
	}

	/**
	 * Update an existing trace (e.g. set status, duration, metadata on completion)
	 *
	 * @example
	 * ```typescript
	 * await client.traces.update(42, {
	 *   status: 'success',
	 *   durationMs: 1234,
	 *   metadata: { output: 'done' }
	 * });
	 * ```
	 */
	async update<TMetadata = Record<string, unknown>>(
		id: number,
		params: UpdateTraceParams<TMetadata>,
	): Promise<Trace<TMetadata>> {
		return this.client.request<Trace<TMetadata>>(`/api/traces/${id}`, {
			method: "PATCH",
			body: JSON.stringify(params),
		});
	}

	/**
	 * Create a span for a trace
	 */
	async createSpan(traceId: number, params: CreateSpanParams): Promise<Span> {
		return this.client.request<Span>(`/api/traces/${traceId}/spans`, {
			method: "POST",
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
			throw new EvalGateError(
				"Organization ID is required",
				"MISSING_ORGANIZATION_ID",
				0,
			);
		}

		return this.client.request<Evaluation>("/api/evaluations", {
			method: "POST",
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

		if (params.limit) searchParams.set("limit", params.limit.toString());
		if (params.offset) searchParams.set("offset", params.offset.toString());
		if (params.organizationId)
			searchParams.set("organizationId", params.organizationId.toString());
		if (params.type) searchParams.set("type", params.type);
		if (params.status) searchParams.set("status", params.status);
		if (params.search) searchParams.set("search", params.search);

		const query = searchParams.toString();
		const endpoint = query ? `/api/evaluations?${query}` : "/api/evaluations";

		return this.client.request<Evaluation[]>(endpoint);
	}

	/**
	 * Update an evaluation
	 */
	async update(
		id: number,
		params: UpdateEvaluationParams,
	): Promise<Evaluation> {
		return this.client.request<Evaluation>(`/api/evaluations?id=${id}`, {
			method: "PUT",
			body: JSON.stringify(params),
		});
	}

	/**
	 * Delete an evaluation
	 */
	async delete(id: number): Promise<{ message: string }> {
		return this.client.request<{ message: string }>(
			`/api/evaluations?id=${id}`,
			{
				method: "DELETE",
			},
		);
	}

	/**
	 * Create a test case for an evaluation
	 */
	async createTestCase(
		evaluationId: number,
		params: CreateTestCaseParams,
	): Promise<TestCase> {
		return this.client.request<TestCase>(
			`/api/evaluations/${evaluationId}/test-cases`,
			{
				method: "POST",
				body: JSON.stringify(params),
			},
		);
	}

	/**
	 * List test cases for an evaluation
	 */
	async listTestCases(evaluationId: number): Promise<TestCase[]> {
		return this.client.request<TestCase[]>(
			`/api/evaluations/${evaluationId}/test-cases`,
		);
	}

	/**
	 * Create a run for an evaluation
	 */
	async createRun(
		evaluationId: number,
		params: CreateRunParams,
	): Promise<EvaluationRun> {
		return this.client.request<EvaluationRun>(
			`/api/evaluations/${evaluationId}/runs`,
			{
				method: "POST",
				body: JSON.stringify(params),
			},
		);
	}

	/**
	 * List runs for an evaluation
	 */
	async listRuns(evaluationId: number): Promise<EvaluationRun[]> {
		return this.client.request<EvaluationRun[]>(
			`/api/evaluations/${evaluationId}/runs`,
		);
	}

	/**
	 * Get a specific run with its results
	 */
	async getRun(
		evaluationId: number,
		runId: number,
	): Promise<EvaluationRunDetail> {
		return this.client.request<EvaluationRunDetail>(
			`/api/evaluations/${evaluationId}/runs/${runId}`,
		);
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
	async evaluate(
		params: RunLLMJudgeParams,
	): Promise<{ result: LLMJudgeEvaluateResult }> {
		return this.client.request<{ result: LLMJudgeEvaluateResult }>(
			"/api/llm-judge/evaluate",
			{
				method: "POST",
				body: JSON.stringify(params),
			},
		);
	}

	/**
	 * Create an LLM judge configuration
	 */
	async createConfig(
		params: CreateLLMJudgeConfigParams,
	): Promise<LLMJudgeConfig> {
		return this.client.request<LLMJudgeConfig>("/api/llm-judge/configs", {
			method: "POST",
			body: JSON.stringify(params),
		});
	}

	/**
	 * List LLM judge configurations
	 */
	async listConfigs(
		params: ListLLMJudgeConfigsParams = {},
	): Promise<LLMJudgeConfig[]> {
		const searchParams = new URLSearchParams();
		if (params.organizationId)
			searchParams.set("organizationId", params.organizationId.toString());
		if (params.limit) searchParams.set("limit", params.limit.toString());
		if (params.offset) searchParams.set("offset", params.offset.toString());

		const query = searchParams.toString();
		const endpoint = query
			? `/api/llm-judge/configs?${query}`
			: "/api/llm-judge/configs";

		return this.client.request<LLMJudgeConfig[]>(endpoint);
	}

	/**
	 * List LLM judge results
	 */
	async listResults(
		params: ListLLMJudgeResultsParams = {},
	): Promise<LLMJudgeResult[]> {
		const searchParams = new URLSearchParams();
		if (params.configId)
			searchParams.set("configId", params.configId.toString());
		if (params.evaluationId)
			searchParams.set("evaluationId", params.evaluationId.toString());
		if (params.limit) searchParams.set("limit", params.limit.toString());
		if (params.offset) searchParams.set("offset", params.offset.toString());

		const query = searchParams.toString();
		const endpoint = query
			? `/api/llm-judge/results?${query}`
			: "/api/llm-judge/results";

		return this.client.request<LLMJudgeResult[]>(endpoint);
	}

	/**
	 * Get alignment analysis
	 */
	async getAlignment(
		params: GetLLMJudgeAlignmentParams,
	): Promise<LLMJudgeAlignment> {
		const searchParams = new URLSearchParams();
		searchParams.set("evaluationRunId", params.evaluationRunId.toString());

		const query = searchParams.toString();
		return this.client.request<LLMJudgeAlignment>(
			`/api/llm-judge/alignment?${query}`,
		);
	}
}

/**
 * Annotations API methods
 */
class AnnotationsAPI {
	public readonly tasks: AnnotationTasksAPI;

	constructor(private client: AIEvalClient) {
		this.tasks = new AnnotationTasksAPI(client);
	}

	/**
	 * Create an annotation
	 */
	async create(params: CreateAnnotationParams): Promise<Annotation> {
		return this.client
			.request<{ annotation: Annotation }>("/api/annotations", {
				method: "POST",
				body: JSON.stringify(params),
			})
			.then((res) => res.annotation);
	}

	/**
	 * List annotations
	 */
	async list(params: ListAnnotationsParams = {}): Promise<Annotation[]> {
		const searchParams = new URLSearchParams();
		if (params.evaluationRunId)
			searchParams.set("evaluationRunId", params.evaluationRunId.toString());
		if (params.testCaseId)
			searchParams.set("testCaseId", params.testCaseId.toString());
		if (params.limit) searchParams.set("limit", params.limit.toString());
		if (params.offset) searchParams.set("offset", params.offset.toString());

		const query = searchParams.toString();
		const endpoint = query ? `/api/annotations?${query}` : "/api/annotations";

		return this.client
			.request<{ annotations: Annotation[] }>(endpoint)
			.then((res) => res.annotations);
	}
}

/**
 * Annotation Tasks API methods
 */
class AnnotationTasksAPI {
	public readonly items: AnnotationTaskItemsAPI;

	constructor(private client: AIEvalClient) {
		this.items = new AnnotationTaskItemsAPI(client);
	}

	/**
	 * Create an annotation task
	 */
	async create(params: CreateAnnotationTaskParams): Promise<AnnotationTask> {
		return this.client.request<AnnotationTask>("/api/annotations/tasks", {
			method: "POST",
			body: JSON.stringify(params),
		});
	}

	/**
	 * List annotation tasks
	 */
	async list(
		params: ListAnnotationTasksParams = {},
	): Promise<AnnotationTask[]> {
		const searchParams = new URLSearchParams();
		if (params.organizationId)
			searchParams.set("organizationId", params.organizationId.toString());
		if (params.status) searchParams.set("status", params.status);
		if (params.limit) searchParams.set("limit", params.limit.toString());
		if (params.offset) searchParams.set("offset", params.offset.toString());

		const query = searchParams.toString();
		const endpoint = query
			? `/api/annotations/tasks?${query}`
			: "/api/annotations/tasks";

		return this.client.request<AnnotationTask[]>(endpoint);
	}

	/**
	 * Get an annotation task
	 */
	async get(taskId: number): Promise<AnnotationTask> {
		return this.client
			.request<{ task: AnnotationTask }>(`/api/annotations/tasks/${taskId}`)
			.then((res) => res.task);
	}
}

/**
 * Annotation Task Items API methods
 */
class AnnotationTaskItemsAPI {
	constructor(private client: AIEvalClient) {}

	/**
	 * Create an annotation item
	 */
	async create(
		taskId: number,
		params: CreateAnnotationItemParams,
	): Promise<AnnotationItem> {
		return this.client.request<AnnotationItem>(
			`/api/annotations/tasks/${taskId}/items`,
			{
				method: "POST",
				body: JSON.stringify(params),
			},
		);
	}

	/**
	 * List annotation items
	 */
	async list(
		taskId: number,
		params: ListAnnotationItemsParams = {},
	): Promise<AnnotationItem[]> {
		const searchParams = new URLSearchParams();
		if (params.limit) searchParams.set("limit", params.limit.toString());
		if (params.offset) searchParams.set("offset", params.offset.toString());

		const query = searchParams.toString();
		const endpoint = query
			? `/api/annotations/tasks/${taskId}/items?${query}`
			: `/api/annotations/tasks/${taskId}/items`;

		return this.client.request<AnnotationItem[]>(endpoint);
	}
}

/**
 * Developer API methods
 */
class DeveloperAPI {
	public readonly apiKeys: APIKeysAPI;
	public readonly webhooks: WebhooksAPI;

	constructor(private client: AIEvalClient) {
		this.apiKeys = new APIKeysAPI(client);
		this.webhooks = new WebhooksAPI(client);
	}

	/**
	 * Get usage statistics
	 */
	async getUsage(params: GetUsageParams = {}): Promise<UsageStats> {
		const searchParams = new URLSearchParams();
		if (params.period) searchParams.set("period", params.period);
		if (params.groupBy) searchParams.set("groupBy", params.groupBy);
		if (params.limit) searchParams.set("limit", params.limit.toString());
		if (params.offset) searchParams.set("offset", params.offset.toString());

		const query = searchParams.toString();
		const endpoint = query
			? `/api/developer/usage?${query}`
			: "/api/developer/usage";
		return this.client.request<UsageStats>(endpoint);
	}

	/**
	 * Get usage summary
	 */
	async getUsageSummary(
		params: { period?: "7d" | "30d" | "90d" | "all" } = {},
	): Promise<UsageSummary> {
		const searchParams = new URLSearchParams();
		if (params.period) searchParams.set("period", params.period);

		const query = searchParams.toString();
		const endpoint = query
			? `/api/developer/usage/summary?${query}`
			: "/api/developer/usage/summary";
		return this.client.request<UsageSummary>(endpoint);
	}
}

/**
 * API Keys API methods
 */
class APIKeysAPI {
	constructor(private client: AIEvalClient) {}

	/**
	 * Create an API key
	 */
	async create(params: CreateAPIKeyParams): Promise<APIKeyWithSecret> {
		return this.client.request<APIKeyWithSecret>("/api/developer/api-keys", {
			method: "POST",
			body: JSON.stringify(params),
		});
	}

	/**
	 * List API keys
	 */
	async list(params: ListAPIKeysParams = {}): Promise<APIKey[]> {
		const searchParams = new URLSearchParams();
		if (params.organizationId)
			searchParams.set("organizationId", params.organizationId.toString());
		if (params.limit) searchParams.set("limit", params.limit.toString());
		if (params.offset) searchParams.set("offset", params.offset.toString());

		const query = searchParams.toString();
		const endpoint = query
			? `/api/developer/api-keys?${query}`
			: "/api/developer/api-keys";

		return this.client.request<APIKey[]>(endpoint);
	}

	/**
	 * Update an API key
	 */
	async update(keyId: number, params: UpdateAPIKeyParams): Promise<APIKey> {
		return this.client.request<APIKey>(`/api/developer/api-keys/${keyId}`, {
			method: "PATCH",
			body: JSON.stringify(params),
		});
	}

	/**
	 * Revoke an API key
	 */
	async revoke(keyId: number): Promise<{ message: string }> {
		return this.client.request<{ message: string }>(
			`/api/developer/api-keys/${keyId}`,
			{
				method: "DELETE",
			},
		);
	}

	/**
	 * Get API key usage
	 */
	async getUsage(keyId: number): Promise<APIKeyUsage> {
		return this.client.request<APIKeyUsage>(
			`/api/developer/api-keys/${keyId}/usage`,
		);
	}
}

/**
 * Webhooks API methods
 */
class WebhooksAPI {
	constructor(private client: AIEvalClient) {}

	/**
	 * Create a webhook
	 */
	async create(params: CreateWebhookParams): Promise<Webhook> {
		return this.client.request<Webhook>("/api/developer/webhooks", {
			method: "POST",
			body: JSON.stringify(params),
		});
	}

	/**
	 * List webhooks
	 */
	async list(params: ListWebhooksParams): Promise<Webhook[]> {
		const searchParams = new URLSearchParams();
		searchParams.set("organizationId", params.organizationId.toString());
		if (params.status) searchParams.set("status", params.status);
		if (params.limit) searchParams.set("limit", params.limit.toString());
		if (params.offset) searchParams.set("offset", params.offset.toString());

		const query = searchParams.toString();
		return this.client.request<Webhook[]>(`/api/developer/webhooks?${query}`);
	}

	/**
	 * Get a webhook
	 */
	async get(webhookId: number): Promise<Webhook> {
		return this.client.request<Webhook>(`/api/developer/webhooks/${webhookId}`);
	}

	/**
	 * Update a webhook
	 */
	async update(
		webhookId: number,
		params: UpdateWebhookParams,
	): Promise<Webhook> {
		return this.client.request<Webhook>(
			`/api/developer/webhooks/${webhookId}`,
			{
				method: "PATCH",
				body: JSON.stringify(params),
			},
		);
	}

	/**
	 * Delete a webhook
	 */
	async delete(webhookId: number): Promise<{ message: string }> {
		return this.client.request<{ message: string }>(
			`/api/developer/webhooks/${webhookId}`,
			{
				method: "DELETE",
			},
		);
	}

	/**
	 * Get webhook deliveries
	 */
	async getDeliveries(
		webhookId: number,
		params: ListWebhookDeliveriesParams = {},
	): Promise<{ deliveries: WebhookDelivery[]; total: number }> {
		const searchParams = new URLSearchParams();
		if (params.limit) searchParams.set("limit", params.limit.toString());
		if (params.offset) searchParams.set("offset", params.offset.toString());
		if (params.status) searchParams.set("status", params.status);

		const query = searchParams.toString();
		const endpoint = query
			? `/api/developer/webhooks/${webhookId}/deliveries?${query}`
			: `/api/developer/webhooks/${webhookId}/deliveries`;

		return this.client.request<{
			deliveries: WebhookDelivery[];
			total: number;
		}>(endpoint);
	}
}

/**
 * Organizations API methods
 */
class OrganizationsAPI {
	constructor(private client: AIEvalClient) {}

	/**
	 * Get current organization
	 */
	async getCurrent(): Promise<Organization> {
		return this.client
			.request<{ organization: Organization }>("/api/organizations/current")
			.then((res) => res.organization);
	}
}
