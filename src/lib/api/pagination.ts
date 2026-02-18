/**
 * Standard pagination schema for all list endpoints.
 */

import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

/**
 * Parse pagination query params from a URL.
 */
export function parsePagination(searchParams: URLSearchParams): {
  limit: number;
  offset: number;
  page: number;
} {
  const parsed = paginationSchema.parse({
    page: searchParams.get("page") ?? 1,
    limit: searchParams.get("limit") ?? 20,
  });

  return {
    page: parsed.page,
    limit: parsed.limit,
    offset: (parsed.page - 1) * parsed.limit,
  };
}
