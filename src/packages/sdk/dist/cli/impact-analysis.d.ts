/**
 * TICKET 3 — Impact Analysis CLI Command (v0)
 *
 * Goal: Modal-like perceived speed via incremental intelligence
 *
 * Algorithm v0 (practical, shippable):
 * - Inputs: manifest.json + git diff --name-only base...HEAD
 * - Rules: Direct file mapping, dependency tracking, safe fallback
 * - Output: Human-readable counts + JSON for automation
 */
import type { EvaluationManifest } from "./manifest";
/**
 * Impact analysis result
 */
export interface ImpactAnalysisResult {
    /** Impacted specification IDs */
    impactedSpecIds: string[];
    /** Reason for each impacted spec */
    reasonBySpecId: Record<string, string>;
    /** Changed files that triggered the analysis */
    changedFiles: string[];
    /** Analysis metadata */
    metadata: {
        baseBranch: string;
        totalSpecs: number;
        impactedCount: number;
        analysisTime: number;
    };
}
/**
 * Impact analysis options
 */
export interface ImpactAnalysisOptions {
    /** Base branch to compare against */
    baseBranch: string;
    /** Optional explicit list of changed files (for CI) */
    changedFiles?: string[];
    /** Output format */
    format?: "human" | "json";
}
/**
 * Run impact analysis
 */
export declare function runImpactAnalysis(options: ImpactAnalysisOptions, projectRoot?: string): Promise<ImpactAnalysisResult>;
/**
 * Analyze impact of changed files
 */
export declare function analyzeImpact(changedFiles: string[], manifest: EvaluationManifest): {
    impactedSpecIds: string[];
    reasonBySpecId: Record<string, string>;
};
/**
 * Print human-readable results
 */
export declare function printHumanResults(result: ImpactAnalysisResult): void;
/**
 * Print JSON results
 */
export declare function printJsonResults(result: ImpactAnalysisResult): void;
/**
 * CLI entry point
 */
export declare function runImpactAnalysisCLI(options: ImpactAnalysisOptions): Promise<void>;
