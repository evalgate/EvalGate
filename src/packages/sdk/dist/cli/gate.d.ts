/**
 * Pure gate evaluation. No console output.
 * Baseline missing → configuration failure (BAD_ARGS), not API_ERROR.
 */
import type { QualityLatestData } from "./api";
import type { CheckArgs } from "./check";
export type GateResult = {
    exitCode: number;
    passed: boolean;
    reasonCode: string;
    reasonMessage: string | null;
};
export declare function evaluateGate(args: CheckArgs, quality: QualityLatestData): GateResult;
