"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDKError = exports.EvaluationTemplates = void 0;
/**
 * Evaluation template categories
 * Updated with new template types for comprehensive LLM testing
 */
exports.EvaluationTemplates = {
    // Core Testing
    UNIT_TESTING: 'unit-testing',
    OUTPUT_QUALITY: 'output-quality',
    // Advanced Evaluation
    PROMPT_OPTIMIZATION: 'prompt-optimization',
    CHAIN_OF_THOUGHT: 'chain-of-thought',
    LONG_CONTEXT_TESTING: 'long-context-testing',
    MODEL_STEERING: 'model-steering',
    REGRESSION_TESTING: 'regression-testing',
    CONFIDENCE_CALIBRATION: 'confidence-calibration',
    // Safety & Compliance
    SAFETY_COMPLIANCE: 'safety-compliance',
    // Domain-Specific
    RAG_EVALUATION: 'rag-evaluation',
    CODE_GENERATION: 'code-generation',
    SUMMARIZATION: 'summarization',
};
/**
 * SDK Error class with additional error details
 *
 * Common error codes:
 * - MISSING_API_KEY: API key not provided
 * - MISSING_ORGANIZATION_ID: Organization ID not provided
 * - MISSING_REQUIRED_FIELDS: Required parameters missing
 * - INVALID_ID: Invalid ID format
 * - NOT_FOUND: Resource not found
 * - UNAUTHORIZED: Authentication required
 * - FORBIDDEN: Access forbidden
 * - RATE_LIMIT_EXCEEDED: Rate limit exceeded
 * - TIMEOUT: Request timed out
 * - NETWORK_ERROR: Network connectivity issue
 * - VALIDATION_ERROR: Request validation failed
 * - INTERNAL_SERVER_ERROR: Server error
 * - FEATURE_LIMIT_REACHED: Feature usage limit reached
 * - UNKNOWN_ERROR: Unknown error occurred
 */
class SDKError extends Error {
    constructor(message, code, statusCode, details) {
        super(message);
        this.name = 'SDKError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
}
exports.SDKError = SDKError;
