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

// Detect environment
const isNode = typeof process !== 'undefined' && process.versions?.node;

/**
 * Context storage implementation
 * Uses AsyncLocalStorage in Node.js, simple stack in browsers
 */
let contextStorage: any;

if (isNode) {
  try {
    // Dynamic import for Node.js only
    const { AsyncLocalStorage } = require('async_hooks');
    // Create without type argument due to require() being untyped
    contextStorage = new AsyncLocalStorage();
  } catch (error) {
    // Fallback if async_hooks is not available
    contextStorage = null;
  }
}

// Browser fallback: simple context stack
class BrowserContextStorage {
  private stack: ContextMetadata[] = [];

  run<T>(context: ContextMetadata, fn: () => T): T {
    this.stack.push(context);
    try {
      return fn();
    } finally {
      this.stack.pop();
    }
  }

  getStore(): ContextMetadata | undefined {
    return this.stack[this.stack.length - 1];
  }
}

if (!contextStorage) {
  contextStorage = new BrowserContextStorage();
}

/**
 * Context manager for automatic metadata propagation
 */
export class EvalContext {
  constructor(private metadata: ContextMetadata) {}

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
  async run<T>(fn: () => Promise<T>): Promise<T> {
    return contextStorage.run(this.metadata, fn);
  }

  /**
   * Run a synchronous function with this context
   */
  runSync<T>(fn: () => T): T {
    return contextStorage.run(this.metadata, fn);
  }

  /**
   * Get the current context metadata
   */
  getMetadata(): ContextMetadata {
    return { ...this.metadata };
  }

  /**
   * Merge additional metadata into context
   */
  with(additionalMetadata: ContextMetadata): EvalContext {
    return new EvalContext({ ...this.metadata, ...additionalMetadata });
  }
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
export function createContext(metadata: ContextMetadata): EvalContext {
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
export function getCurrentContext(): ContextMetadata | undefined {
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
export function mergeWithContext(metadata?: Record<string, any>): Record<string, any> {
  const current = getCurrentContext();
  if (!current) return metadata || {};
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
export async function withContext<T>(
  metadata: ContextMetadata,
  fn: () => Promise<T>
): Promise<T> {
  const current = getCurrentContext() || {};
  const merged = { ...current, ...metadata };
  return contextStorage.run(merged, fn);
}

/**
 * Run with nested context (synchronous)
 */
export function withContextSync<T>(
  metadata: ContextMetadata,
  fn: () => T
): T {
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
export function WithContext(metadata: ContextMetadata) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return withContext(metadata, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}