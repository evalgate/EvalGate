# Timestamp Policy

## Policy Statement

**All new tables must use `integer(..., { mode: "timestamp" })` for date columns.**

## Rationale

Integer timestamps provide several advantages over string timestamps:

1. **Sortable**: Natural numeric ordering works correctly
2. **Indexable**: More efficient database indexing
3. **Timezone Agnostic**: Avoids timezone/format ambiguity
4. **Storage Efficient**: Smaller storage footprint
5. **Query Performance**: Faster date/time operations

## Migration Status

### ✅ Already Migrated (Integer Timestamps)

| Table | Timestamp Columns | Status |
|-------|-------------------|---------|
| `user` | `createdAt`, `updatedAt` | ✅ Complete |
| `session` | `expiresAt`, `createdAt`, `updatedAt` | ✅ Complete |
| `account` | `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `createdAt`, `updatedAt` | ✅ Complete |
| `verification` | `expiresAt`, `createdAt`, `updatedAt` | ✅ Complete |
| `organizations` | `createdAt`, `updatedAt` | ✅ Complete |
| `organizationMembers` | `createdAt` | ✅ Complete |
| `evaluations` | `createdAt`, `updatedAt` | ✅ Complete |
| `traces` | `createdAt` | ✅ Complete |
| `evaluationRuns` | `startedAt`, `completedAt`, `createdAt` | ✅ Complete (migration 0039) |
| `testResults` | `createdAt` | ✅ Complete (migration 0039) |
| `spans` | `startTime`, `endTime`, `createdAt` | ✅ Complete (migration 0039) |
| `apiKeys` | `lastUsedAt`, `expiresAt`, `revokedAt`, `createdAt` | ✅ Complete (migration 0039) |
| `webhooks` | `lastDeliveredAt`, `createdAt`, `updatedAt` | ✅ Complete (migration 0039) |
| `testCases` | `createdAt` | ✅ Complete (migration 0040) |
| `annotationTasks` | `createdAt`, `updatedAt` | ✅ Complete (migration 0040) |
| `annotationItems` | `annotatedAt`, `createdAt` | ✅ Complete (migration 0040) |
| `llmJudgeConfigs` | `createdAt`, `updatedAt` | ✅ Complete (migration 0040) |
| `llmJudgeResults` | `createdAt` | ✅ Complete (migration 0040) |
| `costRecords` | `createdAt` | ✅ Complete (migration 0040) |
| `qualityScores` | `createdAt` | ✅ Complete (migration 0040) |
| `driftAlerts` | `createdAt` | ✅ Complete (migration 0040) |
| `sharedReports` | `createdAt` | ✅ Complete (migration 0040) |
| `sharedExports` | `createdAt`, `updatedAt`, `expiresAt` | ✅ Complete (migration 0040) |
| `humanAnnotations` | `annotatedAt`, `createdAt` | ✅ Complete (migration 0040) |
| `emailSubscribers` | `subscribedAt`, `unsubscribedAt`, `lastEmailSentAt`, `createdAt`, `updatedAt` | ✅ Complete (migration 0040) |
| `webhookDeliveries` | `createdAt` | ✅ Complete (migration 0040) |
| `apiUsageLogs` | `createdAt` | ✅ Complete (migration 0040) |
| `providerPricing` | `createdAt` | ✅ Complete (migration 0040) |
| `auditLogs` | `createdAt` | ✅ Complete (migration 0040) |
| `benchmarks` | `createdAt`, `updatedAt` | ✅ Complete (migration 0040) |
| `agentConfigs` | `createdAt`, `updatedAt` | ✅ Complete (migration 0040) |
| `benchmarkResults` | `createdAt` | ✅ Complete (migration 0040) |

**All tables migrated — no pending migrations remain.**

## Hot-Path Tables (Batch 1 — Completed)

The following hot-path tables were migrated in **migration 0039** (recreate-table pattern with backfill):

1. **`evaluationRuns`** — `startedAt`, `completedAt`, `createdAt`
2. **`testResults`** — `createdAt`
3. **`spans`** — `startTime`, `endTime`, `createdAt`
4. **`apiKeys`** — `lastUsedAt`, `expiresAt`, `revokedAt`, `createdAt`
5. **`webhooks`** — `lastDeliveredAt`, `createdAt`, `updatedAt`

All app code (services, routes, gateway, worker, seeds) updated to write `Date` objects.

## Remaining Tables (Batch 2 — Completed)

All remaining tables were migrated in **migration 0040** (recreate-table pattern with `strftime('%s', col)` backfill):

1. **`testCases`** — `createdAt`
2. **`annotationTasks`** — `createdAt`, `updatedAt`
3. **`annotationItems`** — `annotatedAt`, `createdAt`
4. **`llmJudgeConfigs`** — `createdAt`, `updatedAt`
5. **`llmJudgeResults`** — `createdAt`
6. **`costRecords`** — `createdAt`
7. **`qualityScores`** — `createdAt`
8. **`driftAlerts`** — `createdAt`
9. **`sharedReports`** — `createdAt`
10. **`sharedExports`** — `createdAt`, `updatedAt`, `expiresAt`
11. **`humanAnnotations`** — `annotatedAt`, `createdAt`
12. **`emailSubscribers`** — `subscribedAt`, `unsubscribedAt`, `lastEmailSentAt`, `createdAt`, `updatedAt`
13. **`webhookDeliveries`** — `createdAt`
14. **`apiUsageLogs`** — `createdAt`
15. **`providerPricing`** — `createdAt`
16. **`auditLogs`** — `createdAt`
17. **`benchmarks`** — `createdAt`, `updatedAt`
18. **`agentConfigs`** — `createdAt`, `updatedAt`
19. **`benchmarkResults`** — `createdAt`

All app code (30+ files: API routes, services, seed files) updated to write `Date` objects.

## Implementation Guidelines

### New Tables

When creating new tables, always use:

```typescript
// ✅ Correct - integer timestamps
export const newTable = sqliteTable("new_table", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ❌ Incorrect - string timestamps
export const oldTable = sqliteTable("old_table", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").notNull(), // Don't do this
  updatedAt: text("updated_at").notNull(), // Don't do this
});
```

### Migration Strategy

For existing tables with string timestamps:

1. **Create new integer columns** (e.g., `created_at_int`)
2. **Backfill data** from string to integer timestamps
3. **Update application code** to use new columns
4. **Drop old string columns** after verification
5. **Rename columns** back to original names

### Query Patterns

When querying timestamp columns:

```typescript
// ✅ Use integer timestamps directly
const recent = await db
  .select()
  .from(evaluationRuns)
  .where(gt(evaluationRuns.createdAt, Date.now() - 24 * 60 * 60 * 1000));

