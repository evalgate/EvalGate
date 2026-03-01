/**
 * evalai baseline — Baseline management commands
 *
 * Subcommands:
 *   evalgate baseline init    — Create a starter evals/baseline.json
 *   evalgate baseline update  — Run tests + update baseline with real scores
 */
export declare function runBaselineInit(cwd: string): number;
export declare function runBaselineUpdate(cwd: string): number;
export declare function runBaseline(argv: string[]): number;
