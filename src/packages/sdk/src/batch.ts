/**
 * Request batching for improved performance
 * Combines multiple API requests into fewer network calls
 */

export interface BatchRequest {
  id: string;
  method: string;
  endpoint: string;
  body?: any;
  headers?: Record<string, string>;
}

export interface BatchResponse {
  id: string;
  status: number;
  data?: any;
  error?: string;
}

interface PendingRequest {
  id: string;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  request: BatchRequest;
}

/**
 * Batch processor for API requests
 */
export class RequestBatcher {
  private queue: PendingRequest[] = [];
  private batchTimer: NodeJS.Timeout | number | null = null;
  private readonly maxBatchSize: number;
  private readonly batchDelay: number;
  private requestCounter: number = 0;

  constructor(
    private executeBatch: (requests: BatchRequest[]) => Promise<BatchResponse[]>,
    options: {
      maxBatchSize?: number;
      batchDelay?: number;
    } = {}
  ) {
    this.maxBatchSize = options.maxBatchSize || 10;
    this.batchDelay = options.batchDelay || 50; // 50ms
  }

  /**
   * Add request to batch queue
   */
  async enqueue(
    method: string,
    endpoint: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `req_${this.requestCounter++}_${Date.now()}`;
      
      this.queue.push({
        id,
        resolve,
        reject,
        request: { id, method, endpoint, body, headers },
      });

      // Process immediately if batch is full
      if (this.queue.length >= this.maxBatchSize) {
        this.processBatch();
      } else {
        // Otherwise schedule batch processing
        this.scheduleBatch();
      }
    });
  }

  /**
   * Schedule batch processing after delay
   */
  private scheduleBatch(): void {
    if (this.batchTimer) {
      return;
    }

    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.batchDelay);
  }

  /**
   * Process current batch
   */
  private async processBatch(): Promise<void> {
    if (this.batchTimer) {
      if (typeof this.batchTimer === 'number') {
        clearTimeout(this.batchTimer);
      } else {
        clearTimeout(this.batchTimer as NodeJS.Timeout);
      }
      this.batchTimer = null;
    }

    if (this.queue.length === 0) {
      return;
    }

    // Take items from queue
    const batch = this.queue.splice(0, this.maxBatchSize);
    const requests = batch.map(item => item.request);

    try {
      const responses = await this.executeBatch(requests);
      
      // Match responses to requests and resolve/reject
      for (const response of responses) {
        const pendingRequest = batch.find(item => item.id === response.id);
        
        if (pendingRequest) {
          if (response.status >= 200 && response.status < 300) {
            pendingRequest.resolve(response.data);
          } else {
            pendingRequest.reject(new Error(response.error || `Request failed with status ${response.status}`));
          }
        }
      }

      // Handle any requests that didn't get a response
      for (const item of batch) {
        if (!responses.find(r => r.id === item.id)) {
          item.reject(new Error('No response received for request'));
        }
      }
    } catch (error) {
      // Reject all requests in batch on error
      for (const item of batch) {
        item.reject(error);
      }
    }

    // If there are more items in queue, schedule next batch
    if (this.queue.length > 0) {
      this.scheduleBatch();
    }
  }

  /**
   * Flush all pending requests immediately
   */
  async flush(): Promise<void> {
    while (this.queue.length > 0) {
      await this.processBatch();
    }
  }

  /**
   * Clear queue without processing
   */
  clear(): void {
    if (this.batchTimer) {
      if (typeof this.batchTimer === 'number') {
        clearTimeout(this.batchTimer);
      } else {
        clearTimeout(this.batchTimer as NodeJS.Timeout);
      }
      this.batchTimer = null;
    }

    // Reject all pending requests
    for (const item of this.queue) {
      item.reject(new Error('Batch queue cleared'));
    }

    this.queue = [];
  }

  /**
   * Get queue statistics
   */
  getStats(): { queueSize: number; maxBatchSize: number } {
    return {
      queueSize: this.queue.length,
      maxBatchSize: this.maxBatchSize,
    };
  }
}

/**
 * @internal - Internal SDK logic, not part of public API
 * Check if requests can be batched together
 */
export function canBatch(method: string, endpoint: string): boolean {
  if (method !== 'GET') {
    return false;
  }

  const batchableEndpoints = [
    '/traces',
    '/evaluations',
    '/annotations',
    '/results',
  ];

  return batchableEndpoints.some(pattern => endpoint.includes(pattern));
}

/**
 * Batch multiple async operations with concurrency limit
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = processor(item).then(result => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

