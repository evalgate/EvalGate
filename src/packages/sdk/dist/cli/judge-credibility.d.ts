export declare const MIN_DISCRIMINATIVE_POWER = 0.05;
export declare const MIN_BOOTSTRAP_SAMPLE_SIZE = 30;
export type CorrectionGuardReason = "judge_too_weak_to_correct" | "insufficient_samples_for_ci";
export interface CorrectedPassRateResult {
    rawPassRate: number;
    correctedPassRate: number;
    applied: boolean;
    discriminativePower: number;
    warning?: CorrectionGuardReason;
}
export interface CorrectedPassRateInput {
    rawPassRate: number;
    tpr: number;
    tnr: number;
    nearRandomThreshold?: number;
}
export interface BootstrapCIInput {
    outcomes: boolean[];
    tpr: number;
    tnr: number;
    iterations: number;
    seed: number;
    minSampleSizeForCI?: number;
    nearRandomThreshold?: number;
}
export interface BootstrapCIResult {
    low?: number;
    high?: number;
    applied: boolean;
    warning?: CorrectionGuardReason;
}
export declare function computeCorrectedPassRate(input: CorrectedPassRateInput): CorrectedPassRateResult;
export declare function computeBootstrapCI(input: BootstrapCIInput): BootstrapCIResult;
