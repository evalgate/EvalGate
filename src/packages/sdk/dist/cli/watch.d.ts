/**
 * Watch mode for evalgate run
 *
 * Re-executes evaluation specs when source files change.
 * Uses Node.js fs.watch with debouncing to avoid rapid re-runs.
 */
import type { RunOptions } from "./run";
export interface WatchOptions extends RunOptions {
    /** Debounce interval in milliseconds (default: 300) */
    debounceMs?: number;
    /** Additional directories to watch beyond spec files */
    extraWatchDirs?: string[];
    /** Clear terminal between runs */
    clearScreen?: boolean;
}
/**
 * Start watch mode — runs evaluations and re-runs on file changes
 */
export declare function runWatch(options: WatchOptions, projectRoot?: string): Promise<void>;
