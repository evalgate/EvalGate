/**
 * evalgate gate — Run the regression gate
 *
 * Two modes:
 *   1. Project mode: delegates to eval:regression-gate npm script (full gate)
 *   2. Built-in mode: runs `npm test`, compares against evals/baseline.json
 *
 * Built-in mode activates when no eval:regression-gate script is defined,
 * making `npx evalgate gate` work for any project after `npx evalgate init`.
 */
export interface GateArgs {
    format: "human" | "json" | "github";
}
export declare function parseGateArgs(argv: string[]): GateArgs;
export declare function runGate(argv: string[]): number;
