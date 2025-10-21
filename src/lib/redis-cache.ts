/**
 * Redis Caching Layer
 * Provides caching for database queries and API responses
 */

import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

// Lazy Redis client initialization
let redis: Redis | undefined = undefined;

function getRedis(): Redis {
  if (!redis) {
    try {
      redis = Redis.fromEnv();
    } catch (error) {
      logger.warn('Redis initialization failed, caching will be disabled', { error });
      // Return a mock Redis client that does nothing
      redis = {
        get: async () => null,
        setex: async () => 'OK',
        del: async () => 0,
        keys: async () => [],
      } as any as Redis;
    }
  }
  return redis!;
}

export interface CacheOptions {
  /** TTL in seconds */
  ttl?: number;
  /** Cache key prefix */
  prefix?: string;
  /** Skip cache and force fresh data */
  skipCache?: boolean;
}

export class RedisCache {
  private defaultTTL = 300; // 5 minutes

  /**
   * Get value from cache
   */
  async get<T>(key: string, prefix = 'cache'): Promise<T | null> {
    const fullKey = `${prefix}:${key}`;
    
    try {
      const value = await getRedis().get(fullKey);
      
      if (value !== null) {
        logger.debug('Cache hit', { key: fullKey });
        return value as T;
      }
      
      logger.debug('Cache miss', { key: fullKey });
      return null;
    } catch (error: any) {
      logger.error('Cache get error', { key: fullKey, error: error.message });
      return null; // Fail gracefully
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttl?: number, prefix = 'cache'): Promise<boolean> {
    const fullKey = `${prefix}:${key}`;
    const cacheTTL = ttl || this.defaultTTL;

    try {
      await getRedis().setex(fullKey, cacheTTL, JSON.stringify(value));
      logger.debug('Cache set', { key: fullKey, ttl: cacheTTL });
      return true;
    } catch (error: any) {
      logger.error('Cache set error', { key: fullKey, error: error.message });
      return false; // Fail gracefully
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, prefix = 'cache'): Promise<boolean> {
    const fullKey = `${prefix}:${key}`;

    try {
      await getRedis().del(fullKey);
      logger.debug('Cache deleted', { key: fullKey });
      return true;
    } catch (error: any) {
      logger.error('Cache delete error', { key: fullKey, error: error.message });
      return false;
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string, prefix = 'cache'): Promise<number> {
    const fullPattern = `${prefix}:${pattern}`;

    try {
      const keys = await getRedis().keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      await getRedis().del(...keys);
      logger.debug('Cache pattern deleted', { pattern: fullPattern, count: keys.length });
      return keys.length;
    } catch (error: any) {
      logger.error('Cache delete pattern error', { pattern: fullPattern, error: error.message });
      return 0;
    }
  }

  /**
   * Wrap a function with caching
   */
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const { ttl, prefix = 'cache', skipCache = false } = options;

    // Skip cache if requested
    if (skipCache) {
      logger.debug('Cache skipped', { key });
      return await fn();
    }

    // Try to get from cache
    const cached = await this.get<T>(key, prefix);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, ttl, prefix);

    return result;
  }

  /**
   * Invalidate cache for an organization
   */
  async invalidateOrganization(organizationId: number): Promise<number> {
    logger.info('Invalidating organization cache', { organizationId });
    return await this.deletePattern(`*:org:${organizationId}:*`);
  }

  /**
   * Invalidate cache for a specific resource type
   */
  async invalidateResource(resource: string, organizationId?: number): Promise<number> {
    if (organizationId) {
      logger.info('Invalidating resource cache for organization', { resource, organizationId });
      return await this.deletePattern(`${resource}:org:${organizationId}:*`);
    }

    logger.info('Invalidating resource cache globally', { resource });
    return await this.deletePattern(`${resource}:*`);
  }

  /**
   * Generate cache key for queries
   */
  generateQueryKey(
    table: string,
    organizationId: number,
    params: Record<string, any>
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}=${JSON.stringify(params[k])}`)
      .join('&');

    return `${table}:org:${organizationId}:${sortedParams}`;
  }

  /**
   * Cache statistics
   */
  async getStats(): Promise<{
    keys: number;
    memoryUsed?: string;
  }> {
    try {
      const keys = await getRedis().keys('cache:*');
      
      return {
        keys: keys.length,
      };
    } catch (error: any) {
      logger.error('Failed to get cache stats', { error: error.message });
      return { keys: 0 };
    }
  }
}

// Export singleton instance
export const cache = new RedisCache();

/**
 * Cache TTL constants (in seconds)
 */
export const CacheTTL = {
  /** 1 minute - for frequently changing data */
  SHORT: 60,
  /** 5 minutes - default */
  MEDIUM: 300,
  /** 15 minutes - for relatively stable data */
  LONG: 900,
  /** 1 hour - for very stable data */
  VERY_LONG: 3600,
  /** 1 day - for static/config data */
  DAY: 86400,
} as const;

