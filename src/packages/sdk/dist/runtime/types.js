"use strict";
/**
 * EvalAI Runtime Types - Layer 1 Foundation
 *
 * Core types for the evaluation specification programming model.
 * Everything revolves around the Evaluation Specification primitive.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvalExecutionError = exports.RuntimeError = exports.SpecExecutionError = exports.SpecRegistrationError = exports.EvalRuntimeError = void 0;
/**
 * Runtime errors
 */
class EvalRuntimeError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "EvalRuntimeError";
    }
}
exports.EvalRuntimeError = EvalRuntimeError;
class SpecRegistrationError extends EvalRuntimeError {
    constructor(message, details) {
        super(message, "SPEC_REGISTRATION_ERROR", details);
        this.name = "SpecRegistrationError";
    }
}
exports.SpecRegistrationError = SpecRegistrationError;
class SpecExecutionError extends EvalRuntimeError {
    constructor(message, details) {
        super(message, "SPEC_EXECUTION_ERROR", details);
        this.name = "SpecExecutionError";
    }
}
exports.SpecExecutionError = SpecExecutionError;
class RuntimeError extends EvalRuntimeError {
    constructor(message, details) {
        super(message, "RUNTIME_ERROR", details);
        this.name = "RuntimeError";
    }
}
exports.RuntimeError = RuntimeError;
/**
 * EvalExecutionError wrapper for safe error boundaries
 */
class EvalExecutionError extends Error {
    constructor(message, context) {
        super(message);
        this.name = "EvalExecutionError";
        this.code = context.code || "EXECUTION_ERROR";
        this.testId = context.testId;
        this.filePath = context.filePath;
        this.position = context.position;
        this.originalError = context.originalError;
        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, EvalExecutionError);
        }
    }
    /**
     * Convert to normalized error envelope for reporting
     */
    toEnvelope() {
        return {
            classification: "execution_error",
            code: this.code,
            message: this.message,
            stack: this.stack,
            testId: this.testId,
            filePath: this.filePath,
            position: this.position,
            timestamp: new Date().toISOString(),
        };
    }
}
exports.EvalExecutionError = EvalExecutionError;
