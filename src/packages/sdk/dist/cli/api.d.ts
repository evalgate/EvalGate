/**
 * API fetch helpers for evalai check.
 * Captures x-request-id from response headers.
 */
export type QualityLatestData = {
    score?: number;
    total?: number | null;
    evidenceLevel?: string | null;
    baselineScore?: number | null;
    regressionDelta?: number | null;
    baselineMissing?: boolean | null;
    breakdown?: {
        passRate?: number;
        safety?: number;
        judge?: number;
    };
    flags?: string[];
    evaluationRunId?: number;
    evaluationId?: number;
};
export type RunDetailsData = {
    results?: Array<{
        testCaseId?: number;
        status?: string;
        output?: string;
        durationMs?: number;
        assertionsJson?: Record<string, unknown>;
        test_cases?: {
            name?: string;
            input?: string;
            expectedOutput?: string;
        };
    }>;
};
export declare function fetchQualityLatest(baseUrl: string, apiKey: string, evaluationId: string, baseline: string): Promise<{
    ok: true;
    data: QualityLatestData;
    requestId?: string;
} | {
    ok: false;
    status: number;
    body: string;
    requestId?: string;
}>;
export declare function fetchRunDetails(baseUrl: string, apiKey: string, evaluationId: string, runId: number): Promise<{
    ok: true;
    data: RunDetailsData;
} | {
    ok: false;
}>;
export type CiContext = {
    provider?: 'github' | 'gitlab' | 'circle' | 'unknown';
    repo?: string;
    sha?: string;
    branch?: string;
    pr?: number;
    runUrl?: string;
    actor?: string;
};
export type ImportResult = {
    testCaseId: number;
    status: 'passed' | 'failed';
    output: string;
    latencyMs?: number;
    costUsd?: number;
    assertionsJson?: Record<string, unknown>;
};
export declare function importRunOnFail(baseUrl: string, apiKey: string, evaluationId: string, results: ImportResult[], options: {
    idempotencyKey?: string;
    ci?: CiContext;
    importClientVersion?: string;
}): Promise<{
    ok: true;
    runId: number;
} | {
    ok: false;
    status: number;
    body: string;
}>;
