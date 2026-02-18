/**
 * Request-scoped ID for tracing and debugging.
 * Use x-request-id header if provided, otherwise generate a UUID.
 */

import { AsyncLocalStorage } from 'async_hooks';

const REQUEST_ID_HEADER = 'x-request-id';

const storage = new AsyncLocalStorage<string>();

export interface RequestContext {
  userId?: string;
  organizationId?: number;
}

const contextStorage = new AsyncLocalStorage<RequestContext>();

export function generateRequestId(): string {
  return crypto.randomUUID();
}

export function getRequestId(): string {
  const id = storage.getStore();
  return id ?? generateRequestId();
}

export function extractOrGenerateRequestId(req: Request): string {
  const header = req.headers.get(REQUEST_ID_HEADER);
  if (header && header.trim()) return header.trim();
  return generateRequestId();
}

export function setRequestContext(ctx: RequestContext): void {
  const current = contextStorage.getStore();
  contextStorage.enterWith({ ...current, ...ctx });
}

export function getRequestContext(): RequestContext | undefined {
  return contextStorage.getStore();
}

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return storage.run(requestId, fn);
}

export async function runWithRequestIdAsync<T>(requestId: string, fn: () => Promise<T>): Promise<T> {
  return storage.run(requestId, fn);
}
