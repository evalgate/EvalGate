/**
 * JSON formatter for evalgate check.
 * Outputs only JSON, no extra logs.
 */
import type { CheckReport } from "./types";
export declare function formatJson(report: CheckReport): string;
