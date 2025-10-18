/**
 * Streaming & Batch Operations
 * Tier 2.8: Handle large datasets efficiently
 *
 * @example
 * ```typescript
 * import { streamEvaluations, batchCreate } from '@ai-eval-platform/sdk';
 *
 * // Stream large evaluation results
 * for await (const result of streamEvaluations(client, config)) {
 *   console.log(`Progress: ${result.completed}/${result.total}`);
 * }
 *
 * // Batch create traces
 * await batchCreate(client.traces, traces, { batchSize: 100 });
 * ```
 */
export interface BatchOptions {
    /** Batch size (default: 100) */
    batchSize?: number;
    /** Run batches in parallel (default: true) */
    parallel?: boolean;
    /** Delay between batches in ms (default: 0) */
    delayMs?: number;
    /** Callback for progress updates */
    onProgress?: (progress: BatchProgress) => void;
    /** Callback for batch errors */
    onError?: (error: BatchError) => void;
    /** Continue on error (default: true) */
    continueOnError?: boolean;
}
export interface BatchProgress {
    /** Total items */
    total: number;
    /** Completed items */
    completed: number;
    /** Failed items */
    failed: number;
    /** Current batch number */
    batch: number;
    /** Total batches */
    totalBatches: number;
}
export interface BatchError {
    /** Batch number where error occurred */
    batch: number;
    /** Item index in batch */
    index: number;
    /** The error */
    error: Error;
    /** The item that failed */
    item: any;
}
export interface BatchResult<T> {
    /** Successfully processed items */
    successful: T[];
    /** Failed items */
    failed: Array<{
        item: any;
        error: Error;
    }>;
    /** Summary */
    summary: {
        total: number;
        successful: number;
        failed: number;
    };
}
/**
 * Batch create items
 *
 * @example
 * ```typescript
 * const traces = [
 *   { name: 'trace-1', traceId: 'id-1' },
 *   { name: 'trace-2', traceId: 'id-2' },
 *   // ... 1000 more
 * ];
 *
 * const result = await batchCreate(
 *   (item) => client.traces.create(item),
 *   traces,
 *   {
 *     batchSize: 100,
 *     onProgress: (p) => console.log(`${p.completed}/${p.total}`)
 *   }
 * );
 * ```
 */
export declare function batchProcess<TInput, TOutput>(processor: (item: TInput) => Promise<TOutput>, items: TInput[], options?: BatchOptions): Promise<BatchResult<TOutput>>;
/**
 * Stream evaluation results
 *
 * @example
 * ```typescript
 * const config = {
 *   cases: [...],
 *   executor: async (input) => callLLM(input)
 * };
 *
 * for await (const result of streamEvaluation(config)) {
 *   console.log(`Case ${result.caseId}: ${result.passed ? 'PASS' : 'FAIL'}`);
 *   console.log(`Progress: ${result.completed}/${result.total}`);
 * }
 * ```
 */
export declare function streamEvaluation<T>(config: {
    cases: T[];
    executor: (testCase: T) => Promise<any>;
    onProgress?: (progress: BatchProgress) => void;
}): AsyncGenerator<{
    caseId: string;
    case: T;
    result: any;
    passed: boolean;
    completed: number;
    total: number;
}>;
/**
 * Batch read with pagination
 *
 * @example
 * ```typescript
 * const allTraces = await batchRead(
 *   (params) => client.traces.list(params),
 *   { pageSize: 100 }
 * );
 * ```
 */
export declare function batchRead<T>(fetcher: (params: {
    limit: number;
    offset: number;
}) => Promise<T[]>, options?: {
    pageSize?: number;
    maxPages?: number;
    onProgress?: (page: number, items: number) => void;
}): Promise<T[]>;
/**
 * Rate-limited batch processor
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({ requestsPerSecond: 10 });
 *
 * for (const item of items) {
 *   await limiter.throttle(() => client.traces.create(item));
 * }
 * ```
 */
export declare class RateLimiter {
    private queue;
    private processing;
    private requestsPerSecond;
    private interval;
    constructor(options: {
        requestsPerSecond: number;
    });
    /**
     * Throttle a function call
     */
    throttle<T>(fn: () => Promise<T>): Promise<T>;
    private process;
}
/**
 * Chunk array into smaller arrays
 *
 * @example
 * ```typescript
 * const chunks = chunk([1, 2, 3, 4, 5], 2);
 * // [[1, 2], [3, 4], [5]]
 * ```
 */
export declare function chunk<T>(array: T[], size: number): T[][];
