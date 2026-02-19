"use strict";
/**
 * Deterministic ordering for failed cases.
 * Sort by status severity (failed > error > skipped > passed), then by testCaseId asc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortFailedCases = sortFailedCases;
const STATUS_SEVERITY = {
    failed: 0,
    error: 1,
    skipped: 2,
    passed: 3,
};
function sortFailedCases(cases) {
    return [...cases].sort((a, b) => {
        const sevA = STATUS_SEVERITY[a.status?.toLowerCase() ?? ""] ?? 4;
        const sevB = STATUS_SEVERITY[b.status?.toLowerCase() ?? ""] ?? 4;
        if (sevA !== sevB)
            return sevA - sevB;
        const idA = a.testCaseId ?? 0;
        const idB = b.testCaseId ?? 0;
        return idA - idB;
    });
}
