"use strict";
/**
 * Simple in-memory cache with TTL for SDK requests
 * Reduces redundant API calls and improves performance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheTTL = exports.RequestCache = void 0;
exports.shouldCache = shouldCache;
exports.getTTL = getTTL;
class RequestCache {
    constructor(maxSize = 1000) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }
    /**
     * Generate cache key from request parameters
     */
    generateKey(method, url, params) {
        const paramString = params ? JSON.stringify(params) : '';
        return `${method}:${url}:${paramString}`;
    }
    /**
     * Check if cache entry is still valid
     */
    isValid(entry) {
        return Date.now() - entry.timestamp < entry.ttl;
    }
    /**
     * Get cached response if valid
     */
    get(method, url, params) {
        const key = this.generateKey(method, url, params);
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        if (!this.isValid(entry)) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    /**
     * Store response in cache
     */
    set(method, url, data, ttl, params) {
        // Enforce cache size limit (LRU-style)
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }
        const key = this.generateKey(method, url, params);
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });
    }
    /**
     * Invalidate specific cache entry
     */
    invalidate(method, url, params) {
        const key = this.generateKey(method, url, params);
        this.cache.delete(key);
    }
    /**
     * Invalidate all cache entries matching a pattern
     */
    invalidatePattern(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
        };
    }
}
exports.RequestCache = RequestCache;
/**
 * Default cache TTL values (in milliseconds)
 * @internal - Used by SDK internally, exposed for advanced customization only
 */
exports.CacheTTL = {
    SHORT: 30 * 1000,
    MEDIUM: 5 * 60 * 1000,
    LONG: 30 * 60 * 1000,
    HOUR: 60 * 60 * 1000,
};
/**
 * @internal - Internal SDK logic, not part of public API
 * Determine if a request should be cached based on method and endpoint
 */
function shouldCache(method, endpoint) {
    if (method !== 'GET') {
        return false;
    }
    const noCacheEndpoints = [
        '/health',
        '/usage',
        '/deliveries',
    ];
    return !noCacheEndpoints.some(pattern => endpoint.includes(pattern));
}
/**
 * @internal - Internal SDK logic, not part of public API
 * Get appropriate TTL for an endpoint
 */
function getTTL(endpoint) {
    if (endpoint.includes('/api-keys') || endpoint.includes('/webhooks')) {
        return exports.CacheTTL.LONG;
    }
    if (endpoint.includes('/evaluations') || endpoint.includes('/configs')) {
        return exports.CacheTTL.MEDIUM;
    }
    if (endpoint.includes('/traces') || endpoint.includes('/results')) {
        return exports.CacheTTL.SHORT;
    }
    return exports.CacheTTL.MEDIUM;
}
