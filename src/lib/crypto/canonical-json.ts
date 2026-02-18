/**
 * Canonical JSON — deterministic serialization for hashing.
 * Sorts object keys recursively for reproducible output.
 */

export function canonicalizeJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonicalizeJson(v)).join(',') + ']';
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const pairs = Object.keys(obj)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonicalizeJson(obj[k]));
    return '{' + pairs.join(',') + '}';
  }

  return 'null';
}
