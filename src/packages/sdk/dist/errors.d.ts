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
 *   if (error instanceof EvalAIError) {
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
export declare class EvalAIError extends Error {
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
    details?: any;
    /** When to retry (for rate limit errors) in seconds */
    retryAfter?: number;
    /** When the limit resets (for feature limit errors) */
    resetAt?: Date;
    constructor(message: string, code: string, statusCode: number, details?: any);
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
    toJSON(): Record<string, any>;
}
/**
 * Create an error from an HTTP response
 */
export declare function createErrorFromResponse(response: Response, data: any): EvalAIError;
export declare class RateLimitError extends EvalAIError {
    constructor(message: string, retryAfter?: number);
}
export declare class AuthenticationError extends EvalAIError {
    constructor(message?: string);
}
export declare class ValidationError extends EvalAIError {
    constructor(message?: string, details?: any);
}
export declare class NetworkError extends EvalAIError {
    constructor(message?: string);
}
export { EvalAIError as SDKError };
