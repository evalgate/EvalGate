/**
 * Sanitize export data for public sharing.
 * Whitelist allowed sections, remove rest, cap size, assert no secrets.
 */

const MAX_SIZE_BYTES = 512 * 1024; // 512KB
const MAX_STRING_LENGTH = 10_000;
const MAX_DEPTH = 50;

/** Top-level keys allowed in sanitized export data (no share metadata — that lives in DB/DTO) */
const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "evaluation",
  "timestamp",
  "summary",
  "qualityScore",
  "type",
  "testResults",
  "evaluations",
  "judgeEvaluations",
  "criteria",
  "interRaterReliability",
  "variants",
  "results",
  "statisticalSignificance",
  "comparison",
  "codeValidation",
  "judgePrompt",
  "judgeModel",
  "aggregateMetrics",
]);

/** Patterns that indicate secret-like values in strings */
const SECRET_VALUE_PATTERNS = [
  /\bsk-[A-Za-z0-9-]{20,}\b/, // OpenAI-style API keys (sk-proj-...)
  /\bBearer\s+[A-Za-z0-9\-_.]{20,}\b/i, // Bearer tokens
  /\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b/, // JWT (header.payload.signature)
];

/** Keys that indicate secrets - if found anywhere in object tree, reject (lowercase for case-insensitive match) */
const SECRET_KEYS = new Set([
  "apikey",
  "api_key",
  "authorization",
  "bearer",
  "bearer_token",
  "secret",
  "password",
  "token",
  "organizationid",
  "organization_id",
  "userid",
  "user_id",
  "createdby",
  "created_by",
  "annotatorid",
  "annotator_id",
  "internalnotes",
  "internal_notes",
]);

/**
 * Recursively truncate long strings in an object.
 */
function truncateStrings(obj: unknown, maxLen: number): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    return obj.length > maxLen ? `${obj.slice(0, maxLen)}…` : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => truncateStrings(item, maxLen));
  }
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = truncateStrings(v, maxLen);
    }
    return out;
  }
  return obj;
}

/**
 * Whitelist top-level keys and recursively sanitize nested objects.
 * Removes any key not in the allowed set at top level.
 * For nested objects (e.g. evaluation, qualityScore), we allow the structure but strip unknown keys at each level.
 * Uses cycle detection and maxDepth to avoid pathological input.
 */
function whitelistAndSanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) continue;
    out[key] = sanitizeValue(value, 0, new WeakSet());
  }
  return out;
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > MAX_DEPTH) return null;
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value as object)) return null; // Cycle: skip
    seen.add(value as object);
    try {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = sanitizeValue(v, depth + 1, seen);
      }
      return out;
    } finally {
      seen.delete(value as object);
    }
  }
  return value;
}

function hasSecretValue(str: string): boolean {
  return SECRET_VALUE_PATTERNS.some((re) => re.test(str));
}

/**
 * Recursively scan object for secret-like keys and values (case-insensitive).
 * Includes cycle detection and maxDepth guard.
 */
function hasSecrets(obj: unknown, path = "", depth = 0, seen = new WeakSet<object>()): boolean {
  if (depth > MAX_DEPTH) return true; // Treat deep structures as suspicious
  if (obj === null || obj === undefined) return false;
  if (typeof obj === "number" || typeof obj === "boolean") return false;
  if (typeof obj === "string") {
    return hasSecretValue(obj);
  }
  if (Array.isArray(obj)) {
    return obj.some((item, i) => hasSecrets(item, `${path}[${i}]`, depth + 1, seen));
  }
  if (typeof obj === "object") {
    if (seen.has(obj as object)) return true; // Cycle detected
    seen.add(obj as object);
    try {
      for (const [key, value] of Object.entries(obj)) {
        const keyLower = key.toLowerCase();
        if (
          SECRET_KEYS.has(keyLower) ||
          keyLower.includes("apikey") ||
          keyLower.includes("secret")
        ) {
          return true;
        }
        if (hasSecrets(value, `${path}.${key}`, depth + 1, seen)) return true;
      }
    } finally {
      seen.delete(obj as object);
    }
  }
  return false;
}

/**
 * Sanitize export data for public sharing.
 * - Whitelists allowed top-level sections
 * - Removes anything else
 * - Caps total size (512KB) and truncates long strings
 */
export function sanitizeExportData(exportData: unknown): Record<string, unknown> {
  if (!exportData || typeof exportData !== "object") {
    throw new Error("Export data must be a non-null object");
  }
  const obj = exportData as Record<string, unknown>;
  let sanitized = whitelistAndSanitize(obj);
  sanitized = truncateStrings(sanitized, MAX_STRING_LENGTH) as Record<string, unknown>;
  const json = JSON.stringify(sanitized);
  if (json.length > MAX_SIZE_BYTES) {
    throw new Error(`Export data exceeds maximum size (${MAX_SIZE_BYTES / 1024}KB)`);
  }
  return sanitized;
}

/**
 * Assert that sanitized data contains no secret-like keys.
 * Call after sanitizeExportData. Throws if secrets detected.
 */
export function assertNoSecrets(sanitized: unknown): void {
  if (hasSecrets(sanitized)) {
    throw new Error("Export data contains disallowed keys (secrets or internal identifiers)");
  }
}
