#!/usr/bin/env node
/**
 * evalgate init — Full project scaffolder
 *
 * Zero-to-gate in under 5 minutes:
 *   npx evalgate init
 *   git push
 *   …CI starts blocking regressions.
 *
 * What it does:
 *   1. Detects Node repo + package manager
 *   2. Creates evals/ directory + baseline.json
 *   3. Installs .github/workflows/evalgate-gate.yml
 *   4. Prints next steps (no docs required)
 */
export declare function runInit(cwd?: string): boolean;
