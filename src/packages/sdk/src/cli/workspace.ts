/**
 * CORE-402: Centralized .evalgate workspace resolution
 *
 * Provides unified workspace path resolution for all EvalGate CLI commands.
 * Prefers .evalgate/; falls back to .evalai/ for backward compatibility.
 */

import * as fs from "node:fs";
import * as path from "node:path";

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
export function resolveEvalWorkspace(
	projectRoot: string = process.cwd(),
): EvalWorkspace {
	const evalgateDir = path.join(projectRoot, ".evalgate");
	const evalaiDir = path.join(projectRoot, ".evalai");
	const useLegacy = fs.existsSync(evalaiDir) && !fs.existsSync(evalgateDir);
	const evalDir = useLegacy ? evalaiDir : evalgateDir;
	if (useLegacy && !(process as any).__EVALGATE_LEGACY_EVALAI_WARNED) {
		console.warn(
			"[EvalGate] Deprecation: .evalai/ is deprecated. Migrate to .evalgate/ (e.g. mv .evalai .evalgate).",
		);
		(process as any).__EVALGATE_LEGACY_EVALAI_WARNED = true;
	}
	const runsDir = path.join(evalDir, "runs");

	return {
		root: projectRoot,
		evalDir,
		evalgateDir: evalDir,
		runsDir,
		manifestPath: path.join(evalDir, "manifest.json"),
		lastRunPath: path.join(evalDir, "last-run.json"),
		indexPath: path.join(runsDir, "index.json"),
		baselinePath: path.join(evalDir, "baseline-run.json"),
	};
}
