/**
 * evalai gate — Run the regression gate
 *
 * Delegates to the project's eval:regression-gate npm script.
 * Supports --format json to output the regression-report.json contents.
 */
export interface GateArgs {
    format: "human" | "json" | "github";
}
export declare function parseGateArgs(argv: string[]): GateArgs;
export declare function runGate(argv: string[]): number;
