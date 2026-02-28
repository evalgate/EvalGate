"use strict";
/**
 * EvalAI Local Executor - Layer 1 Foundation
 *
 * Local execution engine that runs specifications without database coupling.
 * Implements the execution interface for the new programming model.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultLocalExecutor = void 0;
exports.createLocalExecutor = createLocalExecutor;
const types_1 = require("./types");
/**
 * Local executor implementation
 * Runs specifications in the current process without external dependencies
 */
class LocalExecutorImpl {
    constructor() {
        this.type = "local";
        this.capabilities = {
            type: "local",
            parallel: true,
            maxParallel: 4, // Conservative default
            supportedModels: ["*"], // Supports any model via executor function
            costTracking: false, // No built-in cost tracking for local execution
            streaming: false, // No streaming for local execution
        };
    }
    /**
     * Execute a single specification with safe error boundaries
     */
    async executeSpec(spec, input) {
        const startTime = Date.now();
        let classification = "passed";
        try {
            // Create execution context
            const context = {
                input,
                metadata: spec.metadata,
                options: {
                    model: spec.config?.model,
                    budget: spec.config?.budget,
                    timeout: spec.config?.timeout,
                },
            };
            // Execute specification with timeout
            const timeout = spec.config?.timeout || 30000; // 30 second default
            const result = await this.executeWithTimeout(spec.executor, context, timeout);
            // Add execution duration
            result.durationMs = Date.now() - startTime;
            // Determine classification
            classification = result.pass ? "passed" : "failed";
            return {
                ...result,
                classification,
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            let errorEnvelope;
            if (error instanceof Error && error.name === "TimeoutError") {
                classification = "timeout";
                errorEnvelope = {
                    classification: "timeout_error",
                    code: "TIMEOUT",
                    message: `Specification execution timed out after ${duration}ms`,
                    stack: error.stack,
                    testId: spec.id,
                    filePath: spec.filePath,
                    position: spec.position,
                    timestamp: new Date().toISOString(),
                };
            }
            else {
                classification = "error";
                // Create EvalExecutionError wrapper
                const execError = new types_1.EvalExecutionError(error instanceof Error ? error.message : String(error), {
                    testId: spec.id,
                    filePath: spec.filePath,
                    position: spec.position,
                    code: "EXECUTION_ERROR",
                    originalError: error instanceof Error ? error : undefined,
                });
                errorEnvelope = execError.toEnvelope();
            }
            return {
                pass: false,
                score: 0,
                error: error instanceof Error ? error.message : String(error),
                durationMs: duration,
                classification,
                errorEnvelope,
            };
        }
    }
    /**
     * Execute multiple specifications
     */
    async executeSpecs(specs, inputs) {
        if (specs.length !== inputs.length) {
            throw new types_1.SpecExecutionError("Number of specs must match number of inputs", {
                specCount: specs.length,
                inputCount: inputs.length,
            });
        }
        // For now, execute sequentially
        // In Layer 3, we'll add parallel execution with worker pools
        const results = [];
        for (let i = 0; i < specs.length; i++) {
            const result = await this.executeSpec(specs[i], inputs[i]);
            results.push(result);
        }
        return results;
    }
    /**
     * Get executor capabilities
     */
    getCapabilities() {
        return this.capabilities;
    }
    /**
     * Execute with timeout protection
     */
    async executeWithTimeout(fn, context, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                const error = new Error(`Execution timed out after ${timeoutMs}ms`);
                error.name = "TimeoutError";
                reject(error);
            }, timeoutMs);
            fn(context)
                .then((result) => {
                clearTimeout(timer);
                resolve(result);
            })
                .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
}
/**
 * Create a new local executor
 */
function createLocalExecutor() {
    return new LocalExecutorImpl();
}
/**
 * Default local executor instance
 * For convenience in simple use cases
 */
exports.defaultLocalExecutor = createLocalExecutor();
