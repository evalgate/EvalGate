/**
 * Build CheckReport from API data and gate result.
 * Normalizes failed cases (truncate, sort), dashboard URL, top N + more.
 */
import type { QualityLatestData, RunDetailsData } from "../api";
import type { CheckArgs } from "../check";
import { type CheckReport } from "../formatters/types";
import type { GateResult } from "../gate";
export type BuildReportInput = {
    args: CheckArgs;
    quality: QualityLatestData;
    runDetails?: RunDetailsData | null;
    gateResult: GateResult;
    requestId?: string;
    shareUrl?: string;
    baselineRunId?: number | null;
    ciRunUrl?: string | null;
};
export declare function buildCheckReport(input: BuildReportInput): CheckReport;
