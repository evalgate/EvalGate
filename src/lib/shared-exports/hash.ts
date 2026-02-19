import { createHash } from "node:crypto";
import { stableStringify } from "./stable-stringify";

/**
 * Compute a stable SHA-256 hash of export content for ETag/caching.
 * Uses deep-stable canonicalization so nested key order does not affect the hash.
 */
export function computeExportHash(exportData: Record<string, unknown>): string {
  const canonical = stableStringify(exportData);
  return createHash("sha256").update(canonical).digest("hex");
}
