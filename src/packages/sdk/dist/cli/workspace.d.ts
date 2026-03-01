/**
 * CORE-402: Centralized .evalgate workspace resolution
 *
 * Provides unified workspace path resolution for all EvalGate CLI commands.
 * Prefers .evalgate/; falls back to .evalai/ for backward compatibility.
 */
/**
 * EvalGate workspace paths
 */
export interface EvalWorkspace {
    /** Project root directory */
    root: string;
    /** .evalgate directory (or .evalai for legacy projects) */
    evalDir: string;
    /** @deprecated Use evalDir */
    evalgateDir: string;
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
 * Resolve EvalGate workspace paths. Prefers .evalgate/, falls back to .evalai/.
 */
export declare function resolveEvalWorkspace(projectRoot?: string): EvalWorkspace;
