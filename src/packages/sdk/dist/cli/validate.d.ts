/**
 * evalgate validate — static validation of spec files without execution
 *
 * The equivalent of `tsc --noEmit` for eval specs. Catches:
 * - Missing or malformed defineEval calls
 * - Executor functions that don't return EvalResult shape
 * - Invalid spec names (characters, length)
 * - Empty spec files
 * - Missing required fields in config-form defineEval
 *
 * Usage:
 *   evalgate validate
 *   evalgate validate --format json
 */
export interface ValidationIssue {
    /** Severity: error blocks CI, warn is informational */
    severity: "error" | "warn";
    /** File where the issue was found */
    file: string;
    /** Line number (1-indexed), if available */
    line?: number;
    /** Short error code */
    code: string;
    /** Human-readable message */
    message: string;
}
export interface ValidateResult {
    /** Total spec files scanned */
    filesScanned: number;
    /** Spec files with issues */
    filesWithIssues: number;
    /** All issues found */
    issues: ValidationIssue[];
    /** Whether validation passed (no errors; warnings are OK) */
    passed: boolean;
}
export declare function runValidate(args?: string[]): Promise<ValidateResult>;
