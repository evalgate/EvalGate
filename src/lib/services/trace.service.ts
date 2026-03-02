/**
 * Trace Service
 * Business logic for trace CRUD.
 * Extracted from src/app/api/traces/route.ts
 */

import { and, desc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { traces } from "@/db/schema";

export interface CreateTraceInput {
	name: string;
	traceId: string;
	status?: string;
	durationMs?: number;
	metadata?: unknown;
}

export const traceService = {
	list(
		organizationId: number,
		opts: { limit: number; offset: number; status?: string; search?: string },
	) {
		const conditions = [eq(traces.organizationId, organizationId)];

		if (opts.status) {
			conditions.push(eq(traces.status, opts.status));
		}

		if (opts.search) {
			conditions.push(like(traces.name, `%${opts.search}%`));
		}

		return db
			.select()
			.from(traces)
			.where(and(...conditions))
			.orderBy(desc(traces.createdAt))
			.limit(opts.limit)
			.offset(opts.offset);
	},

	create(organizationId: number, data: CreateTraceInput) {
		const now = new Date();
		return db
			.insert(traces)
			.values({
				name: data.name.trim(),
				traceId: data.traceId.trim(),
				organizationId,
				status: data.status || "pending",
				durationMs: data.durationMs ?? null,
				metadata: (data.metadata as import("@/db/types").TraceMetadata) ?? null,
				createdAt: now,
			})
			.returning();
	},

	async remove(organizationId: number, traceDbId: number): Promise<boolean> {
		const existing = await db
			.select()
			.from(traces)
			.where(
				and(
					eq(traces.id, traceDbId),
					eq(traces.organizationId, organizationId),
				),
			)
			.limit(1);

		if (existing.length === 0) return false;

		await db
			.delete(traces)
			.where(
				and(
					eq(traces.id, traceDbId),
					eq(traces.organizationId, organizationId),
				),
			);

		return true;
	},
};
