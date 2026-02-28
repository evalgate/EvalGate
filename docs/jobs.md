# Background Job Runner

## Overview

The platform uses a DB-backed job queue built on PostgreSQL. Jobs are stored in the `jobs` table and processed by `runDueJobs()`, invoked every minute via Vercel Cron at `POST /api/jobs/run`.

---

## Invariants (Phase 0)

These are the rules the job system must always obey:

1. **Idempotency is enforced at enqueue-time and handler-time**
   - Enqueue uses `INSERT … ON CONFLICT DO NOTHING` on the `idempotency_key` unique constraint — two concurrent enqueues with the same key return the same job ID
   - Webhook handler checks `webhook_deliveries` for an existing successful delivery before sending

2. **Jobs never get "stuck"**
   - If a worker crashes mid-run, the job becomes reclaimable after `locked_until` expires (2 min TTL)
   - Reclaimed jobs are tagged with `JOB_LOCK_TIMEOUT_RECLAIMED` for traceability

3. **Retries are deterministic**
   - Backoff math is stable (exponential with ±10% jitter)
   - `next_run_at` is stored and queryable for every pending retry
   - `attempt >= maxAttempts` → `dead_letter` (never auto-processed again)

4. **Observability is not optional**
   - Every attempt records `last_started_at`, `last_finished_at`, `last_duration_ms`, `last_error_code`
   - Structured logs emitted on enqueue, claim, success, failure, reclaim
   - DLQ is searchable by org + type + error code + time window

5. **Payloads are validated before insertion**
   - Max 128 KB serialized size, max 10 levels depth, max 500 keys
   - Zod schema validation per job type (optional skip for trusted callers)

**Acceptance criteria:** You can answer "What failed? why? how often? is it stuck? who owns it?" in under 30 seconds.

---

## Status Lifecycle

```
enqueue()  (atomic idempotency via ON CONFLICT DO NOTHING)
    │
    ▼
 pending  ──────────────────────────────────────────────────────────────────┐
    │                                                                        │
    │  optimistic claim (UPDATE WHERE status='pending'                       │
    │    OR (status='running' AND locked_until <= now))                      │
    ▼                                                                        │
 running  ── handler throws, attempt < maxAttempts ──► pending (backoff)    │
    │              │                                                         │
    │              ├── 429 → RATE_LIMITED (Retry-After)                      │
    │              ├── 5xx → UPSTREAM_5XX                                    │
    │              └── other → HANDLER_ERROR                                 │
    │                                                                        │
    │  handler throws, attempt >= maxAttempts                                │
    ├──────────────────────────────────────────────────────────────────────► dead_letter
    │                                                                        │
    │  payload invalid (Zod) at runner time                                  │
    ├──────────────────────────────────────────────────────────────────────► dead_letter
    │                                                                        │
    │  no handler registered                                                 │
    ├──────────────────────────────────────────────────────────────────────► dead_letter
    │                                                                        │
    │  handler succeeds                                                      │
    ▼                                                                        │
 success                                                                     │
                                                                             │
 POST /api/jobs/:id/retry ◄──────────────────────────────────────────────────┘
    │  mode: now | later | reset
```

**Terminal states:** `success`, `dead_letter`
**Retriable states:** `pending`, `running` (via TTL reclaim)

---

## Enqueue Safety

### Atomic Idempotency (Phase 1A)

```
INSERT INTO jobs (...) VALUES (...)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING id
```

If 0 rows returned → conflict → SELECT existing job ID.

Two concurrent `enqueue()` calls with the same `idempotencyKey` are guaranteed to return the same job ID with zero duplicate rows.

### Payload Validation (Phase 1B)

Before insertion, `enqueue()` validates:
- **Size**: serialized JSON ≤ 128 KB
- **Depth**: max 10 levels of nesting
- **Keys**: max 500 total keys
- **Schema**: Zod validation per job type (skippable via `skipValidation: true`)

Violations throw `EnqueueError` with code `PAYLOAD_TOO_LARGE` or `PAYLOAD_INVALID`.

### Metadata (Phase 1C)

Every enqueue call can attach traceability metadata via `opts.meta`:

