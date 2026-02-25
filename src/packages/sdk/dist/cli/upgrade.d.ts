/**
 * evalai upgrade --full — Upgrade from Tier 1 (built-in gate) to Tier 2 (full gate)
 *
 * What it does:
 *   1. Adds full regression gate script (scripts/regression-gate.ts)
 *   2. Adds baseline governance workflow (.github/workflows/baseline-governance.yml)
 *   3. Updates package.json with eval:regression-gate + eval:baseline-update scripts
 *   4. Updates .github/workflows/evalai-gate.yml to use project mode
 *   5. Prints next steps
 */
export interface UpgradeArgs {
    full: boolean;
}
export declare function parseUpgradeArgs(argv: string[]): UpgradeArgs;
export declare function runUpgrade(argv: string[]): number;
