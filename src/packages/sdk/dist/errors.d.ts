/**
 * Enhanced SDK Error system with documentation links
 * Tier 1.5: Rich Error Messages
 */
export interface ErrorDocumentation {
    code: string;
    message: string;
    documentation: string;
    solutions: string[];
    retryable: boolean;
}
/**
 * Enhanced SDK Error class with rich error information and documentation
 *
 * @example
 * ```typescript
 * try {
 *   await client.traces.create({ ... });
 * } catch (error) {
 *   if (error instanceof EvalGateError) {
 *     console.log(error.code); // 'RATE_LIMIT_EXCEEDED'
 *     console.log(error.documentation); // Link to docs
 *     console.log(error.solutions); // Array of solutions
 *     console.log(error.retryable); // true/false
 *
 *     if (error.retryAfter) {
 *       console.log(`Retry after ${error.retryAfter} seconds`);
 *     }
 *   }
 * }
 * ```
 */
export declare class EvalGateError extends Error {
    /** Error code for programmatic handling */
    code: string;
    /** HTTP status code */
    statusCode: number;
    /** Link to detailed documentation */
    documentation: string;
    /** Array of suggested solutions */
    solutions: string[];
    /** Whether this error is retryable */
    retryable: boolean;
    /** Additional error details from the API */
    details?: unknown;
    /** When to retry (for rate limit errors) in seconds */
    retryAfter?: number;
    /** When the limit resets (for feature limit errors) */
    resetAt?: Date;
    /** Request ID from API (for correlation/debugging) */
    requestId?: string;
    constructor(message: string, code: string, statusCode: number, details?: unknown);
    /**
     * Get formatted error message with solutions
     */
    getDetailedMessage(): string;
    /**
     * Check if this error should be retried
     */
    shouldRetry(): boolean;
    /**
     * Convert to JSON for logging
     */
    toJSON(): Record<string, unknown>;
}
/**
 * Create an error from an HTTP response
 */
export declare function createErrorFromResponse(response: Response, data: unknown): EvalGateError;
export declare class RateLimitError extends EvalGateError {
    constructor(message: string, retryAfter?: number);
}
export declare class AuthenticationError extends EvalGateError {
    constructor(message?: string);
}
export declare class ValidationError extends EvalGateError {
    constructor(message?: string, details?: unknown);
}
export declare class NetworkError extends EvalGateError {
    constructor(message?: string);
}
export { EvalGateError as SDKError };
