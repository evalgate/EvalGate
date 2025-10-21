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
export declare class PaginatedIterator<T> implements AsyncIterableIterator<T[]> {
    private fetchFn;
    private limit;
    private currentOffset;
    private hasMore;
    constructor(fetchFn: (offset: number, limit: number) => Promise<{
        data: T[];
        hasMore: boolean;
    }>, limit?: number);
    next(): Promise<IteratorResult<T[]>>;
    [Symbol.asyncIterator](): AsyncIterableIterator<T[]>;
    /**
     * Collect all pages into a single array
     * Warning: Use with caution on large datasets
     */
    toArray(): Promise<T[]>;
}
/**
 * Helper to create paginated iterator
 */
export declare function createPaginatedIterator<T>(fetchFn: (offset: number, limit: number) => Promise<{
    data: T[];
    hasMore: boolean;
}>, limit?: number): PaginatedIterator<T>;
/**
 * Auto-paginate helper that fetches all pages automatically
 */
export declare function autoPaginate<T>(fetchFn: (offset: number, limit: number) => Promise<T[]>, limit?: number): AsyncGenerator<T, void, unknown>;
/**
 * Encode cursor for pagination (base64)
 */
export declare function encodeCursor(data: any): string;
/**
 * Decode cursor from base64
 */
export declare function decodeCursor(cursor: string): any;
/**
 * Create pagination metadata from response
 */
export declare function createPaginationMeta<T>(items: T[], limit: number, offset: number, total?: number): PaginatedResponse<T>['pagination'];
/**
 * Parse pagination params from cursor or offset
 */
export declare function parsePaginationParams(params: PaginationParams): {
    limit: number;
    offset: number;
};
