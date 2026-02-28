/**
 * CORE-402: Centralized .evalai workspace resolution
 *
 * Provides unified workspace path resolution for all EvalAI CLI commands
 */
/**
 * EvalAI workspace paths
 */
export interface EvalWorkspace {
    /** Project root directory */
    root: string;
    /** .evalai directory */
    evalaiDir: string;
    /** runs directory */
    runsDir: string;
    /** manifest.json path */
    manifestPath: string;
    /** last-run.json path */
    lastRunPath: string;
    /** runs/index.json path */
    indexPath: string;
    /** baseline-run.json path */
    baselinePath: string;
}
/**
 * Resolve EvalAI workspace paths
 */
export declare function resolveEvalWorkspace(projectRoot?: string): EvalWorkspace;
