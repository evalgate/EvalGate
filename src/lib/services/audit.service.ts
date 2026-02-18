/**
 * Audit Service
 * Immutable audit logging for security events and data mutations.
 */

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { logger } from "@/lib/logger";

export interface AuditEntry {
  organizationId: number;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Write an immutable audit log entry.
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        organizationId: entry.organizationId ?? null,
        userId: entry.userId ?? null,
        action: entry.action,
        resourceType: entry.resourceType ?? null,
        resourceId: entry.resourceId ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      // Audit logging should never break the request — fire and forget
      logger.error("Failed to write audit log", {
        action: entry.action,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * List audit logs for an organization with filtering and pagination.
   */
  async list(
    organizationId: number,
    options?: {
      action?: string;
      resourceType?: string;
      since?: string;
      until?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = Math.min(options?.limit ?? 50, 100);
    const offset = options?.offset ?? 0;

    const conditions = [eq(auditLogs.organizationId, organizationId)];

    if (options?.action) {
      conditions.push(eq(auditLogs.action, options.action));
    }
    if (options?.resourceType) {
      conditions.push(eq(auditLogs.resourceType, options.resourceType));
    }
    if (options?.since) {
      conditions.push(gte(auditLogs.createdAt, options.since));
    }
    if (options?.until) {
      conditions.push(lte(auditLogs.createdAt, options.until));
    }

    const results = await db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  }
}

export const auditService = new AuditService();
