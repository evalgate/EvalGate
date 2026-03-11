import * as path from "node:path";

import {
	type AutoDecision,
	type AutoExperimentDetails,
	type AutoLedgerEntry,
	readAutoExperimentDetails,
	readAutoLedgerEntries,
	resolveAutoWorkspacePaths,
} from "./auto-ledger";
import { readAutoProgram } from "./auto-program";

export type AutoHistorySortKey =
	| "timestamp"
	| "utility"
	| "objectiveReductionRatio"
	| "passRateDeltaRatio"
	| "durationMs";

export type AutoHistorySortDirection = "asc" | "desc";

export interface AutoHistoryFilter {
	decision?: AutoDecision;
	sessionId?: string;
	targetFailureMode?: string;
	mutationFamily?: string;
	limit?: number;
}

export interface AutoHistorySort {
	by?: AutoHistorySortKey;
	direction?: AutoHistorySortDirection;
}

export interface AutoHistoryRow {
	experimentId: string;
	timestamp: string;
	sessionId: string;
	decision: AutoDecision;
	targetFailureMode: string;
	mutationFamily: string;
	utilityScore: number | null;
	objectiveReductionRatio: number;
	passRateDeltaRatio: number;
	holdoutRegressions: number;
	regressions: number;
	improvements: number;
}

export interface AutoHistoryFamilyWinRate {
	mutationFamily: string;
	wins: number;
	attempts: number;
	winRate: number | null;
}

export interface AutoHistoryVetoReasonCount {
	reason: string;
	count: number;
}

export interface AutoHistoryBestExperiment {
	experimentId: string;
	utilityScore: number;
	targetFailureMode: string;
	baselineObjectiveRate: number;
	candidateObjectiveRate: number;
	objectiveRateDelta: number;
}

export interface AutoHistoryBudgetSummary {
	usedCostUsd: number;
	costLimitUsd: number | null;
	usedIterations: number;
	iterationLimit: number | null;
	remainingCostUsd: number | null;
	remainingIterations: number | null;
}

export interface AutoHistorySummaryOptions {
	projectRoot?: string;
}

export interface FormatAutoHistoryOptions extends AutoHistorySummaryOptions {}

export interface AutoHistorySummary {
	total: number;
	decisions: Record<AutoDecision, number>;
	bestUtilityScore: number | null;
	kept: number;
	vetoed: number;
	targetLabel: string;
	bestExperiment: AutoHistoryBestExperiment | null;
	familyWinRates: AutoHistoryFamilyWinRate[];
	vetoReasons: AutoHistoryVetoReasonCount[];
	budget: AutoHistoryBudgetSummary;
}

export interface AutoHistoryInspectResult {
	entry: AutoLedgerEntry;
	details: AutoExperimentDetails | null;
	absoluteDetailsPath: string;
}

function compareNullableNumber(
	left: number | null,
	right: number | null,
	direction: AutoHistorySortDirection,
): number {
	if (left === null && right === null) {
		return 0;
	}
	if (left === null) {
		return 1;
	}
	if (right === null) {
		return -1;
	}
	return direction === "asc" ? left - right : right - left;
}

function compareNumber(
	left: number,
	right: number,
	direction: AutoHistorySortDirection,
): number {
	return direction === "asc" ? left - right : right - left;
}

function compareString(
	left: string,
	right: string,
	direction: AutoHistorySortDirection,
): number {
	return direction === "asc"
		? left.localeCompare(right)
		: right.localeCompare(left);
}

function formatRatioAsPercent(ratio: number): string {
	return `${(ratio * 100).toFixed(1)}%`;
}