```ts
enqueue("webhook_delivery", payload, {
  meta: { source: "api/webhooks", createdBy: userId, traceId: "abc-123" }
})
```

Stored as `_meta` inside the payload. Enables debugging origin without logs.

---

## TTL Reclaim

Every runner invocation reclaims jobs stuck in `running` with an expired `locked_until`:

```sql
UPDATE jobs SET status='pending', last_error_code='JOB_LOCK_TIMEOUT_RECLAIMED',
  locked_until=NULL, locked_by=NULL
WHERE status='running' AND locked_until < now
```

- **`JOB_LOCK_TTL_MS`** (hardcoded): 2 minutes
- If a process crashes mid-job, the job is automatically reclaimed and retried after 2 minutes
- Reclaimed jobs are tagged with `JOB_LOCK_TIMEOUT_RECLAIMED` for ops visibility

---

## Claim Atomicity

The claim step handles both new pending jobs and stale running (reclaim) in a single UPDATE:

```sql
UPDATE jobs SET status='running', locked_at=now, locked_until=now+TTL, locked_by=runnerId
WHERE id = ? AND (status='pending' OR (status='running' AND locked_until <= now))
RETURNING id
```

This ensures two workers cannot both claim the same job.

---

## Exponential Backoff (with Jitter)

| Attempt | Base Delay | With Jitter (±10%) |
|---------|-----------|---------------------|
| 1       | 1 min     | 54s – 66s           |
| 2       | 5 min     | 4.5m – 5.5m         |
| 3       | 15 min    | 13.5m – 16.5m       |
| 4       | 1 h       | 54m – 66m           |
| 5+      | 4 h       | 3.6h – 4.4h         |

Jitter formula: `delay * (0.9 + rand * 0.2)` — prevents thundering herd retries.

Default `maxAttempts` is 5. After the final attempt the job moves to `dead_letter`.

---

## Global Runner Lock

A `job_runner_locks` table prevents concurrent runner invocations from stampeding:

- Lock TTL: **60 seconds**
- Acquire: `UPDATE … WHERE locked_until < now` — if 0 rows affected, another runner is active
- Release: cleared in a `finally` block after all jobs are processed
- If lock is held: runner returns `{ skipped: "lock_held" }` immediately

---

## Error Codes

| Code | Meaning |
|---|---|
| `JOB_HANDLER_MISSING` | No handler registered for this job type |
| `JOB_PAYLOAD_INVALID` | Payload failed Zod schema validation |
| `JOB_PAYLOAD_TOO_LARGE` | Payload exceeds size/depth/key limits |
| `JOB_HANDLER_ERROR` | Handler threw a generic error |
| `JOB_LOCK_TIMEOUT_RECLAIMED` | Job was reclaimed after TTL expiry (crash recovery) |
| `JOB_RATE_LIMITED` | Upstream returned 429 (respects Retry-After) |
| `JOB_UPSTREAM_5XX` | Upstream returned 5xx server error |

Every failure sets `last_error_code` — no nulls on failed/dead_letter jobs.

---

## Observability Fields

Each job attempt records:

| Field | Description |
|---|---|
| `last_started_at` | Timestamp when the job was claimed |
| `last_finished_at` | Timestamp when the attempt completed |
| `last_duration_ms` | Duration of the attempt in milliseconds |
| `last_error` | Truncated error message (max 2 KB) |
| `last_error_code` | Stable error code (see table above) |
| `locked_by` | Runner invocation ID that claimed the job |

### Structured Logs (Phase 6A)

| Event | Fields |
|---|---|
| Enqueue | jobId, type, idempotencyKey, organizationId, source |
| Claim | jobId, lockedBy, lockUntil, attempt, wasReclaim |
| Success | jobId, type, durationMs |
| Failure | jobId, type, attempt, isDeadLetter, errorCode, durationMs, nextRunAt |
| Reclaim | count, jobIds, errorCode |

---

## Runner Summary Log

Every run emits a structured log entry:

