/**
 * Human-readable formatter for evalai check output.
 * Deterministic: verdict → score → failures → link → hint.
 */
import type { CheckReport } from './types';
export declare function formatHuman(report: CheckReport): string;
