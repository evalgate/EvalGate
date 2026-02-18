/**
 * Deterministic ordering for failed cases.
 * Sort by status severity (failed > error > skipped > passed), then by testCaseId asc.
 */
export interface SortableCase {
    status?: string;
    testCaseId?: number;
    [key: string]: unknown;
}
export declare function sortFailedCases<T extends SortableCase>(cases: T[]): T[];
