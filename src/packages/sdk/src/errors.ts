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
 * Comprehensive error documentation
 */
const ERROR_DOCS: Record<string, ErrorDocumentation> = {
  MISSING_API_KEY: {
    code: 'MISSING_API_KEY',
    message: 'API key is required to initialize the SDK',
    documentation: 'https://docs.ai-eval-platform.com/errors/missing-api-key',
    solutions: [
      'Set EVALAI_API_KEY environment variable',
      'Pass apiKey in config: new AIEvalClient({ apiKey: "..." })',
      'Get your API key from https://platform.ai-eval-platform.com/settings/api-keys'
    ],
    retryable: false
  },
  MISSING_ORGANIZATION_ID: {
    code: 'MISSING_ORGANIZATION_ID',
    message: 'Organization ID is required for this operation',
    documentation: 'https://docs.ai-eval-platform.com/errors/missing-org-id',
    solutions: [
      'Set EVALAI_ORGANIZATION_ID environment variable',
      'Pass organizationId in config: new AIEvalClient({ organizationId: 123 })',
      'Pass organizationId in method params'
    ],
    retryable: false
  },
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Rate limit exceeded',
    documentation: 'https://docs.ai-eval-platform.com/errors/rate-limit',
    solutions: [
      'Wait before retrying (check retryAfter property)',
      'Upgrade your plan for higher rate limits',
      'Implement exponential backoff in your application'
    ],
    retryable: true
  },
  TIMEOUT: {
    code: 'TIMEOUT',
    message: 'Request timed out',
    documentation: 'https://docs.ai-eval-platform.com/errors/timeout',
    solutions: [
      'Increase timeout: new AIEvalClient({ timeout: 60000 })',
      'Check your network connection',
      'The service may be experiencing high load'
    ],
    retryable: true
  },
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message: 'Network connectivity issue',
    documentation: 'https://docs.ai-eval-platform.com/errors/network',
    solutions: [
      'Check your internet connection',
      'Verify the baseUrl is correct',
      'Check if you can reach the API endpoint'
    ],
    retryable: true
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Authentication failed',
    documentation: 'https://docs.ai-eval-platform.com/errors/unauthorized',
    solutions: [
      'Verify your API key is correct',
      'Check if your API key has expired',
      'Ensure your API key has the required permissions'
    ],
    retryable: false
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    message: 'Access forbidden',
    documentation: 'https://docs.ai-eval-platform.com/errors/forbidden',
    solutions: [
      'Check if you have permission for this resource',
      'Verify you\'re using the correct organization ID',
      'Contact support if you believe this is an error'
    ],
    retryable: false
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    message: 'Resource not found',
    documentation: 'https://docs.ai-eval-platform.com/errors/not-found',
    solutions: [
      'Verify the resource ID is correct',
      'Check if the resource was deleted',
      'Ensure you\'re querying the correct organization'
    ],
    retryable: false
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    documentation: 'https://docs.ai-eval-platform.com/errors/validation',
    solutions: [
      'Check the error details for specific validation failures',
      'Verify all required fields are provided',
      'Ensure field types match the expected format'
    ],
    retryable: false
  },
  INTERNAL_SERVER_ERROR: {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
    documentation: 'https://docs.ai-eval-platform.com/errors/server-error',
    solutions: [
      'Retry the request after a brief delay',
      'Check status page: https://status.ai-eval-platform.com',
      'Contact support if the issue persists'
    ],
    retryable: true
  },
  FEATURE_LIMIT_REACHED: {
    code: 'FEATURE_LIMIT_REACHED',
    message: 'Feature usage limit reached',
    documentation: 'https://docs.ai-eval-platform.com/errors/feature-limit',
    solutions: [
      'Upgrade your plan for higher limits',
      'Wait for your usage to reset (check resetAt property)',
      'Optimize your usage patterns'
    ],
    retryable: false
  }
};

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
export class EvalAIError extends Error {
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

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: any
  ) {
    super(message);
    this.name = 'EvalAIError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Get documentation and solutions
    const errorDoc = ERROR_DOCS[code];
    if (errorDoc) {
      this.documentation = errorDoc.documentation;
      this.solutions = errorDoc.solutions;
      this.retryable = errorDoc.retryable;
    } else {
      this.documentation = 'https://docs.ai-eval-platform.com/errors';
      this.solutions = ['Check the API documentation for more information'];
      this.retryable = false;
    }

    // Extract retry-after for rate limits
    if (code === 'RATE_LIMIT_EXCEEDED' && details?.retryAfter) {
      this.retryAfter = details.retryAfter;
    }

    // Extract reset time for feature limits
    if (code === 'FEATURE_LIMIT_REACHED' && details?.resetAt) {
      this.resetAt = new Date(details.resetAt);
    }

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, EvalAIError.prototype);
  }

  /**
   * Get formatted error message with solutions
   */
  getDetailedMessage(): string {
    let msg = `${this.code}: ${this.message}\n\n`;
    msg += `Documentation: ${this.documentation}\n\n`;
    msg += 'Suggested solutions:\n';
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
  shouldRetry(): boolean {
    return this.retryable;
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, any> {
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
      details: this.details
    };
  }
}

/**
 * Create an error from an HTTP response
 */
export function createErrorFromResponse(
  response: Response,
  data: any
): EvalAIError {
  const status = response.status;
  let code = data?.code || 'UNKNOWN_ERROR';
  let message = data?.error || data?.message || response.statusText;

  // Map HTTP status to error codes
  if (!data?.code) {
    if (status === 401) code = 'UNAUTHORIZED';
    else if (status === 403) code = 'FORBIDDEN';
    else if (status === 404) code = 'NOT_FOUND';
    else if (status === 408) code = 'TIMEOUT';
    else if (status === 422) code = 'VALIDATION_ERROR';
    else if (status === 429) code = 'RATE_LIMIT_EXCEEDED';
    else if (status >= 500) code = 'INTERNAL_SERVER_ERROR';
  }

  return new EvalAIError(message, code, status, data);
}

// Specific error types
export class RateLimitError extends EvalAIError {
  constructor(message: string, retryAfter?: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends EvalAIError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends EvalAIError {
  constructor(message = 'Validation failed', details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends EvalAIError {
  constructor(message = 'Network request failed') {
    super(message, 'NETWORK_ERROR', 0);
    this.name = 'NetworkError';
    this.retryable = true;
  }
}

// Legacy export for backward compatibility
export { EvalAIError as SDKError };