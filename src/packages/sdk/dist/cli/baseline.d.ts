/**
 * evalai baseline — Baseline management commands
 *
 * Subcommands:
 *   evalai baseline init    — Create a starter evals/baseline.json
 *   evalai baseline update  — Run tests + update baseline with real scores
 */
export declare function runBaselineInit(cwd: string): number;
export declare function runBaselineUpdate(cwd: string): number;
export declare function runBaseline(argv: string[]): number;
