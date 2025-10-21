/**
 * Database Query Optimization Utilities
 * Provides helpers for pagination, N+1 prevention, and query optimization
 */

import { logger } from '@/lib/logger';
import { cache, CacheTTL } from '@/lib/redis-cache';

export interface PaginationParams {
  limit?: number;
  offset?: number;
  page?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface CursorPaginationParams {
  limit?: number;
  cursor?: string;
}

export interface CursorPaginatedResult<T> {
  data: T[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}

/**
 * Normalize pagination parameters
 */
export function normalizePagination(params: PaginationParams): {
  limit: number;
  offset: number;
} {
  const limit = Math.min(params.limit || 50, 100); // Max 100 items
  const page = params.page || 1;
  const offset = params.offset !== undefined ? params.offset : (page - 1) * limit;

  return { limit, offset };
}

/**
 * Build paginated result
 */
export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  const { limit, offset } = normalizePagination(params);
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      total,
      limit,
      offset,
      page,
      totalPages,
      hasMore: offset + data.length < total,
    },
  };
}

/**
 * Encode cursor for cursor-based pagination
 */
export function encodeCursor(data: any): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

/**
 * Decode cursor for cursor-based pagination
 */
export function decodeCursor(cursor: string): any {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  } catch (error) {
    throw new Error('Invalid cursor');
  }
}

/**
 * Build cursor-paginated result
 */
export function buildCursorPaginatedResult<T>(
  data: T[],
  limit: number,
  getCursor: (item: T) => any
): CursorPaginatedResult<T> {
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;
  
  const nextCursor = hasMore && items.length > 0
    ? encodeCursor(getCursor(items[items.length - 1]))
    : null;

  return {
    data: items,
    pagination: {
      limit,
      nextCursor,
      hasMore,
    },
  };
}

/**
 * Cached query wrapper with automatic invalidation
 */
export async function cachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  options: {
    ttl?: number;
    organizationId?: number;
    resource?: string;
  } = {}
): Promise<T> {
  const { ttl = CacheTTL.MEDIUM, organizationId, resource } = options;

  // Generate full cache key
  const fullKey = organizationId
    ? `${resource || 'query'}:org:${organizationId}:${cacheKey}`
    : `${resource || 'query'}:${cacheKey}`;

  logger.debug('Cached query', { key: fullKey, ttl });

  return await cache.wrap(fullKey, queryFn, { ttl });
}

/**
 * Batch load related data to prevent N+1 queries
 */
export async function batchLoad<T, K extends keyof T>(
  items: T[],
  foreignKey: K,
  loadFn: (ids: Array<T[K]>) => Promise<Record<string, any>>
): Promise<(T & { _loaded?: any })[]> {
  if (items.length === 0) {
    return [] as (T & { _loaded?: any })[];
  }

  // Extract unique foreign key values
  const ids = [...new Set(items.map(item => item[foreignKey]))];

  logger.debug('Batch loading related data', { count: ids.length });

  // Load all related data in one query
  const relatedData = await loadFn(ids);

  // Attach related data to items
  return items.map(item => ({
    ...item,
    _loaded: relatedData[String(item[foreignKey])],
  }));
}

/**
 * Measure query performance
 */
export async function measureQuery<T>(
  name: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;

    if (duration > 1000) {
      logger.warn('Slow query detected', { name, duration });
    } else {
      logger.debug('Query executed', { name, duration });
    }

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Query failed', { name, duration, error: error.message });
    throw error;
  }
}

/**
 * Invalidate cache for mutations
 */
export async function invalidateCacheForMutation(
  resource: string,
  organizationId: number
): Promise<void> {
  logger.info('Invalidating cache for mutation', { resource, organizationId });
  await cache.invalidateResource(resource, organizationId);
}

/**
 * Query optimizer middleware
 * Tracks and logs slow queries automatically
 */
export class QueryOptimizer {
  private slowQueryThreshold = 1000; // 1 second
  private queryStats: Map<string, { count: number; totalTime: number; maxTime: number }> = new Map();

  async trackQuery<T>(name: string, queryFn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;

      this.recordQuery(name, duration);

      if (duration > this.slowQueryThreshold) {
        logger.warn('Slow query detected', { 
          query: name, 
          duration,
          threshold: this.slowQueryThreshold 
        });
      }

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('Query error', { query: name, duration, error: error.message });
      throw error;
    }
  }

  private recordQuery(name: string, duration: number): void {
    const stats = this.queryStats.get(name) || { count: 0, totalTime: 0, maxTime: 0 };
    
    stats.count++;
    stats.totalTime += duration;
    stats.maxTime = Math.max(stats.maxTime, duration);

    this.queryStats.set(name, stats);
  }

  getStats(): Record<string, { count: number; avgTime: number; maxTime: number }> {
    const result: Record<string, any> = {};

    this.queryStats.forEach((stats, name) => {
      result[name] = {
        count: stats.count,
        avgTime: Math.round(stats.totalTime / stats.count),
        maxTime: stats.maxTime,
      };
    });

    return result;
  }

  resetStats(): void {
    this.queryStats.clear();
  }
}

// Export singleton
export const queryOptimizer = new QueryOptimizer();

