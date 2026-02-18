/**
 * Span Service
 * Business logic for span CRUD.
 * Extracted from src/app/api/traces/[id]/spans/route.ts
 * Enforces tenant boundary via trace ownership.
 */

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { evaluationRuns, spans, traces } from "@/db/schema";
import { canonicalizeJson } from "@/lib/crypto/canonical-json";
import { sha256Hex } from "@/lib/crypto/hash";
import { sha256Input } from "@/lib/utils/input-hash";

export interface CreateSpanInput {
  spanId: string;
  name: string;
  type: string;
  parentSpanId?: string;
  input?: string | object | null;
  output?: string | null;
  durationMs?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  metadata?: unknown;
  evaluationRunId?: number | null;
}

export const spanService = {
  /**
   * List spans for a trace. Enforces trace exists and belongs to org.
   * Returns null if trace not found or not in org.
   */
  async listByTrace(
    organizationId: number,
    traceDbId: number,
    opts: { limit: number; offset: number },
  ) {
    const [trace] = await db
      .select({ id: traces.id })
      .from(traces)
      .where(and(eq(traces.id, traceDbId), eq(traces.organizationId, organizationId)))
      .limit(1);

    if (!trace) return null;

    return await db
      .select()
      .from(spans)
      .where(eq(spans.traceId, traceDbId))
      .orderBy(asc(spans.startTime))
      .limit(opts.limit)
      .offset(opts.offset);
  },

  /**
   * Create a span. Enforces trace exists and belongs to org.
   * Verifies evaluationRunId belongs to org if provided.
   * Returns { ok: false, reason } if trace not found or run (when provided) not in org.
   */
  async create(organizationId: number, traceDbId: number, data: CreateSpanInput) {
    const [trace] = await db
      .select({ id: traces.id })
      .from(traces)
      .where(and(eq(traces.id, traceDbId), eq(traces.organizationId, organizationId)))
      .limit(1);

    if (!trace) return { ok: false, reason: "trace_not_found" };

    if (data.evaluationRunId != null) {
      const [run] = await db
        .select()
        .from(evaluationRuns)
        .where(
          and(
            eq(evaluationRuns.id, data.evaluationRunId),
            eq(evaluationRuns.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (!run) return { ok: false, reason: "run_not_in_org" };
    }

    const now = new Date().toISOString();

    const inputStr =
      typeof data.input === "string"
        ? data.input
        : data.input != null && typeof data.input === "object"
          ? canonicalizeJson(data.input)
          : data.input != null
            ? JSON.stringify(data.input)
            : null;

    const inputHash = inputStr
      ? typeof data.input === "object" && data.input != null
        ? sha256Hex(canonicalizeJson(data.input))
        : sha256Input(inputStr)
      : null;

    const [newSpan] = await db
      .insert(spans)
      .values({
        traceId: traceDbId,
        spanId: data.spanId.trim(),
        parentSpanId: data.parentSpanId?.trim() ?? null,
        name: data.name.trim(),
        type: data.type.trim(),
        startTime: data.startTime ?? now,
        endTime: data.endTime ?? null,
        input: inputStr,
        inputHash,
        output: data.output ?? null,
        durationMs: data.durationMs ?? null,
        metadata: data.metadata ?? null,
        evaluationRunId: data.evaluationRunId ?? null,
        createdAt: now,
      })
      .returning();

    return newSpan!;
  },
};
