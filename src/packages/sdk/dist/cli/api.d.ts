/**
 * API fetch helpers for evalgate check.
 * Captures x-request-id from response headers.
 * Sends X-EvalGate-SDK-Version and X-EvalGate-Spec-Version on all requests.
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
    judgeAlignment?: {
        tpr?: number;
        tnr?: number;
        sampleSize?: number;
        rawPassRate?: number;
        correctedPassRate?: number;
        ci95?: {
            low?: number;
            high?: number;
        } | null;
        correctionApplied?: boolean;
        correctionSkippedReason?: "judge_too_weak_to_correct";
        ciApplied?: boolean;
        ciSkippedReason?: "judge_too_weak_to_correct" | "insufficient_samples_for_ci";
        discriminativePower?: number;
        failureModes?: Record<string, number>;
        totalFailed?: number;
    };
    flags?: string[];
    evaluationRunId?: number;
    evaluationId?: number;
    avgLatencyMs?: number | null;
    costUsd?: number | null;
    baselineCostUsd?: number | null;
    baselineRunId?: number | null;
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
export interface FetchOptions {
    apiKey: string;
    baseUrl: string;
    method?: string;
    body?: Record<string, unknown>;
}
/**
 * Generic authenticated fetch to any API endpoint.
 * Used by promote, replay, and doctor CLI commands.
 */
export declare function fetchAPI(path: string, opts: FetchOptions): Promise<Record<string, unknown>>;
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
    provider?: "github" | "gitlab" | "circle" | "unknown";
    repo?: string;
    sha?: string;
    branch?: string;
    pr?: number;
    runUrl?: string;
    actor?: string;
};
export type ImportResult = {
    testCaseId: number;
    status: "passed" | "failed";
    output: string;
    latencyMs?: number;
    costUsd?: number;
    assertionsJson?: Record<string, unknown>;
};
export type PublishShareResult = {
    shareId: string;
    shareUrl: string;
    shareScope: string;
};
export declare function fetchRunExport(baseUrl: string, apiKey: string, evaluationId: string, runId: number): Promise<{
    ok: true;
    exportData: Record<string, unknown>;
} | {
    ok: false;
    status: number;
    body: string;
}>;
export declare function publishShare(baseUrl: string, apiKey: string, evaluationId: string, exportData: Record<string, unknown>, evaluationRunId: number, options?: {
    expiresInDays?: number;
}): Promise<{
    ok: true;
    data: PublishShareResult;
} | {
    ok: false;
    status: number;
    body: string;
}>;
export declare function importRunOnFail(baseUrl: string, apiKey: string, evaluationId: string, results: ImportResult[], options: {
    idempotencyKey?: string;
    ci?: CiContext;
    importClientVersion?: string;
    checkReport?: Record<string, unknown>;
}): Promise<{
    ok: true;
    runId: number;
} | {
    ok: false;
    status: number;
    body: string;
}>;
