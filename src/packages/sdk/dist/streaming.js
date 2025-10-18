"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
exports.batchProcess = batchProcess;
exports.streamEvaluation = streamEvaluation;
exports.batchRead = batchRead;
exports.chunk = chunk;
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
async function batchProcess(processor, items, options = {}) {
    const { batchSize = 100, parallel = true, delayMs = 0, onProgress, onError, continueOnError = true } = options;
    const result = {
        successful: [],
        failed: [],
        summary: {
            total: items.length,
            successful: 0,
            failed: 0
        }
    };
    // Split into batches
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
    }
    // Process batches
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const processBatch = async () => {
            const batchPromises = batch.map(async (item, itemIndex) => {
                try {
                    const output = await processor(item);
                    result.successful.push(output);
                    result.summary.successful++;
                    return { success: true, output };
                }
                catch (error) {
                    const batchError = {
                        batch: batchIndex,
                        index: itemIndex,
                        error: error instanceof Error ? error : new Error(String(error)),
                        item
                    };
                    result.failed.push({
                        item,
                        error: batchError.error
                    });
                    result.summary.failed++;
                    if (onError)
                        onError(batchError);
                    if (!continueOnError) {
                        throw error;
                    }
                    return { success: false, error };
                }
            });
            if (parallel) {
                await Promise.all(batchPromises);
            }
            else {
                for (const promise of batchPromises) {
                    await promise;
                }
            }
        };
        await processBatch();
        // Progress callback
        if (onProgress) {
            onProgress({
                total: items.length,
                completed: result.summary.successful + result.summary.failed,
                failed: result.summary.failed,
                batch: batchIndex + 1,
                totalBatches: batches.length
            });
        }
        // Delay between batches
        if (delayMs > 0 && batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    return result;
}
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
async function* streamEvaluation(config) {
    const { cases, executor } = config;
    let completed = 0;
    for (const [index, testCase] of cases.entries()) {
        try {
            const result = await executor(testCase);
            completed++;
            yield {
                caseId: `case-${index}`,
                case: testCase,
                result,
                passed: true,
                completed,
                total: cases.length
            };
        }
        catch (error) {
            completed++;
            yield {
                caseId: `case-${index}`,
                case: testCase,
                result: error,
                passed: false,
                completed,
                total: cases.length
            };
        }
    }
}
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
async function batchRead(fetcher, options = {}) {
    const { pageSize = 100, maxPages, onProgress } = options;
    const allItems = [];
    let page = 0;
    let hasMore = true;
    while (hasMore && (!maxPages || page < maxPages)) {
        const items = await fetcher({
            limit: pageSize,
            offset: page * pageSize
        });
        if (items.length === 0) {
            hasMore = false;
        }
        else {
            allItems.push(...items);
            page++;
            if (onProgress) {
                onProgress(page, allItems.length);
            }
            if (items.length < pageSize) {
                hasMore = false;
            }
        }
    }
    return allItems;
}
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
class RateLimiter {
    constructor(options) {
        this.queue = [];
        this.processing = false;
        this.requestsPerSecond = options.requestsPerSecond;
        this.interval = 1000 / options.requestsPerSecond;
    }
    /**
     * Throttle a function call
     */
    async throttle(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await fn();
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
            });
            if (!this.processing) {
                this.process();
            }
        });
    }
    async process() {
        this.processing = true;
        while (this.queue.length > 0) {
            const fn = this.queue.shift();
            if (fn) {
                await fn();
                await new Promise(resolve => setTimeout(resolve, this.interval));
            }
        }
        this.processing = false;
    }
}
exports.RateLimiter = RateLimiter;
/**
 * Chunk array into smaller arrays
 *
 * @example
 * ```typescript
 * const chunks = chunk([1, 2, 3, 4, 5], 2);
 * // [[1, 2], [3, 4], [5]]
 * ```
 */
function chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
