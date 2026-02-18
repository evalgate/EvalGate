/**
 * Request body parsing with Zod validation.
 * Use for all POST/PUT/PATCH handlers that accept JSON bodies.
 * Returns canonical error envelope on failure.
 */

import type { NextRequest } from 'next/server';
import type { z } from 'zod';
import { validationError, zodValidationError } from '@/lib/api/errors';

export type ParseBodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: ReturnType<typeof validationError> | ReturnType<typeof zodValidationError> };

/**
 * Parse and validate request body against a Zod schema.
 * On JSON parse error: returns VALIDATION_ERROR ('Invalid JSON body').
 * On schema validation failure: returns zodValidationError (canonical envelope).
 */
export async function parseBody<T>(
  req: NextRequest,
  schema: z.ZodSchema<T>,
  options?: { allowEmpty?: boolean },
): Promise<ParseBodyResult<T>> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    if (options?.allowEmpty) {
      data = {};
    } else {
      return { ok: false, response: validationError('Invalid JSON body') };
    }
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    return { ok: false, response: zodValidationError(result.error) };
  }

  return { ok: true, data: result.data };
}
