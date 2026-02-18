/**
 * JSON formatter for evalai check.
 * Outputs only JSON, no extra logs.
 */

import type { CheckReport } from "./types";

export function formatJson(report: CheckReport): string {
  return JSON.stringify(report, null, 0);
}