```json
{
  "runId": "runner-1234567890",
  "processed": 3,
  "failed": 1,
  "reclaimed": 0,
  "deadLettered": 1,
  "stoppedEarly": false,
  "runtimeMs": 1240
}
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MAX_JOBS_PER_RUN` | `10` | Max jobs claimed per invocation |
| `RUNNER_TIME_BUDGET_MS` | `20000` | Stop claiming new jobs after this munknown ms |
| `CRON_SECRET` | — | Bearer token required to call `/api/jobs/run` |

---

## DLQ Operations (Admin API)

### List dead-letter jobs

```
GET /api/jobs/dead?limit=50&offset=0&type=webhook_delivery&errorCode=JOB_HANDLER_ERROR&since=2024-01-01&until=2024-12-31&minAttempt=3
Authorization: Bearer <session-token>
```

- Requires `admin` role
- Scoped to caller's organization
- Payload is **not returned** (redacted for security)
- Returns: `{ jobs: [...], total, limit, offset, hasMore }`

**Filters:** `type`, `errorCode`, `since`, `until`, `minAttempt`

### Retry a dead-letter job

```
POST /api/jobs/:id/retry
Authorization: Bearer <session-token>
Content-Type: application/json

{ "mode": "now" | "later" | "reset" }
```

- Requires `admin` role
- Job must belong to caller's organization
- Job must be in `dead_letter` status (returns 409 otherwise)

| Mode | Behavior |
|---|---|
| `now` | `nextRunAt = now`, keeps attempt count |
| `later` | `nextRunAt = now + 5m`, keeps attempt count |
| `reset` (default) | `attempt=0`, `nextRunAt = now`, clears errors |

All retry actions write to `audit_logs`.

### Bulk retry

```
POST /api/jobs/dead/bulk-retry
Authorization: Bearer <session-token>
Content-Type: application/json

{ "jobIds": [1, 2, 3], "mode": "reset" }
// or
{ "errorCode": "JOB_HANDLER_ERROR", "mode": "now" }
```

- Max 100 jobs per request
- Returns per-job results: `{ results: [{ jobId, ok, error? }], total, succeeded, failed }`

---

## Webhook Delivery Idempotency (Phase 5)

### Deduplication (5A)

Each delivery computes a SHA-256 `payload_hash`. Before sending:

1. Check `webhook_deliveries` for existing successful delivery with same `(webhook_id, event_type, payload_hash)`
2. If found → skip (idempotent, no retry, no duplicate external webhook)

A unique index on `(webhook_id, event_type, payload_hash)` prevents duplicates at the DB level.

### 429 + Retry-After (5B)

If the upstream returns `429`:
- `last_error_code` = `JOB_RATE_LIMITED`
- `next_run_at` = `now + Retry-After` (parsed from response, default 60s)

If the upstream returns `5xx`:
- `last_error_code` = `JOB_UPSTREAM_5XX`
- Standard backoff applies

---

## Adding a New Job Type

1. Add the type to `JobType` in `src/lib/jobs/types.ts`
2. Add a Zod schema in `src/lib/jobs/payload-schemas.ts`
3. Create a handler in `src/lib/jobs/handlers/<type>.ts`
4. Register the handler in the `HANDLERS` map in `src/lib/jobs/runner.ts`
5. Use `enqueue(type, payload, opts)` from `src/lib/jobs/enqueue.ts` to queue jobs

---

## Acceptance Criteria Checklist

- [ ] Concurrent enqueues with same idempotencyKey return the same job ID
- [ ] Enqueue rejects oversized or invalid payloads with clear error
- [ ] Runner reclaims stale running jobs after locked_until
- [ ] Claim is atomic (no double processing under concurrency)
- [ ] Every failure sets last_error_code (no nulls on failed/dead_letter)
- [ ] dead_letter is terminal unless explicitly retried
- [ ] DLQ list supports org/type/errorCode filters + pagination
- [ ] Retry endpoint supports 3 modes (now/later/reset) and clears locks
- [ ] All retry/requeue actions are auditable
- [ ] Webhook delivery is idempotent (no duplicate deliveries on retries)
- [ ] 429 respects Retry-After if present
- [ ] Jitter prevents thundering herd on retries
