/**
 * GitHub formatter for evalai check.
 * - stdout: minimal (verdict + score + link) + ::error annotations for failed cases
 * - Step summary: full Markdown written to GITHUB_STEP_SUMMARY (not stdout)
 */
import type { CheckReport } from './types';
export declare function appendStepSummary(report: CheckReport): void;
export declare function formatGitHub(report: CheckReport): string;
