/**
 * Regression Attribution Engine v1 — Causal attribution for regressions.
 *
 * When CI detects a regression, this engine analyzes available diff signals
 * and produces a ranked list of likely causes with confidence + evidence.
 *
 * Inputs: git diff, model config diff, prompt diff, tool schema diff,
 *         dataset diff, judge config diff.
 * Output: top N likely causes with confidence + evidence links.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type AttributionSignalType =
	| "git_diff"
	| "model_config"
	| "prompt"
	| "tool_schema"
	| "dataset"
	| "judge_config";

export interface AttributionSignal {
	type: AttributionSignalType;
	/** Human-readable description of what changed */
	description: string;
	/** Evidence supporting this signal (file paths, diff excerpts) */
	evidence: string[];
	/** Raw signal strength (0-1) before weighting */
	strength: number;
}

export interface AttributionCause {
	/** Ranked position (1 = most likely) */
	rank: number;
	type: AttributionSignalType;
	/** Human-readable explanation */
	description: string;
	/** Confidence in this cause (0-1) */
	confidence: number;
	/** Evidence links */
	evidence: string[];
	/** Suggested fix action */
	suggestedAction: string;
}

export interface AttributionReport {
	/** Top N causes, ordered by confidence descending */
	causes: AttributionCause[];
	/** Signals that were analyzed */
	signalsAnalyzed: number;
	/** Whether any high-confidence cause was found (confidence ≥ 0.7) */
	highConfidenceCauseFound: boolean;
	/** Summary string for CI report */
	summary: string;
}

// ── Signal weights ────────────────────────────────────────────────────────────

const SIGNAL_WEIGHTS: Record<AttributionSignalType, number> = {
	prompt: 0.9,
	model_config: 0.85,
	judge_config: 0.8,
	tool_schema: 0.75,
	dataset: 0.7,
	git_diff: 0.6,
};

const SUGGESTED_ACTIONS: Record<AttributionSignalType, string> = {
	prompt: "Review prompt changes and run A/B test against baseline",
	model_config: "Revert model config change or re-evaluate with new model",
	judge_config: "Re-calibrate judge or compare judge outputs before/after",
	tool_schema:
		"Check tool schema changes for breaking changes in output format",
	dataset: "Review dataset modifications and check for distribution shift",
	git_diff: "Review code changes that may affect agent behavior",
};

// ── Input types ───────────────────────────────────────────────────────────────

export interface RegressionDiff {
	/** Files changed in git diff (for git_diff signal) */
	changedFiles?: string[];
	/** Whether model name changed */
	modelChanged?: boolean;
	/** Old and new model names */
	modelDiff?: { from: string | null; to: string | null };
	/** Whether temperature changed */
	temperatureChanged?: boolean;
	/** Whether prompts changed (any prompt file modified) */
	promptsChanged?: boolean;
	/** Prompt files that changed */
	changedPromptFiles?: string[];
	/** Whether tool schemas changed */
	toolSchemaChanged?: boolean;
	/** Changed tool names */
	changedTools?: string[];
	/** Whether dataset changed (test cases added/removed/modified) */
	datasetChanged?: boolean;
	/** Dataset change stats */
	datasetDiff?: { added: number; removed: number; modified: number };
	/** Whether judge config changed */
	judgeConfigChanged?: boolean;
	/** Judge config description */
	judgeConfigDiff?: string;
}

// ── Core attribution ──────────────────────────────────────────────────────────

/**
 * Analyze diff signals and produce a ranked attribution report.
 */
