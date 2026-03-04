/**
 * evalgate start — Zero-config startup
 *
 * One command to go from nothing to a passing eval run:
 *   npx evalgate start
 *
 * What it does:
 *   1. If no evalgate.config.json, runs init
 *   2. If no manifest, runs discover --manifest
 *   3. Runs evalgate run --write-results
 *   4. Prints results
 *
 * The goal: zero decisions, one command, immediate value.
 */
export interface StartOptions {
    /** Output format */
    format?: "human" | "json";
    /** Skip init if not already set up */
    skipInit?: boolean;
    /** Enable watch mode after first run */
    watch?: boolean;
}
/**
 * Zero-config startup: one command → passing run
 */
export declare function runStart(options?: StartOptions, projectRoot?: string): Promise<number>;
