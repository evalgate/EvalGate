/**
 * Context Propagation System
 * Tier 2.9: Automatic metadata injection
 *
 * NOTE: In Node.js, uses AsyncLocalStorage for true async context propagation.
 * In browsers, uses a simpler stack-based approach (not safe across async boundaries).
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
/**
 * Context metadata that will be automatically injected
 */
export interface ContextMetadata {
    [key: string]: any;
}
/**
 * Context manager for automatic metadata propagation
 */
export declare class EvalContext {
    private metadata;
    constructor(metadata: ContextMetadata);
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
    run<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Run a synchronous function with this context
     */
    runSync<T>(fn: () => T): T;
    /**
     * Get the current context metadata
     */
    getMetadata(): ContextMetadata;
    /**
     * Merge additional metadata into context
     */
    with(additionalMetadata: ContextMetadata): EvalContext;
}
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
export declare function createContext(metadata: ContextMetadata): EvalContext;
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
export declare function getCurrentContext(): ContextMetadata | undefined;
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
export declare function mergeWithContext(metadata?: Record<string, any>): Record<string, any>;
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
export declare function withContext<T>(metadata: ContextMetadata, fn: () => Promise<T>): Promise<T>;
/**
 * Run with nested context (synchronous)
 */
export declare function withContextSync<T>(metadata: ContextMetadata, fn: () => T): T;
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
export declare function WithContext(metadata: ContextMetadata): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
