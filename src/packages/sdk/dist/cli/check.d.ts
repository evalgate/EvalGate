#!/usr/bin/env node
/**
 * evalai check — CI/CD evaluation gate
 *
 * Usage:
 *   evalai check --minScore 92 --evaluationId 42
 *   evalai check --minScore 90 --maxDrop 5 --evaluationId 42
 *   evalai check --policy HIPAA --evaluationId 42
 *   evalai check --baseline published --evaluationId 42
 *
 * Flags:
 *   --minScore <n>       Fail if quality score < n (0-100)
 *   --maxDrop <n>        Fail if score dropped > n points from baseline
 *   --minN <n>           Fail if total test cases < n (low sample size)
 *   --allowWeakEvidence  If false (default), fail when evidenceLevel is 'weak'
 *   --policy <name>      Enforce a compliance policy (e.g. HIPAA, SOC2, GDPR)
 *   --baseline <mode>    Baseline comparison mode: "published" (default) or "previous"
 *   --evaluationId <id>  Required. The evaluation to gate on.
 *   --baseUrl <url>      API base URL (default: EVALAI_BASE_URL or http://localhost:3000)
 *   --apiKey <key>       API key (default: EVALAI_API_KEY env var)
 *
 * Exit codes:
 *   0  — Gate passed
 *   1  — Gate failed: score below threshold
 *   2  — Gate failed: regression exceeded maxDrop
 *   3  — Gate failed: policy violation
 *   4  — API error / network failure
 *   5  — Invalid arguments
 *   6  — Gate failed: total test cases < minN
 *   7  — Gate failed: weak evidence (evidenceLevel === 'weak')
 *
 * Environment:
 *   EVALAI_BASE_URL  — API base URL (default: http://localhost:3000)
 *   EVALAI_API_KEY   — API key for authentication
 */
export declare const EXIT: {
    readonly PASS: 0;
    readonly SCORE_BELOW: 1;
    readonly REGRESSION: 2;
    readonly POLICY_VIOLATION: 3;
    readonly API_ERROR: 4;
    readonly BAD_ARGS: 5;
    readonly LOW_N: 6;
    readonly WEAK_EVIDENCE: 7;
};
export interface CheckArgs {
    baseUrl: string;
    apiKey: string;
    minScore: number;
    maxDrop?: number;
    minN?: number;
    allowWeakEvidence: boolean;
    evaluationId: string;
    policy?: string;
    baseline: 'published' | 'previous';
}
export declare function parseArgs(argv: string[]): CheckArgs;
export declare function runCheck(args: CheckArgs): Promise<number>;