function formatWholeFriendlyPercent(ratio: number): string {
	const percent = ratio * 100;
	return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1)}%`;
}

function formatSignedRatioAsPercent(ratio: number): string {
	const normalized =
		Object.is(ratio, -0) || Math.abs(ratio) < 0.0000001 ? 0 : ratio;
	const sign = normalized > 0 ? "+" : "";
	return `${sign}${(normalized * 100).toFixed(1)}%`;
}

function formatNullableScore(value: number | null): string {
	if (value === null) {
		return "n/a";
	}
	return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

function formatUsd(value: number): string {
	return `$${value.toFixed(2)}`;
}

function formatDecisionLabel(decision: AutoDecision): string {
	if (decision === "keep") {
		return "kept";
	}
	if (decision === "discard") {
		return "discarded";
	}
	return decision;
}

function formatRegressionLabel(entry: AutoLedgerEntry): string {
	if (entry.holdoutRegressions > 0 && entry.regressions === 0) {
		return `${entry.holdoutRegressions} (holdout)`;
	}
	if (entry.holdoutRegressions > 0) {
		return `${entry.regressions + entry.holdoutRegressions} (${entry.holdoutRegressions} holdout)`;
	}
	return String(entry.regressions);
}

function padCell(value: string, width: number): string {
	return value.length >= width ? value : value.padEnd(width, " ");
}

function getTargetLabel(entries: AutoLedgerEntry[]): string {
	const targets = new Set(entries.map((entry) => entry.targetFailureMode));
	if (targets.size === 1) {
		return entries[0]?.targetFailureMode ?? "unknown";
	}
	return "multiple";
}

function shouldCountFamilyAttempt(decision: AutoDecision): boolean {
	return decision === "keep" || decision === "discard" || decision === "vetoed";
}

function buildFamilyWinRates(
	entries: AutoLedgerEntry[],
): AutoHistoryFamilyWinRate[] {
	const familyCounts = new Map<string, { wins: number; attempts: number }>();
	for (const entry of entries) {
		const current = familyCounts.get(entry.mutationFamily) ?? {
			wins: 0,
			attempts: 0,
		};
		if (entry.decision === "keep") {
			current.wins += 1;
		}
		if (shouldCountFamilyAttempt(entry.decision)) {
			current.attempts += 1;
		}
		familyCounts.set(entry.mutationFamily, current);
	}
	return [...familyCounts.entries()]
		.map(([mutationFamily, counts]) => ({
			mutationFamily,
			wins: counts.wins,
			attempts: counts.attempts,
			winRate: counts.attempts === 0 ? null : counts.wins / counts.attempts,
		}))
		.sort((left, right) => {
			if (right.attempts !== left.attempts) {
				return right.attempts - left.attempts;
			}
			if (right.wins !== left.wins) {
				return right.wins - left.wins;
			}
			return left.mutationFamily.localeCompare(right.mutationFamily);
		});
}

function buildVetoReasonCounts(
	entries: AutoLedgerEntry[],
): AutoHistoryVetoReasonCount[] {
	const counts = new Map<string, number>();
	for (const entry of entries) {
		if (entry.decision !== "vetoed" || entry.hardVetoReason === null) {
			continue;
		}
		counts.set(
			entry.hardVetoReason,
			(counts.get(entry.hardVetoReason) ?? 0) + 1,
		);
	}
	return [...counts.entries()]
		.map(([reason, count]) => ({ reason, count }))
		.sort((left, right) => {
			if (right.count !== left.count) {
				return right.count - left.count;
			}
			return left.reason.localeCompare(right.reason);
		});
}

function selectBestExperiment(
	entries: AutoLedgerEntry[],
): AutoHistoryBestExperiment | null {
	const preferredPool = entries.filter(
		(entry) => entry.decision === "keep" && entry.utilityScore !== null,
	);
	const fallbackPool = entries.filter((entry) => entry.utilityScore !== null);
	const candidates = preferredPool.length > 0 ? preferredPool : fallbackPool;
	let bestEntry: AutoLedgerEntry | null = null;
	for (const entry of candidates) {
		if (
			bestEntry === null ||
			(entry.utilityScore ?? Number.NEGATIVE_INFINITY) >
				(bestEntry.utilityScore ?? Number.NEGATIVE_INFINITY) ||
			((entry.utilityScore ?? Number.NEGATIVE_INFINITY) ===
				(bestEntry.utilityScore ?? Number.NEGATIVE_INFINITY) &&
				entry.timestamp > bestEntry.timestamp)
		) {
			bestEntry = entry;
		}
	}
	if (!bestEntry || bestEntry.utilityScore === null) {
		return null;
	}
	return {
		experimentId: bestEntry.experimentId,
		utilityScore: bestEntry.utilityScore,
		targetFailureMode: bestEntry.targetFailureMode,
		baselineObjectiveRate: bestEntry.baselineObjectiveRate,
		candidateObjectiveRate: bestEntry.candidateObjectiveRate,
		objectiveRateDelta:
			bestEntry.candidateObjectiveRate - bestEntry.baselineObjectiveRate,
	};
}

function readBudgetNumber(
	budget: Record<string, unknown>,
	keys: string[],
): number | null {
	for (const key of keys) {
		const value = budget[key];
		if (typeof value === "number" && Number.isFinite(value)) {
			return value;
		}
	}
	return null;
}

function summarizeBudget(
	entries: AutoLedgerEntry[],
	projectRoot?: string,
): AutoHistoryBudgetSummary {
	const usedCostUsd = entries.reduce((sum, entry) => sum + entry.costUsd, 0);
	const usedIterations = entries.filter(
		(entry) => entry.decision !== "plan",
	).length;
	let iterationLimit: number | null = null;
	let costLimitUsd: number | null = null;
	if (projectRoot) {
		const programPath = resolveAutoWorkspacePaths(projectRoot).programPath;
		const programResult = readAutoProgram(programPath, {
			strictTopLevel: false,
		});
		if (programResult.program) {
			const budget = programResult.program.budget as Record<string, unknown>;
			const parsedIterationLimit = readBudgetNumber(budget, [
				"max_experiments",
				"max_iterations",
				"maxIterations",
			]);
			if (
				parsedIterationLimit !== null &&
				Number.isInteger(parsedIterationLimit) &&
				parsedIterationLimit > 0
			) {
				iterationLimit = parsedIterationLimit;
			}
			const parsedCostLimitUsd = readBudgetNumber(budget, [
				"max_cost_usd",
				"maxCostUsd",
				"cost_usd",
				"costUsd",
				"max_usd",
			]);
			if (parsedCostLimitUsd !== null && parsedCostLimitUsd >= 0) {
				costLimitUsd = parsedCostLimitUsd;
			}
		}
	}
	return {
		usedCostUsd,
		costLimitUsd,
		usedIterations,
		iterationLimit,
		remainingCostUsd:
			costLimitUsd === null ? null : Math.max(costLimitUsd - usedCostUsd, 0),
		remainingIterations:
			iterationLimit === null
				? null
				: Math.max(iterationLimit - usedIterations, 0),
	};
}

export function filterAutoHistoryEntries(
	entries: AutoLedgerEntry[],
	filter: AutoHistoryFilter = {},
): AutoLedgerEntry[] {
	const filtered = entries.filter((entry) => {
		if (filter.decision && entry.decision !== filter.decision) {
			return false;
		}
		if (filter.sessionId && entry.sessionId !== filter.sessionId) {
			return false;
		}
		if (
			filter.targetFailureMode &&
			entry.targetFailureMode !== filter.targetFailureMode
		) {
			return false;
		}
		if (
			filter.mutationFamily &&
			entry.mutationFamily !== filter.mutationFamily
		) {
			return false;
		}
		return true;
	});

	const limit = filter.limit;
	if (limit === undefined) {
		return filtered;
	}
	if (!Number.isInteger(limit) || limit < 1) {
		throw new Error("history.limit must be a positive integer when provided");
	}
	return filtered.slice(0, limit);
}

export function sortAutoHistoryEntries(
	entries: AutoLedgerEntry[],
	sort: AutoHistorySort = {},
): AutoLedgerEntry[] {
	const by = sort.by ?? "timestamp";
	const direction = sort.direction ?? "desc";
	return [...entries].sort((left, right) => {
		let comparison = 0;
		if (by === "timestamp") {
			comparison = compareString(left.timestamp, right.timestamp, direction);
		} else if (by === "utility") {
			comparison = compareNullableNumber(
				left.utilityScore,
				right.utilityScore,
				direction,
			);
		} else if (by === "objectiveReductionRatio") {
			comparison = compareNumber(
				left.objectiveReductionRatio,
				right.objectiveReductionRatio,
				direction,
			);
		} else if (by === "passRateDeltaRatio") {
			comparison = compareNumber(
				left.passRateDeltaRatio,
				right.passRateDeltaRatio,
				direction,
			);
		} else {
			comparison = compareNumber(left.durationMs, right.durationMs, direction);
		}
		if (comparison !== 0) {
			return comparison;
		}
		return left.experimentId.localeCompare(right.experimentId);
	});
}

export function buildAutoHistoryRows(
	entries: AutoLedgerEntry[],
): AutoHistoryRow[] {
	return entries.map((entry) => ({
		experimentId: entry.experimentId,
		timestamp: entry.timestamp,
		sessionId: entry.sessionId,
		decision: entry.decision,
		targetFailureMode: entry.targetFailureMode,
		mutationFamily: entry.mutationFamily,
		utilityScore: entry.utilityScore,
		objectiveReductionRatio: entry.objectiveReductionRatio,
		passRateDeltaRatio: entry.passRateDeltaRatio,
		holdoutRegressions: entry.holdoutRegressions,
		regressions: entry.regressions,
		improvements: entry.improvements,
	}));
}

export function summarizeAutoHistory(
	entries: AutoLedgerEntry[],
	options: AutoHistorySummaryOptions = {},
): AutoHistorySummary {
	const decisions: Record<AutoDecision, number> = {
		plan: 0,
		keep: 0,
		discard: 0,
		vetoed: 0,
		investigate: 0,
	};
	let bestUtilityScore: number | null = null;
	for (const entry of entries) {
		decisions[entry.decision] += 1;
		if (
			entry.utilityScore !== null &&
			(bestUtilityScore === null || entry.utilityScore > bestUtilityScore)
		) {
			bestUtilityScore = entry.utilityScore;
		}
	}
	return {
		total: entries.length,
		decisions,
		bestUtilityScore,
		kept: decisions.keep,
		vetoed: decisions.vetoed,
		targetLabel: getTargetLabel(entries),
		bestExperiment: selectBestExperiment(entries),
		familyWinRates: buildFamilyWinRates(entries),
		vetoReasons: buildVetoReasonCounts(entries),
		budget: summarizeBudget(entries, options.projectRoot),
	};
}

export function readAutoHistory(
	projectRoot: string = process.cwd(),
	filter: AutoHistoryFilter = {},
	sort: AutoHistorySort = {},
): AutoLedgerEntry[] {
	const paths = resolveAutoWorkspacePaths(projectRoot);
	const entries = readAutoLedgerEntries(paths.ledgerPath);
	const sorted = sortAutoHistoryEntries(entries, sort);
	return filterAutoHistoryEntries(sorted, filter);
}

export function inspectAutoExperiment(
	experimentId: string,
	projectRoot: string = process.cwd(),
): AutoHistoryInspectResult {
	if (typeof experimentId !== "string" || experimentId.trim().length === 0) {
		throw new Error("experimentId must be a non-empty string");
	}
	const paths = resolveAutoWorkspacePaths(projectRoot);
	const entries = readAutoLedgerEntries(paths.ledgerPath);
	const entry = entries.find(
		(candidate) => candidate.experimentId === experimentId,
	);
	if (!entry) {
		throw new Error(`No auto experiment found for id '${experimentId}'`);
	}
	const absoluteDetailsPath = path.resolve(projectRoot, entry.detailsPath);
	let details: AutoExperimentDetails | null = null;
	try {
		details = readAutoExperimentDetails(absoluteDetailsPath);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes("ENOENT")) {
			throw error;
		}
	}
	return {
		entry,
		details,
		absoluteDetailsPath,
	};
}

export function formatAutoHistory(
	entries: AutoLedgerEntry[],
	options: FormatAutoHistoryOptions = {},
): string {
	if (entries.length === 0) {
		return "No auto experiments found.";
	}
	const summary = summarizeAutoHistory(entries, options);
	const lines = [`Experiment history — target: ${summary.targetLabel}`, ""];
	const rows = entries.map((entry) => ({
		id: entry.experimentId,
		family: entry.mutationFamily,
		utility: formatNullableScore(entry.utilityScore),
		decision: formatDecisionLabel(entry.decision),
		objectiveDelta: formatSignedRatioAsPercent(
			entry.candidateObjectiveRate - entry.baselineObjectiveRate,
		),
		regressions: formatRegressionLabel(entry),
	}));
	const widths = {
		id: Math.max("ID".length, ...rows.map((row) => row.id.length)),
		family: Math.max("Family".length, ...rows.map((row) => row.family.length)),
		utility: Math.max(
			"Utility".length,
			...rows.map((row) => row.utility.length),
		),
		decision: Math.max(
			"Decision".length,
			...rows.map((row) => row.decision.length),
		),
		objectiveDelta: Math.max(
			"Objective Δ".length,
			...rows.map((row) => row.objectiveDelta.length),
		),
		regressions: Math.max(
			"Regressions".length,
			...rows.map((row) => row.regressions.length),
		),
	};
	lines.push(
		`  ${padCell("ID", widths.id)}  ${padCell("Family", widths.family)}  ${padCell("Utility", widths.utility)}  ${padCell("Decision", widths.decision)}  ${padCell("Objective Δ", widths.objectiveDelta)}  ${padCell("Regressions", widths.regressions)}`,
	);
	for (const entry of entries) {
		const row = rows.find((candidate) => candidate.id === entry.experimentId);
		if (!row) {
			continue;
		}
		lines.push(
			`  ${padCell(row.id, widths.id)}  ${padCell(row.family, widths.family)}  ${padCell(row.utility, widths.utility)}  ${padCell(row.decision, widths.decision)}  ${padCell(row.objectiveDelta, widths.objectiveDelta)}  ${padCell(row.regressions, widths.regressions)}`,
		);
	}
	if (summary.bestExperiment) {
		lines.push("");
		lines.push(
			`  Best so far: ${summary.bestExperiment.experimentId} (utility: ${formatNullableScore(summary.bestExperiment.utilityScore)}, ${summary.bestExperiment.targetFailureMode}: ${formatRatioAsPercent(summary.bestExperiment.baselineObjectiveRate)} → ${formatRatioAsPercent(summary.bestExperiment.candidateObjectiveRate)})`,
		);
	}
	const usedBudgetParts: string[] = [];
	if (summary.budget.costLimitUsd !== null) {
		usedBudgetParts.push(
			`${formatUsd(summary.budget.usedCostUsd)} / ${formatUsd(summary.budget.costLimitUsd)}`,
		);
	} else if (summary.budget.usedCostUsd > 0) {
		usedBudgetParts.push(formatUsd(summary.budget.usedCostUsd));
	}
	if (summary.budget.iterationLimit !== null) {
		usedBudgetParts.push(
			`${summary.budget.usedIterations}/${summary.budget.iterationLimit} iterations`,
		);
	} else if (summary.budget.usedIterations > 0) {
		usedBudgetParts.push(
			`${summary.budget.usedIterations} iteration${summary.budget.usedIterations === 1 ? "" : "s"}`,
		);
	}
	if (usedBudgetParts.length > 0) {
		lines.push(`  Budget used: ${usedBudgetParts.join(" · ")}`);
	}
	const remainingBudgetParts: string[] = [];
	if (summary.budget.remainingIterations !== null) {
		remainingBudgetParts.push(
			`${summary.budget.remainingIterations} iteration${summary.budget.remainingIterations === 1 ? "" : "s"}`,
		);
	}
	if (summary.budget.remainingCostUsd !== null) {
		remainingBudgetParts.push(formatUsd(summary.budget.remainingCostUsd));
	}
	if (remainingBudgetParts.length > 0) {
		lines.push(`  Remaining: ${remainingBudgetParts.join(" · ")}`);
	}
	lines.push("");
	lines.push("  Mutation family win rates:");
	for (const family of summary.familyWinRates) {
		lines.push(
			`    ${padCell(family.mutationFamily, 28)} ${String(family.wins).padStart(1, " ")}/${String(family.attempts).padEnd(1, " ")}  (${family.winRate === null ? "n/a" : formatWholeFriendlyPercent(family.winRate)})`,
		);
	}
	if (summary.vetoReasons.length > 0) {
		lines.push("");
		lines.push("  Top veto reasons:");
		for (const vetoReason of summary.vetoReasons) {
			lines.push(`    ${padCell(vetoReason.reason, 28)} ×${vetoReason.count}`);
		}
	}
	return lines.join("\n");
}

export function formatAutoExperimentInspect(
	result: AutoHistoryInspectResult,
): string {
	const lines = [
		`Experiment ${result.entry.experimentId}`,
		`Decision: ${result.entry.decision}`,
		`Utility: ${formatNullableScore(result.entry.utilityScore)}`,
		`Objective reduction: ${formatRatioAsPercent(result.entry.objectiveReductionRatio)}`,
		`Pass delta: ${formatRatioAsPercent(result.entry.passRateDeltaRatio)} (${result.entry.passRateBasis})`,
		`Mutation: ${result.entry.mutationFamily} → ${result.entry.mutationTarget}`,
		`Failure mode: ${result.entry.targetFailureMode}`,
		`Details: ${result.absoluteDetailsPath}`,
	];
	if (result.entry.reflection) {
		lines.push(`Reflection: ${result.entry.reflection}`);
	}
	if (result.details) {
		lines.push(
			`Targeted flips: +${result.details.targetedSpecSummary.failToPassIds.length} / -${result.details.targetedSpecSummary.passToFailIds.length}`,
		);
		lines.push(
			`Holdout flips: +${result.details.holdoutSpecSummary.failToPassIds.length} / -${result.details.holdoutSpecSummary.passToFailIds.length}`,
		);
		if (result.details.veto.matchedRule) {
			lines.push(`Veto rule: ${result.details.veto.matchedRule}`);
		}
	}
	return lines.join("\n");
}
