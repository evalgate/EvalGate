#!/usr/bin/env node
/**
 * evalgate replay-decision — Compare two runs and make keep/discard decisions
 *
 * Usage:
 *   evalgate replay-decision --previous run-123.json --current run-456.json
 *   evalgate replay-decision --baseline latest --current run-456.json
 *
 * Exit codes:
 *   0 — Decision: KEEP (pass rate improved within budget)
 *   1 — Decision: DISCARD (pass rate declined or budget exceeded)
 *   2 — Error (invalid inputs, missing files, etc.)
 */
export declare function runReplayDecision(argv: string[]): Promise<number>;
