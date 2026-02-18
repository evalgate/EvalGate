/**
 * Input normalization and hashing for deterministic matching.
 * Must match platform's @/lib/utils/input-hash.ts for reportToEvalAI.
 */

import crypto from "node:crypto";

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    sorted[k] =
      v != null && typeof v === "object" && !Array.isArray(v)
        ? sortKeys(v as Record<string, unknown>)
        : v;
  }
  return sorted;
}

/** Normalize input for stable matching (whitespace, JSON key order). */
export function normalizeInput(input: string): string {
  const s = input.trim();
  try {
    const obj = JSON.parse(s);
    return JSON.stringify(sortKeys(obj as Record<string, unknown>));
  } catch {
    return s.replace(/\s+/g, " ");
  }
}

/** SHA-256 hash of normalized input. */
export function sha256Input(s: string): string {
  return crypto.createHash("sha256").update(normalizeInput(s), "utf8").digest("hex");
}
