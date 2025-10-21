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
/**
 * Batch processor for API requests
 */
export declare class RequestBatcher {
    private executeBatch;
    private queue;
    private batchTimer;
    private readonly maxBatchSize;
    private readonly batchDelay;
    private requestCounter;
    constructor(executeBatch: (requests: BatchRequest[]) => Promise<BatchResponse[]>, options?: {
        maxBatchSize?: number;
        batchDelay?: number;
    });
    /**
     * Add request to batch queue
     */
    enqueue(method: string, endpoint: string, body?: any, headers?: Record<string, string>): Promise<any>;
    /**
     * Schedule batch processing after delay
     */
    private scheduleBatch;
    /**
     * Process current batch
     */
    private processBatch;
    /**
     * Flush all pending requests immediately
     */
    flush(): Promise<void>;
    /**
     * Clear queue without processing
     */
    clear(): void;
    /**
     * Get queue statistics
     */
    getStats(): {
        queueSize: number;
        maxBatchSize: number;
    };
}
/**
 * @internal - Internal SDK logic, not part of public API
 * Check if requests can be batched together
 */
export declare function canBatch(method: string, endpoint: string): boolean;
/**
 * Batch multiple async operations with concurrency limit
 */
export declare function batchProcess<T, R>(items: T[], processor: (item: T) => Promise<R>, concurrency?: number): Promise<R[]>;
