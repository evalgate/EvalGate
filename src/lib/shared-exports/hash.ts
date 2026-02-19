import { createHash } from "node:crypto";
import { stableStringify } from "./stable-stringify";

/**
 * Hash algorithm version. Bump when the hashing algorithm or canonicalization changes.
 * Clients can use this to detect when 304/ETag semantics may have changed.
 */
export const HASH_VERSION = 1;

/**
 * Compute a stable SHA-256 hash of export content for ETag/caching.
 * Uses deep-stable canonicalization so nested key order does not affect the hash.
 */
export function computeExportHash(exportData: Record<string, unknown>): string {
  const canonical = stableStringify(exportData);
  return createHash("sha256").update(canonical).digest("hex");
}
