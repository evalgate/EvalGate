/**
 * GitHub PR Annotations — format eval results as GitHub Check Run annotations
 * and PR comment bodies.
 *
 * Produces the data structures consumed by the GitHub Checks API and
 * PR comment API. HTTP calls are handled by callers so this module
 * remains pure and fully testable.
 *
 * Spec: https://docs.github.com/en/rest/checks/runs#create-a-check-run
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type CheckRunConclusion =
	| "success"
	| "failure"
	| "neutral"
	| "cancelled"
	| "skipped"
	| "timed_out"
	| "action_required";

export type AnnotationLevel = "notice" | "warning" | "failure";

/** A single file-level annotation for the GitHub Checks API */
export interface CheckAnnotation {
	/** Repository-relative path to the file */
	path: string;
	/** Start line number (1-based) */
	startLine: number;
	/** End line number (1-based, inclusive) */
	endLine: number;
	/** Annotation severity level */
	annotationLevel: AnnotationLevel;
	/** Short title */
	title: string;
	/** Detailed message */
	message: string;
	/** Optional raw details (e.g. diff) */
	rawDetails?: string;
}

/** GitHub Check Run output section */
export interface CheckRunOutput {
	title: string;
	summary: string;
	text?: string;
	annotations?: CheckAnnotation[];
}

/** Full Check Run payload for the GitHub API */
export interface CheckRunPayload {
	name: string;
	headSha: string;
	status: "completed";
	conclusion: CheckRunConclusion;
	startedAt: string;
	completedAt: string;
	output: CheckRunOutput;
}

/** An evaluation result for a single test case */
export interface EvalTestResult {
	testCaseId: string;
	/** Display name or label */
	name: string;
	/** 0-1 score */
	score: number;
	/** Whether it passed */
	passed: boolean;
	/** Failure reason if failed */
	failureReason?: string;
	/** Optional file path for annotation */
	filePath?: string;
	/** Optional line number for annotation */
	lineNumber?: number;
}

/** Summary of an evaluation run to include in the PR comment */
export interface EvalRunSummary {
	runId: string;
	evaluationName: string;
	totalTests: number;
	passed: number;
	failed: number;
	skipped: number;
	/** Weighted quality score (0-1) */
	overallScore: number;
	/** ISO timestamp */
	completedAt: string;
	/** Individual test results */
	results: EvalTestResult[];
	/** Baseline score for comparison (null if no baseline) */
	baselineScore: number | null;
	/** Score delta vs baseline (positive = improved) */
	scoreDelta: number | null;
}

export interface PRAnnotationOptions {
	/** GitHub Check name shown in PR UI (default: "EvalAI") */
	checkName?: string;
	/** Pass threshold (0-1, default: 0.6) */
	passThreshold?: number;
	/** Score regression threshold to mark as failure (default: -0.05) */
	regressionThreshold?: number;
	/** Maximum annotations to emit (GitHub limit: 50 per request) */
	maxAnnotations?: number;
	/** Whether to include per-test details in PR comment */
	includeTestDetails?: boolean;
}

// ── Conclusion logic ──────────────────────────────────────────────────────────

/**
 * Determine the GitHub Check Run conclusion from an eval summary.
 */
export function deriveConclusion(
	summary: EvalRunSummary,
	options: PRAnnotationOptions = {},
): CheckRunConclusion {
	const { passThreshold = 0.6, regressionThreshold = -0.05 } = options;

	if (summary.scoreDelta !== null && summary.scoreDelta <= regressionThreshold) {
		return "failure";
	}

	if (summary.overallScore < passThreshold) {
		return "failure";
	}

	if (summary.failed > 0 && summary.overallScore >= passThreshold) {
		return "neutral";
	}

	return "success";
}

// ── Annotations ───────────────────────────────────────────────────────────────

/**
 * Build file annotations for failed test cases that have file paths.
 */
export function buildAnnotations(
	results: EvalTestResult[],
	options: PRAnnotationOptions = {},
): CheckAnnotation[] {
	const { maxAnnotations = 50 } = options;

	const failed = results.filter((r) => !r.passed && r.filePath);

	return failed.slice(0, maxAnnotations).map((result): CheckAnnotation => ({
		path: result.filePath!,
		startLine: result.lineNumber ?? 1,
		endLine: result.lineNumber ?? 1,
		annotationLevel: result.score < 0.3 ? "failure" : "warning",
		title: `Eval failed: ${result.name}`,
		message: result.failureReason
			? `Score: ${(result.score * 100).toFixed(0)}% — ${result.failureReason}`
			: `Score: ${(result.score * 100).toFixed(0)}% (below pass threshold)`,
	}));
}

// ── Check Run payload ─────────────────────────────────────────────────────────

/**
 * Build the full Check Run payload for the GitHub Checks API.
 */
