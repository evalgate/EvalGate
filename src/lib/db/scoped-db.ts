// src/lib/db/scoped-db.ts

import { eq } from "drizzle-orm";
import { db } from "@/db";

/**
 * Tenant-scoped Drizzle query builder.
 * Makes IDOR structurally impossible — if a route uses scopedDb(orgId),
 * it cannot accidentally return another tenant's data.
 *
 * Usage:
 *   const sdb = scopedDb(authResult.organizationId);
 *   const rows = await sdb.selectFrom(evaluations);
 */
export function scopedDb(organizationId: number) {
  return {
    /** Scoped select: auto-appends org filter */
    selectFrom<T extends { organizationId: any }>(table: T) {
      return db
        .select()
        .from(table as any)
        .where(eq((table as any).organizationId, organizationId));
    },
    /** Scoped delete: prevents cross-tenant deletion */
    deleteFrom<T extends { organizationId: any }>(table: T) {
      return db.delete(table as any).where(eq((table as any).organizationId, organizationId));
    },
    /** Raw db for tables without org column (join-through patterns) */
    raw: db,
    /** The organization ID this scope is bound to */
    organizationId,
  };
}