export function attributeRegression(
	diff: RegressionDiff,
	options: { topN?: number } = {},
): AttributionReport {
	const topN = options.topN ?? 3;
	const signals: AttributionSignal[] = [];

	// Prompt signal
	if (diff.promptsChanged) {
		const files = diff.changedPromptFiles ?? [];
		signals.push({
			type: "prompt",
			description: `Prompt changed: ${files.length > 0 ? files.join(", ") : "one or more prompt files"}`,
			evidence: files,
			strength: files.length > 0 ? 0.9 : 0.7,
		});
	}

	// Model config signal
	if (diff.modelChanged || diff.temperatureChanged) {
		const parts: string[] = [];
		if (diff.modelChanged && diff.modelDiff) {
			parts.push(
				`model: ${diff.modelDiff.from ?? "unknown"} → ${diff.modelDiff.to ?? "unknown"}`,
			);
		}
		if (diff.temperatureChanged) {
			parts.push("temperature changed");
		}
		signals.push({
			type: "model_config",
			description: `Model config changed: ${parts.join(", ")}`,
			evidence: parts,
			strength: diff.modelChanged ? 0.9 : 0.6,
		});
	}

	// Judge config signal
	if (diff.judgeConfigChanged) {
		signals.push({
			type: "judge_config",
			description: `Judge configuration changed${diff.judgeConfigDiff ? `: ${diff.judgeConfigDiff}` : ""}`,
			evidence: diff.judgeConfigDiff ? [diff.judgeConfigDiff] : [],
			strength: 0.8,
		});
	}

	// Tool schema signal
	if (diff.toolSchemaChanged) {
		const tools = diff.changedTools ?? [];
		signals.push({
			type: "tool_schema",
			description: `Tool schema changed: ${tools.length > 0 ? tools.join(", ") : "one or more tools"}`,
			evidence: tools,
			strength: 0.75,
		});
	}

	// Dataset signal
	if (diff.datasetChanged && diff.datasetDiff) {
		const d = diff.datasetDiff;
		signals.push({
			type: "dataset",
			description: `Dataset modified: +${d.added} added, -${d.removed} removed, ~${d.modified} modified`,
			evidence: [
				`added: ${d.added}`,
				`removed: ${d.removed}`,
				`modified: ${d.modified}`,
			],
			strength: d.removed > 0 || d.modified > 0 ? 0.75 : 0.5,
		});
	}

	// Git diff signal (catch-all for code changes)
	if (diff.changedFiles && diff.changedFiles.length > 0) {
		const relevantFiles = diff.changedFiles.filter(
			(f) =>
				f.includes("lib/") ||
				f.includes("prompts/") ||
				f.includes("tools/") ||
				f.includes("agents/") ||
				f.includes("evals/"),
		);
		if (relevantFiles.length > 0) {
			signals.push({
				type: "git_diff",
				description: `Relevant code files changed: ${relevantFiles.slice(0, 3).join(", ")}${relevantFiles.length > 3 ? ` (+${relevantFiles.length - 3} more)` : ""}`,
				evidence: relevantFiles,
				strength: Math.min(0.8, 0.4 + relevantFiles.length * 0.05),
			});
		}
	}

	// Score each signal
	const scored = signals
		.map((s) => ({
			signal: s,
			score: s.strength * SIGNAL_WEIGHTS[s.type],
		}))
		.sort((a, b) => b.score - a.score)
		.slice(0, topN);

	const causes: AttributionCause[] = scored.map((item, idx) => ({
		rank: idx + 1,
		type: item.signal.type,
		description: item.signal.description,
		confidence: Math.min(0.99, item.score),
		evidence: item.signal.evidence,
		suggestedAction: SUGGESTED_ACTIONS[item.signal.type],
	}));

	const highConfidenceCauseFound = causes.some((c) => c.confidence >= 0.7);

	const summary =
		causes.length === 0
			? "No clear cause identified — manual investigation required"
			: `Likely cause: ${causes[0]!.description} (${(causes[0]!.confidence * 100).toFixed(0)}% confidence)`;

	return {
		causes,
		signalsAnalyzed: signals.length,
		highConfidenceCauseFound,
		summary,
	};
}

/**
 * Format the attribution report as a human-readable CI summary.
 */
export function formatAttributionReport(report: AttributionReport): string {
	const lines = ["## Regression Attribution", ""];

	if (report.causes.length === 0) {
		lines.push("No likely cause identified. Consider:");
		lines.push("  • Reviewing recent infrastructure changes");
		lines.push("  • Checking for external API changes");
		return lines.join("\n");
	}

	lines.push(
		`**Top likely causes** (${report.signalsAnalyzed} signals analyzed):`,
	);
	lines.push("");

	for (const cause of report.causes) {
		const pct = (cause.confidence * 100).toFixed(0);
		lines.push(`${cause.rank}. **${cause.description}** (${pct}% confidence)`);
		lines.push(`   → ${cause.suggestedAction}`);
		if (cause.evidence.length > 0) {
			lines.push(`   Evidence: ${cause.evidence.slice(0, 3).join(", ")}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}
