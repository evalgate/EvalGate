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
  failed: Array<{ item: any; error: Error }>;
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
export async function batchProcess<TInput, TOutput>(
  processor: (item: TInput) => Promise<TOutput>,
  items: TInput[],
  options: BatchOptions = {},
): Promise<BatchResult<TOutput>> {
  const {
    batchSize = 100,
    parallel = true,
    delayMs = 0,
    onProgress,
    onError,
    continueOnError = true,
  } = options;

  const result: BatchResult<TOutput> = {
    successful: [],
    failed: [],
    summary: {
      total: items.length,
      successful: 0,
      failed: 0,
    },
  };

  // Split into batches
  const batches: TInput[][] = [];
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
        } catch (error) {
          const batchError: BatchError = {
            batch: batchIndex,
            index: itemIndex,
            error: error instanceof Error ? error : new Error(String(error)),
            item,
          };

          result.failed.push({
            item,
            error: batchError.error,
          });
          result.summary.failed++;

          if (onError) onError(batchError);

          if (!continueOnError) {
            throw error;
          }

          return { success: false, error };
        }
      });

      if (parallel) {
        await Promise.all(batchPromises);
      } else {
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
        totalBatches: batches.length,
      });
    }

    // Delay between batches
    if (delayMs > 0 && batchIndex < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
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
export async function* streamEvaluation<T>(config: {
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
}> {
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
        total: cases.length,
      };
    } catch (error) {
      completed++;

      yield {
        caseId: `case-${index}`,
        case: testCase,
        result: error,
        passed: false,
        completed,
        total: cases.length,
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
export async function batchRead<T>(
  fetcher: (params: { limit: number; offset: number }) => Promise<T[]>,
  options: {
    pageSize?: number;
    maxPages?: number;
    onProgress?: (page: number, items: number) => void;
  } = {},
): Promise<T[]> {
  const { pageSize = 100, maxPages, onProgress } = options;
  const allItems: T[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore && (!maxPages || page < maxPages)) {
    const items = await fetcher({
      limit: pageSize,
      offset: page * pageSize,
    });

    if (items.length === 0) {
      hasMore = false;
    } else {
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
export class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private requestsPerSecond: number;
  private interval: number;

  constructor(options: { requestsPerSecond: number }) {
    this.requestsPerSecond = options.requestsPerSecond;
    this.interval = 1000 / options.requestsPerSecond;
  }

  /**
   * Throttle a function call
   */
  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processing) {
        this.process();
      }
    });
  }

  private async process() {
    this.processing = true;

    while (this.queue.length > 0) {
      const fn = this.queue.shift();
      if (fn) {
        await fn();
        await new Promise((resolve) => setTimeout(resolve, this.interval));
      }
    }

    this.processing = false;
  }
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
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
