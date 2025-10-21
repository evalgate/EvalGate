/**
 * Simple in-memory cache with TTL for SDK requests
 * Reduces redundant API calls and improves performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class RequestCache {
  private cache: Map<string, CacheEntry<any>>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Generate cache key from request parameters
   */
  private generateKey(method: string, url: string, params?: any): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${method}:${url}:${paramString}`;
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Get cached response if valid
   */
  get<T>(method: string, url: string, params?: any): T | null {
    const key = this.generateKey(method, url, params);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (!this.isValid(entry)) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store response in cache
   */
  set<T>(method: string, url: string, data: T, ttl: number, params?: any): void {
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
  invalidate(method: string, url: string, params?: any): void {
    const key = this.generateKey(method, url, params);
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

/**
 * Default cache TTL values (in milliseconds)
 * @internal - Used by SDK internally, exposed for advanced customization only
 */
export const CacheTTL = {
  SHORT: 30 * 1000,      
  MEDIUM: 5 * 60 * 1000, 
  LONG: 30 * 60 * 1000,  
  HOUR: 60 * 60 * 1000,  
} as const;

/**
 * @internal - Internal SDK logic, not part of public API
 * Determine if a request should be cached based on method and endpoint
 */
export function shouldCache(method: string, endpoint: string): boolean {
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
export function getTTL(endpoint: string): number {
  if (endpoint.includes('/api-keys') || endpoint.includes('/webhooks')) {
    return CacheTTL.LONG;
  }

  if (endpoint.includes('/evaluations') || endpoint.includes('/configs')) {
    return CacheTTL.MEDIUM;
  }

  if (endpoint.includes('/traces') || endpoint.includes('/results')) {
    return CacheTTL.SHORT;
  }

  return CacheTTL.MEDIUM;
}

