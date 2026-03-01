#!/usr/bin/env node
/**
 * evalgate check — CI/CD evaluation gate
 *
 * Usage:
 *   evalgate check --minScore 92 --evaluationId 42
 *   evalgate check --minScore 90 --maxDrop 5 --evaluationId 42
 *   evalgate check --policy HIPAA --evaluationId 42
 *   evalgate check --baseline published --evaluationId 42
 *
 * Flags:
 *   --minScore <n>       Fail if quality score < n (0-100)
 *   --maxDrop <n>        Fail if score dropped > n points from baseline
 *   --minN <n>           Fail if total test cases < n (low sample size)
 *   --allowWeakEvidence  If false (default), fail when evidenceLevel is 'weak'
 *   --policy <name>      Enforce a compliance policy (e.g. HIPAA, SOC2, GDPR)
 *   --baseline <mode>   Baseline comparison mode: "published" (default), "previous", or "production"
 *   --evaluationId <id>  Required. The evaluation to gate on.
 *   --baseUrl <url>      API base URL (default: EVALGATE_BASE_URL or http://localhost:3000)
 *   --apiKey <key>       API key (default: EVALGATE_API_KEY env var)
 *   --share <mode>       Share link: "always" | "fail" | "never" (default: never)
 *                        fail = create public share link only when gate fails (CI-friendly)
 *   --pr-comment-out <file>  Write PR comment markdown to file (for GitHub Action to post)
 *   --profile <name>         Preset: strict (95/0/30), balanced (90/2/10), fast (85/5/5). Explicit flags override.
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
 *   8  — Gate warned: near-regression (warnDrop ≤ drop < maxDrop)
 *
 * Environment:
 *   EVALGATE_BASE_URL  — API base URL (default: http://localhost:3000)
 *   EVALGATE_API_KEY   — API key for authentication
 */
export { EXIT } from "./constants";
export type FormatType = "human" | "json" | "github";
export type ShareMode = "always" | "fail" | "never";
export interface CheckArgs {
    baseUrl: string;
    apiKey: string;
    minScore: number;
    maxDrop?: number;
    warnDrop?: number;
    minN?: number;
    allowWeakEvidence: boolean;
    evaluationId: string;
    policy?: string;
    baseline: "published" | "previous" | "production" | "auto";
    format: FormatType;
    explain: boolean;
    onFail?: "import";
    share: ShareMode;
    prCommentOut?: string;
    maxCostUsd?: number;
    maxLatencyMs?: number;
    maxCostDeltaUsd?: number;
}
export type ParseArgsResult = {
    ok: true;
    args: CheckArgs;
} | {
    ok: false;
    exitCode: number;
    message: string;
};
export declare function parseArgs(argv: string[]): ParseArgsResult;
export declare function runCheck(args: CheckArgs): Promise<number>;
