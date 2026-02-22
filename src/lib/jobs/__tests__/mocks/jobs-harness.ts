import { vi } from "vitest";

/**
 * Jobs Test Harness (schema-aligned)
 *
 * Matches Drizzle accessor names for:
 *  - jobs table (camelCase fields) backed by snake_case columns
 *  - jobRunnerLocks table
 *
 * Provides stateful mocks for:
 *  - drizzle-orm operators
 *  - @/db/schema
 *  - @/db (select/insert/update with returning + thenable)
 *  - ../handlers/webhook-delivery (WebhookDeliveryError + handler)
 *  - ../payload-schemas (validatePayload)
 *  - @/lib/logger
 */

export type JobStatus = "pending" | "running" | "success" | "dead_letter";

export interface MockJob {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempt: number;
  maxAttempts: number;
  nextRunAt: Date;

  lastError: string | null;
  lastErrorCode: string | null;

  idempotencyKey: string | null;
  organizationId: number | null;

  lockedAt: Date | null;
  lockedUntil: Date | null;
  lockedBy: string | null;

  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastDurationMs: number | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface MockRunnerLockRow {
  lockedUntil: number; // epoch ms (matches schema integer)
  lockedBy: string | null;
  updatedAt: number; // epoch ms
}

export type ValidatePayloadResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

function flattenConds(cond: unknown): unknown[] {
  if (!cond || typeof cond !== "object") return [];
  const condObj = cond as Record<string, unknown>;
  if (Array.isArray(condObj._and)) return condObj._and.flatMap(flattenConds);
  // we don't need to fully evaluate _or in this harness
  return [cond];
}

function findEq(preds: unknown[], col: string) {
  const p = preds.find((x) => {
    const pred = x as Record<string, unknown>;
    return pred._eq && typeof pred._eq === "object" && (pred._eq as { col: string }).col === col;
  });
  return p ? (p as { _eq: { val: unknown } })._eq.val : undefined;
}
function findLt(preds: unknown[], col: string) {
  const p = preds.find((x) => {
    const pred = x as Record<string, unknown>;
    return pred._lt && typeof pred._lt === "object" && (pred._lt as { col: string }).col === col;
  });
  return p ? (p as { _lt: { val: unknown } })._lt.val : undefined;
}

export const harness = {
  state: {
    jobs: [] as MockJob[],
    nextJobId: 1,

    // idempotency index for enqueue conflict path
    existingByKey: {} as Record<string, { id: number }>,

    lock: { lockedUntil: 0, lockedBy: null, updatedAt: 0 } as MockRunnerLockRow,

    handlerImpl: (async () => {}) as (payload: unknown) => Promise<void>,

    validateImpl: null as null | ((type: string, payload: unknown) => ValidatePayloadResult),

    // simulate optimistic claim contention
    failClaimForJobIds: new Set<number>(),

    // handler registry for in-memory runner
    handlers: new Map<string, { handler: (payload: unknown) => Promise<void>; schema?: unknown }>(),
  },

  reset() {
    this.state.jobs = [];
    this.state.nextJobId = 1;
    this.state.existingByKey = {};
    this.state.lock = { lockedUntil: 0, lockedBy: null, updatedAt: 0 };
    this.state.handlerImpl = async () => {};
    this.state.validateImpl = null;
    this.state.failClaimForJobIds = new Set();
    this.state.handlers.clear();
  },

  makeJob(overrides: Partial<MockJob> = {}): MockJob {
    const now = new Date();
    const id = overrides.id ?? this.state.nextJobId++;

    const base: MockJob = {
      id,
      type: "webhook_delivery",
      payload: {
        webhookId: 1,
        organizationId: 1,
        event: "test.event",
        data: {},
        timestamp: now.toISOString(),
      },
      status: "pending",
      attempt: 0,
      maxAttempts: 5,
      nextRunAt: new Date(Date.now() - 1000),

      lastError: null,
      lastErrorCode: null,

      idempotencyKey: null,
      organizationId: 1,

      lockedAt: null,
      lockedUntil: null,
      lockedBy: null,

      lastStartedAt: null,
      lastFinishedAt: null,
      lastDurationMs: null,

      createdAt: now,
      updatedAt: now,
    };

    return { ...base, ...overrides };
  },

  registerHandler(
    type: string,
    registration: { handler: (payload: unknown) => Promise<void>; schema?: unknown },
  ) {
    this.state.handlers.set(type, registration);
  },

  clearHandlers() {
    this.state.handlers.clear();
  },
};

/**
 * Call ONCE at the top of each test file (before importing runner/enqueue).
 */
export function setupJobsTestHarness() {
  // ── drizzle-orm operators used across jobs code ────────────────────────────
  vi.mock("drizzle-orm", () => ({
    and: (...args: unknown[]) => ({ _and: args }),
    or: (...args: unknown[]) => ({ _or: args }),
    eq: (col: unknown, val: unknown) => ({ _eq: { col, val } }),
    lt: (col: unknown, val: unknown) => ({ _lt: { col, val } }),
    lte: (col: unknown, val: unknown) => ({ _lte: { col, val } }),
    sql: (s: unknown) => s,

    // optional helpers sometimes used by endpoints
    count: () => "count",
    desc: (col: unknown) => col,
    gte: (col: unknown, val: unknown) => ({ col, val, _gte: true }),
    inArray: (col: unknown, vals: unknown[]) => ({ col, vals, _inArray: true }),
  }));

  // ── schema mocks — EXACT accessor keys matching your Drizzle schema ────────
  vi.mock("@/db/schema", () => ({
    jobs: {
      id: "id",
      type: "type",
      payload: "payload",
      status: "status",
      attempt: "attempt",
      maxAttempts: "maxAttempts",
      nextRunAt: "nextRunAt",
      lastError: "lastError",
      lastErrorCode: "lastErrorCode",
      idempotencyKey: "idempotencyKey",
      organizationId: "organizationId",

      lockedAt: "lockedAt",
      lockedUntil: "lockedUntil",
      lockedBy: "lockedBy",

      lastStartedAt: "lastStartedAt",
      lastFinishedAt: "lastFinishedAt",
      lastDurationMs: "lastDurationMs",

      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },

    jobRunnerLocks: {
      lockName: "lockName",
      lockedUntil: "lockedUntil",
      lockedBy: "lockedBy",
      updatedAt: "updatedAt",
    },

    // safe placeholders if referenced elsewhere
    organizations: { id: "id" },
    auditLogs: {},
    webhookDeliveries: {},
    webhooks: {},
  }));

  // ── logger ────────────────────────────────────────────────────────────────
  vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }));

  // ── payload schemas ────────────────────────────────────────────────────────
  vi.mock("../payload-schemas", () => ({
    validatePayload: (type: string, payload: unknown) => {
      if (harness.state.validateImpl) return harness.state.validateImpl(type, payload);
      return { success: true, data: payload };
    },
  }));

  // ── webhook handler module: must export WebhookDeliveryError ───────────────
  vi.mock("../handlers/webhook-delivery", () => {
    class WebhookDeliveryError extends Error {
      errorCode: string;
      retryAfterMs?: number;
      constructor(message: string, errorCode: string, retryAfterMs?: number) {
        super(message);
        this.name = "WebhookDeliveryError";
        this.errorCode = errorCode;
        this.retryAfterMs = retryAfterMs;
      }
    }
    return {
      WebhookDeliveryError,
      handleWebhookDelivery: (payload: unknown) => harness.state.handlerImpl(payload),
    };
  });

  // ── db mock (stateful) ─────────────────────────────────────────────────────
  vi.mock("@/db", () => ({
    db: {
      select: (_fields?: unknown) => ({
        from: (table: unknown) => ({
          where: (_cond: unknown) => ({
            limit: async (n: number) => {
              // lock read
              const tableObj = table as Record<string, unknown>;
              if (tableObj?.lockName !== undefined) {
                return [{ ...harness.state.lock }];
              }

              // runner candidates
              return harness.state.jobs
                .filter((j) => j.status === "pending" && j.nextRunAt <= new Date())
                .slice(0, n)
                .map((j) => ({
                  id: j.id,
                  type: j.type,
                  payload: j.payload,
                  attempt: j.attempt,
                  maxAttempts: j.maxAttempts,
                }));
            },
          }),
        }),
      }),

      insert: (_table: unknown) => ({
        values: (row: unknown) => {
          const valuesRow = { ...(row as Record<string, unknown>) };

          const doInsertReturning = async () => {
            const id = harness.state.nextJobId++;
            const now = new Date();

            const inserted: MockJob = {
              ...harness.makeJob({ id }),
              ...valuesRow,

              // ensure required fields exist / types are sane
              payload: (valuesRow.payload as Record<string, unknown>) ?? {},
              status: (valuesRow.status as JobStatus) ?? "pending",
              attempt: (valuesRow.attempt as number) ?? 0,
              maxAttempts: (valuesRow.maxAttempts as number) ?? 5,
              nextRunAt: (valuesRow.nextRunAt as Date) ?? now,

              lastError: (valuesRow.lastError as string | null) ?? null,
              lastErrorCode: (valuesRow.lastErrorCode as string | null) ?? null,

              idempotencyKey: (valuesRow.idempotencyKey as string | null) ?? null,
              organizationId: (valuesRow.organizationId as number | null) ?? null,

              lockedAt: (valuesRow.lockedAt as Date | null) ?? null,
              lockedUntil: (valuesRow.lockedUntil as Date | null) ?? null,
              lockedBy: (valuesRow.lockedBy as string | null) ?? null,

              lastStartedAt: (valuesRow.lastStartedAt as Date | null) ?? null,
              lastFinishedAt: (valuesRow.lastFinishedAt as Date | null) ?? null,
              lastDurationMs: (valuesRow.lastDurationMs as number | null) ?? null,

              createdAt: (valuesRow.createdAt as Date) ?? now,
              updatedAt: (valuesRow.updatedAt as Date) ?? now,
            };

            harness.state.jobs.push(inserted);

            if (inserted.idempotencyKey) {
              harness.state.existingByKey[inserted.idempotencyKey] = { id };
            }

            return [{ id }];
          };

          return {
            onConflictDoNothing: (_opts?: unknown) => ({
              returning: async (_fields?: unknown) => {
                const key = valuesRow.idempotencyKey as string | null;
                if (key && harness.state.existingByKey[key]) {
                  return []; // conflict path
                }
                return doInsertReturning();
              },
            }),
            returning: async (_fields?: unknown) => doInsertReturning(),
          };
        },
      }),

      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: (cond: unknown) => {
            async function exec(): Promise<unknown[]> {
              const preds = flattenConds(cond);

              const eqId = findEq(preds, "id");
              const eqStatus = findEq(preds, "status");
              const ltLockedUntil = findLt(preds, "lockedUntil");

              // ── jobRunnerLocks updates ────────────────────────────────
              const tableObj = table as Record<string, unknown>;
              if (tableObj?.lockName !== undefined) {
                const lockName = findEq(preds, "lockName");
                if (lockName !== "default") return [];

                // acquire
                if (typeof values.lockedUntil === "number" && values.lockedUntil > 0) {
                  const nowMs = (
                    typeof ltLockedUntil === "number" ? ltLockedUntil : Date.now()
                  ) as number;
                  if (harness.state.lock.lockedUntil < nowMs) {
                    harness.state.lock.lockedUntil = values.lockedUntil;
                    harness.state.lock.lockedBy = (values.lockedBy as string | null) ?? null;
                    harness.state.lock.updatedAt = (values.updatedAt as number) ?? Date.now();
                    return [{ lockName: "default" }];
                  }
                  return [];
                }

                // release
                if (values.lockedUntil === 0) {
                  const byVal = findEq(preds, "lockedBy");
                  if (byVal !== undefined && harness.state.lock.lockedBy !== byVal) return [];
                  harness.state.lock.lockedUntil = 0;
                  harness.state.lock.lockedBy = null;
                  return [{ lockName: "default" }];
                }

                return [];
              }

              // ── jobs reclaim path: WHERE status='running' AND lt(lockedUntil)
              if (eqId === undefined) {
                if (eqStatus === "running") {
                  const nowMs =
                    ltLockedUntil instanceof Date ? ltLockedUntil.getTime() : Date.now();
                  const reclaimed = harness.state.jobs.filter(
                    (j) =>
                      j.status === "running" &&
                      j.lockedUntil instanceof Date &&
                      j.lockedUntil.getTime() < nowMs,
                  );
                  reclaimed.forEach((j) => Object.assign(j, values));
                  return reclaimed.map((j) => ({ id: j.id }));
                }
                return [];
              }

              // ── jobs by id update
              const job = harness.state.jobs.find((j) => j.id === eqId);
              if (!job) return [];

              // simulate claim contention by update "shape"
              const looksLikeClaim =
                values.lockedUntil !== undefined &&
                (values.lockedBy !== undefined || values.lockedAt !== undefined);

              if (looksLikeClaim && harness.state.failClaimForJobIds.has(job.id)) {
                return [];
              }

              // optional optimistic guard if WHERE asserts pending
              if (eqStatus === "pending" && job.status !== "pending") return [];

              Object.assign(job, values);
              return [{ id: job.id }];
            }

            let cached: Promise<unknown[]> | null = null;
            const run = () => (cached ??= exec());

            return run();
          },
        }),
      }),
    },
  }));

  // optional: silence “env var not set” stderr if unknown import path reads env
  process.env.TURSO_CONNECTION_URL ??= "test://local";
  process.env.TURSO_AUTH_TOKEN ??= "test";
}
