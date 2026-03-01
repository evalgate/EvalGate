/**
 * CORE-401: Centralized environment detection
 *
 * Provides unified environment detection for all EvalGate CLI commands
 */
/**
 * Check if running in CI environment
 */
export declare function isCI(): boolean;
/**
 * Check if running in GitHub Actions
 */
export declare function isGitHubActions(): boolean;
/**
 * Get GitHub Step Summary path if available
 */
export declare function getGitHubStepSummaryPath(): string | undefined;
/**
 * Check if string looks like a git reference
 */
export declare function isGitRef(ref: string): boolean;
