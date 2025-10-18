"use strict";
/**
 * Context Propagation System
 * Tier 2.9: Automatic metadata injection
 *
 * @example
 * ```typescript
 * import { createContext } from '@ai-eval-platform/sdk';
 *
 * const context = createContext({ userId: '123', sessionId: 'abc' });
 *
 * await context.run(async () => {
 *   // All SDK calls inherit the context
 *   await client.traces.create({ name: 'test' });
 *   // ^ Automatically includes userId and sessionId
 * });
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvalContext = void 0;
exports.createContext = createContext;
exports.getCurrentContext = getCurrentContext;
exports.mergeWithContext = mergeWithContext;
exports.withContext = withContext;
exports.withContextSync = withContextSync;
exports.WithContext = WithContext;
const async_hooks_1 = require("async_hooks");
/**
 * Global context storage using AsyncLocalStorage
 */
const contextStorage = new async_hooks_1.AsyncLocalStorage();
/**
 * Context manager for automatic metadata propagation
 */
class EvalContext {
    constructor(metadata) {
        this.metadata = metadata;
    }
    /**
     * Run a function with this context
     *
     * @example
     * ```typescript
     * const context = new EvalContext({ userId: '123' });
     *
     * await context.run(async () => {
     *   // All operations inherit context
     *   await client.traces.create({ name: 'test' });
     * });
     * ```
     */
    async run(fn) {
        return contextStorage.run(this.metadata, fn);
    }
    /**
     * Run a synchronous function with this context
     */
    runSync(fn) {
        return contextStorage.run(this.metadata, fn);
    }
    /**
     * Get the current context metadata
     */
    getMetadata() {
        return { ...this.metadata };
    }
    /**
     * Merge additional metadata into context
     */
    with(additionalMetadata) {
        return new EvalContext({ ...this.metadata, ...additionalMetadata });
    }
}
exports.EvalContext = EvalContext;
/**
 * Create a new context with metadata
 *
 * @example
 * ```typescript
 * const context = createContext({
 *   userId: '123',
 *   sessionId: 'abc',
 *   environment: 'production'
 * });
 *
 * await context.run(async () => {
 *   // All SDK operations inherit context
 * });
 * ```
 */
function createContext(metadata) {
    return new EvalContext(metadata);
}
/**
 * Get the current context metadata (if any)
 *
 * @example
 * ```typescript
 * const metadata = getCurrentContext();
 * if (metadata) {
 *   console.log(metadata.userId);
 * }
 * ```
 */
function getCurrentContext() {
    return contextStorage.getStore();
}
/**
 * Merge current context with additional metadata
 * Returns combined metadata for use in API calls
 *
 * @example
 * ```typescript
 * const params = {
 *   name: 'My Trace',
 *   metadata: mergeWithContext({ custom: 'value' })
 * };
 * ```
 */
function mergeWithContext(metadata) {
    const current = getCurrentContext();
    if (!current)
        return metadata || {};
    return { ...current, ...metadata };
}
/**
 * Run with nested context (merges parent context)
 *
 * @example
 * ```typescript
 * await withContext({ userId: '123' }, async () => {
 *   await withContext({ requestId: 'req-456' }, async () => {
 *     // Has both userId and requestId
 *     const ctx = getCurrentContext();
 *     console.log(ctx); // { userId: '123', requestId: 'req-456' }
 *   });
 * });
 * ```
 */
async function withContext(metadata, fn) {
    const current = getCurrentContext() || {};
    const merged = { ...current, ...metadata };
    return contextStorage.run(merged, fn);
}
/**
 * Run with nested context (synchronous)
 */
function withContextSync(metadata, fn) {
    const current = getCurrentContext() || {};
    const merged = { ...current, ...metadata };
    return contextStorage.run(merged, fn);
}
/**
 * Decorator for automatic context injection (for class methods)
 *
 * @example
 * ```typescript
 * class MyService {
 *   @WithContext({ service: 'MyService' })
 *   async process() {
 *     // Automatically has service context
 *   }
 * }
 * ```
 */
function WithContext(metadata) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            return withContext(metadata, () => originalMethod.apply(this, args));
        };
        return descriptor;
    };
}
