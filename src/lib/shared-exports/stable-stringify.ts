/**
 * Deep-stable JSON stringify for canonical hashing.
 * Recursively sorts object keys so equivalent payloads produce identical strings.
 * No data loss — includes all nested keys.
 */

export function stableStringify(obj: unknown): string {
  return JSON.stringify(canonicalize(obj));
}

function canonicalize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  if (typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();
    for (const k of keys) {
      sorted[k] = canonicalize((obj as Record<string, unknown>)[k]);
    }
    return sorted;
  }
  return obj;
}
