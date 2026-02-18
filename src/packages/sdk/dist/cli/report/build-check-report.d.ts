/**
 * Build CheckReport from API data and gate result.
 * Normalizes failed cases (truncate, sort), dashboard URL, top N + more.
 */
import type { CheckArgs } from '../check';
import type { QualityLatestData, RunDetailsData } from '../api';
import type { GateResult } from '../gate';
import type { CheckReport } from '../formatters/types';
export type BuildReportInput = {
    args: CheckArgs;
    quality: QualityLatestData;
    runDetails?: RunDetailsData | null;
    gateResult: GateResult;
    requestId?: string;
};
export declare function buildCheckReport(input: BuildReportInput): CheckReport;
