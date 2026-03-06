"use strict";
/**
 * Enhanced SDK Error system with documentation links
 * Tier 1.5: Rich Error Messages
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDKError = exports.NetworkError = exports.ValidationError = exports.AuthenticationError = exports.RateLimitError = exports.EvalGateError = void 0;
exports.createErrorFromResponse = createErrorFromResponse;
/**
 * Comprehensive error documentation
 */
const ERROR_DOCS = {
    MISSING_API_KEY: {
        code: "MISSING_API_KEY",
        message: "API key is required to initialize the SDK",
        documentation: "https://docs.evalgate.com/errors/missing-api-key",
        solutions: [
            "Set EVALGATE_API_KEY environment variable",
            'Pass apiKey in config: new AIEvalClient({ apiKey: "..." })',
            "Get your API key from https://app.evalgate.com/settings/api-keys",
        ],
        retryable: false,
    },
    MISSING_ORGANIZATION_ID: {
        code: "MISSING_ORGANIZATION_ID",
        message: "Organization ID is required for this operation",
        documentation: "https://docs.evalgate.com/errors/missing-org-id",
        solutions: [
            "Set EVALGATE_ORGANIZATION_ID environment variable",
            "Pass organizationId in config: new AIEvalClient({ organizationId: 123 })",
            "Pass organizationId in method params",
        ],
        retryable: false,
    },
    RATE_LIMIT_EXCEEDED: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Rate limit exceeded",
        documentation: "https://docs.evalgate.com/errors/rate-limit",
        solutions: [
            "Wait before retrying (check retryAfter property)",
            "Upgrade your plan for higher rate limits",
            "Implement exponential backoff in your application",
        ],
        retryable: true,
    },
    TIMEOUT: {
        code: "TIMEOUT",
        message: "Request timed out",
        documentation: "https://docs.evalgate.com/errors/timeout",
        solutions: [
            "Increase timeout: new AIEvalClient({ timeout: 60000 })",
            "Check your network connection",
            "The service may be experiencing high load",
        ],
        retryable: true,
    },
    NETWORK_ERROR: {
        code: "NETWORK_ERROR",
        message: "Network connectivity issue",
        documentation: "https://docs.evalgate.com/errors/network",
        solutions: [
            "Check your internet connection",
            "Verify the baseUrl is correct",
            "Check if you can reach the API endpoint",
        ],
        retryable: true,
    },
    UNAUTHORIZED: {
        code: "UNAUTHORIZED",
        message: "Authentication failed",
        documentation: "https://docs.evalgate.com/errors/unauthorized",
        solutions: [
            "Verify your API key is correct",
            "Check if your API key has expired",
            "Ensure your API key has the required permissions",
        ],
        retryable: false,
    },
    FORBIDDEN: {
        code: "FORBIDDEN",
        message: "Access forbidden",
        documentation: "https://docs.evalgate.com/errors/forbidden",
        solutions: [
            "Check if you have permission for this resource",
            "Verify you're using the correct organization ID",
            "Contact support if you believe this is an error",
        ],
        retryable: false,
    },
    NOT_FOUND: {
        code: "NOT_FOUND",
        message: "Resource not found",
        documentation: "https://docs.evalgate.com/errors/not-found",
        solutions: [
            "Verify the resource ID is correct",
            "Check if the resource was deleted",
            "Ensure you're querying the correct organization",
        ],
        retryable: false,
    },
    VALIDATION_ERROR: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        documentation: "https://docs.evalgate.com/errors/validation",
        solutions: [
            "Check the error details for specific validation failures",
            "Verify all required fields are provided",
            "Ensure field types match the expected format",
        ],
        retryable: false,
    },
    INTERNAL_SERVER_ERROR: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        documentation: "https://docs.evalgate.com/errors/server-error",
        solutions: [
            "Retry the request after a brief delay",
            "Check status page: https://status.evalgate.com",
            "Contact support if the issue persists",
        ],
        retryable: true,
    },
    FEATURE_LIMIT_REACHED: {
        code: "FEATURE_LIMIT_REACHED",
        message: "Feature usage limit reached",
        documentation: "https://docs.evalgate.com/errors/feature-limit",
        solutions: [
            "Upgrade your plan for higher limits",
            "Wait for your usage to reset (check resetAt property)",
            "Optimize your usage patterns",
        ],
        retryable: false,
    },
};
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
class EvalGateError extends Error {
    constructor(message, code, statusCode, details) {
        super(message);
        this.name = "EvalGateError";
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        // Initialize required properties from ERROR_DOCS
        const doc = ERROR_DOCS[code];
        this.documentation =
            doc?.documentation ?? `https://docs.evalgate.com/errors/${code}`;
        this.solutions = doc?.solutions ?? [
            "Check the error details for more information",
        ];
        this.retryable = doc?.retryable ?? false;
        // Extract retry-after for rate limits
        const errorDetails = details;
        if (code === "RATE_LIMIT_EXCEEDED" && errorDetails?.retryAfter) {
            this.retryAfter = errorDetails.retryAfter;
        }
        // Extract reset time for feature limits
        if (code === "FEATURE_LIMIT_REACHED" && errorDetails?.resetAt) {
            this.resetAt = new Date(errorDetails.resetAt);
        }
        this.requestId =
            errorDetails?.error?.requestId ?? errorDetails?.requestId;
        // Ensure proper prototype chain
        Object.setPrototypeOf(this, EvalGateError.prototype);
    }
    /**
     * Get formatted error message with solutions
     */
    getDetailedMessage() {
        let msg = `${this.code}: ${this.message}\n\n`;
        msg += `Documentation: ${this.documentation}\n\n`;
        msg += "Suggested solutions:\n";
        this.solutions.forEach((solution, i) => {
            msg += `  ${i + 1}. ${solution}\n`;
        });
        if (this.retryAfter) {
            msg += `\nRetry after: ${this.retryAfter} seconds`;
        }
        if (this.resetAt) {
            msg += `\nLimit resets at: ${this.resetAt.toISOString()}`;
        }
        return msg;
    }
    /**
     * Check if this error should be retried
     */
    shouldRetry() {
        return this.retryable;
    }
    /**
     * Convert to JSON for logging
     */
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            statusCode: this.statusCode,
            documentation: this.documentation,
            solutions: this.solutions,
            retryable: this.retryable,
            retryAfter: this.retryAfter,
            resetAt: this.resetAt,
            requestId: this.requestId,
            details: this.details,
        };
    }
}
exports.EvalGateError = EvalGateError;
exports.SDKError = EvalGateError;
/**
 * Create an error from an HTTP response
 */
