/**
 * evalai doctor — Comprehensive CI/CD readiness checklist.
 *
 * Runs itemized pass/fail checks with exact remediation commands.
 *
 * Exit codes:
 *   0 — All checks passed (ready)
 *   2 — One or more checks failed (not ready)
 *   3 — Infrastructure error (couldn't complete checks)
 *
 * Flags:
 *   --report          Output JSON diagnostic bundle (redacted)
 *   --format <fmt>    Output format: human (default), json
 *   --apiKey <key>    API key (or EVALAI_API_KEY env)
 *   --baseUrl <url>   API base URL
 *   --evaluationId <id>  Evaluation to verify
 *   --baseline <mode> Baseline mode
 */
import { type EvalAIConfig } from "./config";
export declare const DOCTOR_EXIT: {
    readonly READY: 0;
    readonly NOT_READY: 2;
    readonly INFRA_ERROR: 3;
};
export type CheckStatus = "pass" | "fail" | "warn" | "skip";
export interface CheckResult {
    id: string;
    label: string;
    status: CheckStatus;
    message: string;
    remediation?: string;
}
export interface DiagnosticBundle {
    timestamp: string;
    cliVersion: string;
    specVersion: string;
    platform: string;
    nodeVersion: string;
    checks: CheckResult[];
    config: Partial<EvalAIConfig> & {
        path?: string | null;
    };
    baseline: {
        path: string;
        exists: boolean;
        hash?: string;
        schemaVersion?: number;
        stale?: boolean;
    } | null;
    api: {
        reachable: boolean;
        latencyMs?: number;
        scopes?: string[];
    } | null;
    ci: {
        workflowPath: string;
        exists: boolean;
    } | null;
    overall: "ready" | "not_ready" | "infra_error";
}
export interface DoctorFlags {
    report: boolean;
    format: "human" | "json";
    strict: boolean;
    baseUrl: string;
    apiKey: string;
    evaluationId: string;
    baseline: "published" | "previous" | "production";
}
export declare function checkProject(cwd: string): CheckResult;
export declare function checkConfig(cwd: string): CheckResult & {
    config: EvalAIConfig | null;
    configPath: string | null;
};
export declare function checkBaseline(cwd: string): CheckResult & {
    baselineInfo: DiagnosticBundle["baseline"];
};
export declare function checkAuth(apiKey: string): CheckResult;
export declare function checkConnectivity(baseUrl: string, apiKey: string): Promise<CheckResult & {
    latencyMs?: number;
}>;
export declare function checkEvalTarget(evaluationId: string): CheckResult;
export declare function checkEvalAccess(baseUrl: string, apiKey: string, evaluationId: string, baseline: string): Promise<CheckResult>;
export declare function checkCiWiring(cwd: string): CheckResult & {
    ciInfo: DiagnosticBundle["ci"];
};
export declare function checkProviderEnv(): CheckResult;
export declare function runDoctor(argv: string[]): Promise<number>;