// ✅ Date operations work naturally
const date = new Date(row.createdAt);
```

## Migration Scripts

Example migration for a single table:

```sql
-- 1. Add new integer columns
ALTER TABLE evaluationRuns 
ADD COLUMN created_at_int INTEGER,
ADD COLUMN updated_at_int INTEGER,
ADD COLUMN started_at_int INTEGER,
ADD COLUMN completed_at_int INTEGER;

-- 2. Backfill data (convert ISO strings to timestamps)
UPDATE evaluationRuns 
SET 
  created_at_int = strftime('%s', created_at) * 1000,
  updated_at_int = strftime('%s', updated_at) * 1000,
  started_at_int = CASE 
    WHEN started_at IS NOT NULL THEN strftime('%s', started_at) * 1000 
    ELSE NULL 
  END,
  completed_at_int = CASE 
    WHEN completed_at IS NOT NULL THEN strftime('%s', completed_at) * 1000 
    ELSE NULL 
  END;

-- 3. Update application code to use new columns

-- 4. Drop old columns (after verification)
ALTER TABLE evaluationRuns 
DROP COLUMN created_at,
DROP COLUMN updated_at,
DROP COLUMN started_at,
DROP COLUMN completed_at;

-- 5. Rename columns back to original names
ALTER TABLE evaluationRuns 
RENAME COLUMN created_at_int TO created_at,
RENAME COLUMN updated_at_int TO updated_at,
RENAME COLUMN started_at_int TO started_at,
RENAME COLUMN completed_at_int TO completed_at;
```

## Testing Requirements

All timestamp migrations must include:

1. **Data integrity tests** - Verify no data loss during conversion
2. **Application tests** - Ensure all queries work with new format
3. **Performance tests** - Verify expected performance improvements
4. **Rollback tests** - Ensure migration can be safely rolled back

## Compliance

This policy applies to:
- All new database schema changes
- All migration scripts
- All Drizzle schema definitions
- All application code that handles dates/times

## Exceptions

Exceptions to this policy require explicit approval and must include:
- Technical justification for using string timestamps
- Migration plan to integer timestamps
- Timeline for compliance

---

**Last Updated:** February 25, 2026  
**Next Review:** March 19, 2026  
**Approved By:** Development Team
