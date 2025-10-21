/**
 * Simple in-memory cache with TTL for SDK requests
 * Reduces redundant API calls and improves performance
 */
export declare class RequestCache {
    private cache;
    private maxSize;
    constructor(maxSize?: number);
    /**
     * Generate cache key from request parameters
     */
    private generateKey;
    /**
     * Check if cache entry is still valid
     */
    private isValid;
    /**
     * Get cached response if valid
     */
    get<T>(method: string, url: string, params?: any): T | null;
    /**
     * Store response in cache
     */
    set<T>(method: string, url: string, data: T, ttl: number, params?: any): void;
    /**
     * Invalidate specific cache entry
     */
    invalidate(method: string, url: string, params?: any): void;
    /**
     * Invalidate all cache entries matching a pattern
     */
    invalidatePattern(pattern: string): void;
    /**
     * Clear all cache entries
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxSize: number;
        hitRate?: number;
    };
}
/**
 * Default cache TTL values (in milliseconds)
 * @internal - Used by SDK internally, exposed for advanced customization only
 */
export declare const CacheTTL: {
    readonly SHORT: number;
    readonly MEDIUM: number;
    readonly LONG: number;
    readonly HOUR: number;
};
/**
 * @internal - Internal SDK logic, not part of public API
 * Determine if a request should be cached based on method and endpoint
 */
export declare function shouldCache(method: string, endpoint: string): boolean;
/**
 * @internal - Internal SDK logic, not part of public API
 * Get appropriate TTL for an endpoint
 */
export declare function getTTL(endpoint: string): number;
