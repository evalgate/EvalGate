/**
 * evalgate label — Interactive trace labeling for golden dataset.
 *
 * Steps through traces from a run result, allowing pass/fail labeling
 * and optional failure-mode tagging. Writes to canonical labeled.jsonl.
 *
 * Usage:
 *   evalgate label                             # label latest run
 *   evalgate label --run path/to/run.json      # label specific run
 *   evalgate label --output path/to/labeled.jsonl
 *   evalgate label --format human|json
 *
 * Exit codes:
 *   0 — Completed successfully
 *   1 — Input file not found or invalid
 *   2 — Output write error
 */
export interface LabeledGoldenCase {
    caseId: string;
    input: string;
    expected: string;
    actual: string;
    label: LabeledOutcome;
    failureMode: string | null;
    labeledAt: string;
}
export type LabeledOutcome = "pass" | "fail";
declare const STANDARD_FAILURE_MODES: readonly ["constraint_missing", "tone_mismatch", "hallucination", "invalid_tool_call", "retrieval_error", "format_error", "safety_violation", "logic_error", "incomplete_response", "other"];
export type FailureMode = (typeof STANDARD_FAILURE_MODES)[number] | string;
export interface LabelFlags {
    runPath: string | null;
    outputPath: string | null;
    format: "human" | "json";
}
export declare function parseLabelArgs(args: string[]): LabelFlags;
export declare function runLabel(args: string[]): Promise<number>;
export {};
