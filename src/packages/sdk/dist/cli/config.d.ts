/**
 * EvalGate config loader
 * Discovery: evalgate.config.json → evalgate.config.js → evalgate.config.cjs → package.json evalgate
 */
import { type ProfileName } from "./profiles";
export interface JudgeSplitConfig {
    train?: number;
    dev?: number;
    test?: number;
}
export interface JudgeAlignmentThresholdsConfig {
    tprMin?: number;
    tnrMin?: number;
    minLabeledSamples?: number;
}
export interface JudgeConfig {
    labeledDatasetPath?: string;
    split?: JudgeSplitConfig;
    alignmentThresholds?: JudgeAlignmentThresholdsConfig;
    bootstrapIterations?: number;
    bootstrapSeed?: number;
}
export interface FailureModeImpact {
    /** Impact weight for prioritization (higher = more critical) */
    weight: number;
    /** Alert threshold: fail if count exceeds this number */
    alertThreshold?: number;
    /** Alert threshold: fail if percentage exceeds this value (0-1) */
    alertThresholdPercent?: number;
}
export interface FailureModeAlertsConfig {
    /** Per-failure-mode impact weights and alert thresholds */
    modes: Record<string, FailureModeImpact>;
    /** Global alert threshold: fail if any failure mode exceeds this */
    globalAlertThreshold?: number;
    /** Global alert threshold: fail if total failure percentage exceeds this (0-1) */
    globalAlertThresholdPercent?: number;
}
export interface CostSource {
    provider: "stripe" | "manual";
    stripeMeterId?: string;
    manualPricePerTrace?: number;
}
export interface NormalizedBudgetConfig {
    /** Budget mode: traces (simple) or cost (economically accurate) */
    mode: "traces" | "cost";
    /** Maximum number of traces to run */
    maxTraces?: number;
    /** Maximum cost in USD */
    maxCostUsd?: number;
    /** Cost data source when mode is "cost" */
    costSource?: CostSource;
}
export interface EvalAIConfig {
    evaluationId?: string;
    apiKey?: string;
    baseUrl?: string;
    minScore?: number;
    minN?: number;
    maxDrop?: number;
    warnDrop?: number;
    allowWeakEvidence?: boolean;
    baseline?: "published" | "previous" | "production" | "auto";
    profile?: ProfileName;
    judge?: JudgeConfig;
    failureModeAlerts?: FailureModeAlertsConfig;
    normalizedBudget?: NormalizedBudgetConfig;
    /** Monorepo: package path → config. Key = path relative to config dir (e.g. "apps/web", "packages/api"). */
    packages?: Record<string, Partial<EvalAIConfig>>;
}
/**
 * Find config file path in directory, walking up to root
 */
export declare function findConfigPath(cwd?: string): string | null;
/**
 * Load config from file system
 */
export declare function loadConfig(cwd?: string): EvalAIConfig | null;
/**
 * Check failure mode alert thresholds and return alert messages for any breaches.
 */
export declare function checkFailureModeAlerts(failureModes: Record<string, number>, totalFailed: number, config: FailureModeAlertsConfig): string[];
/**
 * Merge config with CLI args. Priority: args > profile > config > defaults.
 */
export declare function mergeConfigWithArgs(config: EvalAIConfig | null, args: Partial<Record<string, string | number | boolean>>): Partial<EvalAIConfig>;
