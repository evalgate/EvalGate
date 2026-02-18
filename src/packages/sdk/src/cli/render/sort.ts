/**
 * Deterministic ordering for failed cases.
 * Sort by status severity (failed > error > skipped > passed), then by testCaseId asc.
 */

const STATUS_SEVERITY: Record<string, number> = {
  failed: 0,
  error: 1,
  skipped: 2,
  passed: 3,
};

export interface SortableCase {
  status?: string;
  testCaseId?: number;
  [key: string]: unknown;
}

export function sortFailedCases<T extends SortableCase>(cases: T[]): T[] {
  return [...cases].sort((a, b) => {
    const sevA = STATUS_SEVERITY[a.status?.toLowerCase() ?? ''] ?? 4;
    const sevB = STATUS_SEVERITY[b.status?.toLowerCase() ?? ''] ?? 4;
    if (sevA !== sevB) return sevA - sevB;
    const idA = a.testCaseId ?? 0;
    const idB = b.testCaseId ?? 0;
    return idA - idB;
  });
}
