"use strict";
/**
 * Truncate a string for deterministic output.
 * Replaces newlines with space, caps length.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.truncateSnippet = truncateSnippet;
function truncateSnippet(s, maxLen = 140) {
    if (s == null)
        return "";
    const normalized = s.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLen)
        return normalized;
    return `${normalized.slice(0, maxLen)}…`;
}
