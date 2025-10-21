/**
 * Cursor-based pagination utilities for efficient data fetching
 */

export interface PaginationParams {
  limit?: number;
  cursor?: string;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    prevCursor?: string;
    total?: number;
    limit: number;
    offset?: number;
  };
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Iterator for paginated results
 * Allows for easy iteration over all pages
 */
export class PaginatedIterator<T> implements AsyncIterableIterator<T[]> {
  private currentOffset: number = 0;
  private hasMore: boolean = true;

  constructor(
    private fetchFn: (offset: number, limit: number) => Promise<{ data: T[]; hasMore: boolean }>,
    private limit: number = 50
  ) {}

  async next(): Promise<IteratorResult<T[]>> {
    if (!this.hasMore) {
      return { done: true, value: undefined };
    }

    const result = await this.fetchFn(this.currentOffset, this.limit);
    this.hasMore = result.hasMore;
    this.currentOffset += this.limit;

    return {
      done: false,
      value: result.data,
    };
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<T[]> {
    return this;
  }

  /**
   * Collect all pages into a single array
   * Warning: Use with caution on large datasets
   */
  async toArray(): Promise<T[]> {
    const allItems: T[] = [];
    
    for await (const page of this) {
      allItems.push(...page);
    }

    return allItems;
  }
}

/**
 * Helper to create paginated iterator
 */
export function createPaginatedIterator<T>(
  fetchFn: (offset: number, limit: number) => Promise<{ data: T[]; hasMore: boolean }>,
  limit: number = 50
): PaginatedIterator<T> {
  return new PaginatedIterator(fetchFn, limit);
}

/**
 * Auto-paginate helper that fetches all pages automatically
 */
export async function* autoPaginate<T>(
  fetchFn: (offset: number, limit: number) => Promise<T[]>,
  limit: number = 50
): AsyncGenerator<T, void, unknown> {
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const items = await fetchFn(offset, limit);
    
    if (items.length === 0) {
      break;
    }

    for (const item of items) {
      yield item;
    }

    hasMore = items.length === limit;
    offset += limit;
  }
}

/**
 * Encode cursor for pagination (base64)
 */
export function encodeCursor(data: any): string {
  const json = JSON.stringify(data);
  
  if (typeof globalThis !== 'undefined' && 'btoa' in globalThis) {
    return (globalThis as any).btoa(json);
  } else {
    return Buffer.from(json).toString('base64');
  }
}

/**
 * Decode cursor from base64
 */
export function decodeCursor(cursor: string): any {
  try {
    let json: string;
    
    if (typeof globalThis !== 'undefined' && 'atob' in globalThis) {
      json = (globalThis as any).atob(cursor);
    } else {
      json = Buffer.from(cursor, 'base64').toString('utf-8');
    }
    
    return JSON.parse(json);
  } catch (error) {
    throw new Error('Invalid cursor format');
  }
}

/**
 * Create pagination metadata from response
 */
export function createPaginationMeta<T>(
  items: T[],
  limit: number,
  offset: number,
  total?: number
): PaginatedResponse<T>['pagination'] {
  const hasMore = items.length === limit;
  
  return {
    hasMore,
    limit,
    offset,
    total,
    nextCursor: hasMore ? encodeCursor({ offset: offset + limit, limit }) : undefined,
    prevCursor: offset > 0 ? encodeCursor({ offset: Math.max(0, offset - limit), limit }) : undefined,
  };
}

/**
 * Parse pagination params from cursor or offset
 */
export function parsePaginationParams(params: PaginationParams): { limit: number; offset: number } {
  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    return {
      limit: decoded.limit || 50,
      offset: decoded.offset || 0,
    };
  }

  return {
    limit: params.limit || 50,
    offset: params.offset || 0,
  };
}