function createErrorFromResponse(response, data) {
    const status = response.status;
    const errorData = data;
    const errObj = errorData?.error && typeof errorData.error === "object"
        ? errorData.error
        : errorData;
    let code = errObj?.code ?? errorData?.code ?? "UNKNOWN_ERROR";
    const message = typeof errorData?.error === "string"
        ? errorData.error
        : (errObj?.message ?? errorData?.message ?? response.statusText);
    const requestId = errObj?.requestId ??
        errorData?.requestId ??
        response.headers.get("x-request-id") ??
        undefined;
    // Map HTTP status to error codes when code not in response
    if (!errObj?.code && !errorData?.code) {
        if (status === 401)
            code = "UNAUTHORIZED";
        else if (status === 403)
            code = "FORBIDDEN";
        else if (status === 404)
            code = "NOT_FOUND";
        else if (status === 408)
            code = "TIMEOUT";
        else if (status === 422)
            code = "VALIDATION_ERROR";
        else if (status === 429)
            code = "RATE_LIMIT_EXCEEDED";
        else if (status >= 500)
            code = "INTERNAL_SERVER_ERROR";
    }
    const err = new EvalGateError(message, code, status, data);
    if (requestId)
        err.requestId = requestId;
    return err;
}
// Specific error types
class RateLimitError extends EvalGateError {
    constructor(message, retryAfter) {
        super(message, "RATE_LIMIT_EXCEEDED", 429, { retryAfter });
        this.name = "RateLimitError";
        if (retryAfter !== undefined) {
            this.retryAfter = retryAfter;
        }
        Object.setPrototypeOf(this, RateLimitError.prototype);
    }
}
exports.RateLimitError = RateLimitError;
class AuthenticationError extends EvalGateError {
    constructor(message = "Authentication failed") {
        super(message, "AUTHENTICATION_ERROR", 401);
        this.name = "AuthenticationError";
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}
exports.AuthenticationError = AuthenticationError;
class ValidationError extends EvalGateError {
    constructor(message = "Validation failed", details) {
        super(message, "VALIDATION_ERROR", 400, details);
        this.name = "ValidationError";
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
exports.ValidationError = ValidationError;
class NetworkError extends EvalGateError {
    constructor(message = "Network request failed") {
        super(message, "NETWORK_ERROR", 0);
        this.name = "NetworkError";
        this.retryable = true;
        Object.setPrototypeOf(this, NetworkError.prototype);
    }
}
exports.NetworkError = NetworkError;
