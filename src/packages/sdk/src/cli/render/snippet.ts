/**
 * Truncate a string for deterministic output.
 * Replaces newlines with space, caps length.
 */

export function truncateSnippet(s: string | undefined | null, maxLen = 140): string {
  if (s == null) return "";
  const normalized = s.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen)}…`;
}