export function buildCheckRunPayload(
	summary: EvalRunSummary,
	headSha: string,
	options: PRAnnotationOptions = {},
): CheckRunPayload {
	const { checkName = "EvalAI" } = options;
	const conclusion = deriveConclusion(summary, options);
	const passRate = summary.totalTests > 0
		? ((summary.passed / summary.totalTests) * 100).toFixed(0)
		: "0";
	const scoreDisplay = `${(summary.overallScore * 100).toFixed(0)}%`;

	const deltaLine = summary.scoreDelta !== null
		? ` | Δ ${summary.scoreDelta >= 0 ? "+" : ""}${(summary.scoreDelta * 100).toFixed(1)}% vs baseline`
		: "";

	const summaryText = [
		`**${summary.evaluationName}** · ${summary.passed}/${summary.totalTests} passed (${passRate}%) · Score: ${scoreDisplay}${deltaLine}`,
	].join("\n");

	const annotations = buildAnnotations(summary.results, options);

	const textLines: string[] = [
		"## Evaluation Results",
		"",
		`| Metric | Value |`,
		`|--------|-------|`,
		`| **Run ID** | \`${summary.runId}\` |`,
		`| **Total Tests** | ${summary.totalTests} |`,
		`| **Passed** | ✅ ${summary.passed} |`,
		`| **Failed** | ${summary.failed > 0 ? `❌ ${summary.failed}` : `✅ 0`} |`,
		`| **Score** | ${scoreDisplay} |`,
	];

	if (summary.scoreDelta !== null) {
		const trend = summary.scoreDelta >= 0 ? "📈" : "📉";
		textLines.push(`| **vs Baseline** | ${trend} ${summary.scoreDelta >= 0 ? "+" : ""}${(summary.scoreDelta * 100).toFixed(1)}% |`);
	}

	return {
		name: checkName,
		headSha,
		status: "completed",
		conclusion,
		startedAt: summary.completedAt,
		completedAt: summary.completedAt,
		output: {
			title: `${summary.evaluationName}: ${scoreDisplay} (${summary.passed}/${summary.totalTests} passed)`,
			summary: summaryText,
			text: textLines.join("\n"),
			annotations: annotations.length > 0 ? annotations : undefined,
		},
	};
}

// ── PR comment body ───────────────────────────────────────────────────────────

/**
 * Build a Markdown PR comment body for eval results.
 * Suitable for posting via the GitHub Issues/PR comments API.
 */
export function buildPRCommentBody(
	summary: EvalRunSummary,
	options: PRAnnotationOptions = {},
): string {
	const { passThreshold = 0.6, includeTestDetails = true } = options;
	const conclusion = deriveConclusion(summary, options);
	const statusEmoji = conclusion === "success" ? "✅" : conclusion === "neutral" ? "⚠️" : "❌";
	const scoreDisplay = `${(summary.overallScore * 100).toFixed(0)}%`;

	const lines: string[] = [
		`## ${statusEmoji} EvalAI Results — ${summary.evaluationName}`,
		"",
		`| | |`,
		`|---|---|`,
		`| **Score** | ${scoreDisplay} |`,
		`| **Tests** | ${summary.passed} / ${summary.totalTests} passed |`,
		`| **Pass threshold** | ${(passThreshold * 100).toFixed(0)}% |`,
	];

	if (summary.scoreDelta !== null && summary.baselineScore !== null) {
		const trendEmoji = summary.scoreDelta >= 0 ? "📈" : "📉";
		lines.push(`| **Baseline** | ${(summary.baselineScore * 100).toFixed(0)}% |`);
		lines.push(`| **Change** | ${trendEmoji} ${summary.scoreDelta >= 0 ? "+" : ""}${(summary.scoreDelta * 100).toFixed(1)}% |`);
	}

	lines.push("", `> Run ID: \`${summary.runId}\` · ${summary.completedAt}`, "");

	if (includeTestDetails && summary.results.length > 0) {
		const failed = summary.results.filter((r) => !r.passed);
		if (failed.length > 0) {
			lines.push("<details>", `<summary>❌ ${failed.length} failed test(s)</summary>`, "");
			lines.push("| Test | Score | Reason |");
			lines.push("|------|-------|--------|");
			for (const r of failed.slice(0, 20)) {
				const reason = r.failureReason ? r.failureReason.slice(0, 80) : "Below threshold";
				lines.push(`| \`${r.name}\` | ${(r.score * 100).toFixed(0)}% | ${reason} |`);
			}
			if (failed.length > 20) {
				lines.push(`| … | | _${failed.length - 20} more_ |`);
			}
			lines.push("", "</details>", "");
		}
	}

	lines.push("---", "_Posted by [EvalAI](https://github.com/pauly7610/ai-evaluation-platform)_");

	return lines.join("\n");
}

// ── Diff summary ──────────────────────────────────────────────────────────────

export interface EvalDiffEntry {
	testCaseId: string;
	name: string;
	previousScore: number;
	currentScore: number;
	scoreDelta: number;
	previousPassed: boolean;
	currentPassed: boolean;
	/** "regressed" | "improved" | "stable" | "newly_failing" | "newly_passing" */
	status: "regressed" | "improved" | "stable" | "newly_failing" | "newly_passing";
}

/**
 * Compute per-test diff between two eval runs.
 */
export function computeEvalDiff(
	previous: EvalTestResult[],
	current: EvalTestResult[],
): EvalDiffEntry[] {
	const prevMap = new Map(previous.map((r) => [r.testCaseId, r]));
	const entries: EvalDiffEntry[] = [];

	for (const curr of current) {
		const prev = prevMap.get(curr.testCaseId);
		if (!prev) continue;

		const delta = curr.score - prev.score;
		let status: EvalDiffEntry["status"];

		if (!prev.passed && curr.passed) status = "newly_passing";
		else if (prev.passed && !curr.passed) status = "newly_failing";
		else if (delta > 0.05) status = "improved";
		else if (delta < -0.05) status = "regressed";
		else status = "stable";

		entries.push({
			testCaseId: curr.testCaseId,
			name: curr.name,
			previousScore: prev.score,
			currentScore: curr.score,
			scoreDelta: delta,
			previousPassed: prev.passed,
			currentPassed: curr.passed,
			status,
		});
	}

	return entries.sort((a, b) => a.scoreDelta - b.scoreDelta);
}
