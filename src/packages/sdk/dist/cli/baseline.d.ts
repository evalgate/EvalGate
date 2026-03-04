/**
 * evalai baseline — Baseline management commands
 *
 * Subcommands:
 *   evalgate baseline init    — Create a starter evals/baseline.json
 *   evalgate baseline update  — Run tests + update baseline with real scores
 */
/**
 * Compute a SHA-256 checksum of the baseline data (excluding the _checksum field).
 * This detects accidental corruption or manual tampering between runs.
 */
export declare function computeBaselineChecksum(data: Record<string, unknown>): string;
/**
 * Verify the checksum stored in a baseline file matches its content.
 * Returns { valid: true } if checksum matches or is absent (legacy files).
 * Returns { valid: false, reason } if checksum is present but doesn't match.
 */
export declare function verifyBaselineChecksum(data: Record<string, unknown>): {
    valid: boolean;
    reason?: string;
};
export declare function runBaselineInit(cwd: string): number;
export declare function runBaselineUpdate(cwd: string): number;
export declare function runBaseline(argv: string[]): number;
