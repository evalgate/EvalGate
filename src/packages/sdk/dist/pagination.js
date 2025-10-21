"use strict";
/**
 * Cursor-based pagination utilities for efficient data fetching
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginatedIterator = void 0;
exports.createPaginatedIterator = createPaginatedIterator;
exports.autoPaginate = autoPaginate;
exports.encodeCursor = encodeCursor;
exports.decodeCursor = decodeCursor;
exports.createPaginationMeta = createPaginationMeta;
exports.parsePaginationParams = parsePaginationParams;
/**
 * Iterator for paginated results
 * Allows for easy iteration over all pages
 */
class PaginatedIterator {
    constructor(fetchFn, limit = 50) {
        this.fetchFn = fetchFn;
        this.limit = limit;
        this.currentOffset = 0;
        this.hasMore = true;
    }
    async next() {
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
    [Symbol.asyncIterator]() {
        return this;
    }
    /**
     * Collect all pages into a single array
     * Warning: Use with caution on large datasets
     */
    async toArray() {
        const allItems = [];
        for await (const page of this) {
            allItems.push(...page);
        }
        return allItems;
    }
}
exports.PaginatedIterator = PaginatedIterator;
/**
 * Helper to create paginated iterator
 */
function createPaginatedIterator(fetchFn, limit = 50) {
    return new PaginatedIterator(fetchFn, limit);
}
/**
 * Auto-paginate helper that fetches all pages automatically
 */
async function* autoPaginate(fetchFn, limit = 50) {
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
function encodeCursor(data) {
    const json = JSON.stringify(data);
    if (typeof globalThis !== 'undefined' && 'btoa' in globalThis) {
        return globalThis.btoa(json);
    }
    else {
        return Buffer.from(json).toString('base64');
    }
}
/**
 * Decode cursor from base64
 */
function decodeCursor(cursor) {
    try {
        let json;
        if (typeof globalThis !== 'undefined' && 'atob' in globalThis) {
            json = globalThis.atob(cursor);
        }
        else {
            json = Buffer.from(cursor, 'base64').toString('utf-8');
        }
        return JSON.parse(json);
    }
    catch (error) {
        throw new Error('Invalid cursor format');
    }
}
/**
 * Create pagination metadata from response
 */
function createPaginationMeta(items, limit, offset, total) {
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
function parsePaginationParams(params) {
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
