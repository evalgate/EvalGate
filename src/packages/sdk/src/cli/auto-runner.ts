import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import type { AssertionLLMConfig } from "../assertions";
import {
	buildAutoClusterId,
	readClusterMemoryById,
	updateClusterMemoryForIteration,
} from "./auto-cluster";
import { computeFamilyPriors } from "./auto-families";
import {
	type AutoExperimentDetails,
	type AutoLedgerEntry,
	appendAutoLedgerEntry,
	createAutoLedgerEntry,
	readAutoLedgerEntries,
	resolveAutoDetailsPath,
	resolveAutoDetailsRelativePath,
	resolveAutoWorkspacePaths,
	writeAutoExperimentDetails,
} from "./auto-ledger";
import { planNextIteration } from "./auto-planner";

import type { AutoProgram } from "./auto-program";
import {
	type AutoReflection,
	generateAndWriteAutoReflection,
	readAutoReflection,
	resolveAutoReflectionPath,
} from "./auto-reflection";
import {
	computeObjectiveReductionRatio,
	resolvePassRateBasisFromRuns,
} from "./auto-utility";
import { loadConfig, type NormalizedBudgetConfig } from "./config";
import { compareReports, type DiffResult, runDiff } from "./diff";
import { analyzeImpact } from "./impact-analysis";
import { type EvaluationManifest, readManifest } from "./manifest";
import { type RunResult, runEvaluations } from "./run";

export type AutoFormat = "human" | "json";
export type AutoDecision = "plan" | "keep" | "discard" | "investigate";
export type AutoExecutionMode = "plan" | "artifact" | "prompt-edit";

export const DEFAULT_AUTO_REPORT_PATH = path.join(
	process.cwd(),
	".evalgate",
	"auto",
	"latest.json",
);

export interface AutoOptions {
	objective: string | null;
	hypothesis: string | null;
	base: string;
	head: string | null;
	promptPath: string | null;
	budget: number;
	format: AutoFormat;
	outputPath: string;
	dryRun: boolean;
}

interface AutoLoopLlmRuntimeConfig {
	llmConfig: AssertionLLMConfig | null;
	maxTokens?: number;
}

interface AdaptiveLoopRuntimeConfig {
	allowedFamilies: string[];
	clusterId: string | null;
	clusterResolvedThreshold: number | null;
	familyRetryAfterIterations: number;
	planner: AutoLoopLlmRuntimeConfig;
	recentReflectionsLimit: number;
	reflection: AutoLoopLlmRuntimeConfig;
}

interface PersistedAutoLoopIteration {
	experimentId: string;
	entry: AutoLedgerEntry;
	details: AutoExperimentDetails;
}

export interface AutoDiffSnapshot {
	passRateDelta: number;
	scoreDelta: number;
	regressions: number;
	improvements: number;
	added: number;
	removed: number;
	objectiveFailureModeDelta: number | null;
}

export interface AutoPlanStep {
	iteration: number;
	action: string;
	goal: string;
}

export interface PromptCandidate {
	id: string;
	label: string;
	instruction: string;
}

export interface AutoIterationResult {
	iteration: number;
	candidateId: string;
	label: string;
	runPath: string;
	decision: AutoDecision;
	diff: AutoDiffSnapshot;
	rationale: string[];
}

export interface AutoReport {
	objective: string;
	hypothesis: string | null;
	executionMode: AutoExecutionMode;
	dryRun: boolean;
	iterationBudget: number;
	base: string;
	head: string | null;
	promptPath: string | null;
	impactedSpecIds: string[];
	decision: AutoDecision;
	rationale: string[];
	nextActions: string[];
	executionBudget: {
		mode: NormalizedBudgetConfig["mode"];
		limit: number;
	} | null;
	diff: AutoDiffSnapshot | null;
	planSteps: AutoPlanStep[];
	iterations: AutoIterationResult[];
	generatedAt: string;
	outputPath: string;
}

export interface AutoDecisionInput {
	dryRun: boolean;
	objective: string;
	diff: AutoDiffSnapshot | null;
}

export function parseAutoArgs(args: string[]): AutoOptions {
	const result: AutoOptions = {
		objective: null,
		hypothesis: null,
		base: "baseline",
		head: null,
		promptPath: null,
		budget: 3,
		format: "human",
		outputPath: DEFAULT_AUTO_REPORT_PATH,
		dryRun: false,
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--objective" && args[i + 1]) {
			result.objective = args[++i];
		} else if (arg === "--hypothesis" && args[i + 1]) {
			result.hypothesis = args[++i];
		} else if (arg === "--base" && args[i + 1]) {
			result.base = args[++i];
		} else if ((arg === "--head" || arg === "--candidate") && args[i + 1]) {
			result.head = args[++i];
		} else if (arg === "--prompt" && args[i + 1]) {
			result.promptPath = args[++i];
		} else if (arg === "--budget" && args[i + 1]) {
			const parsed = Number.parseInt(args[++i], 10);
			if (Number.isFinite(parsed) && parsed > 0) {
				result.budget = parsed;
			}
		} else if (arg === "--format" && args[i + 1]) {
			const format = args[++i];
			if (format === "human" || format === "json") {
				result.format = format;
			}
		} else if (arg === "--output" && args[i + 1]) {
			result.outputPath = args[++i];
		} else if (arg === "--dry-run") {
			result.dryRun = true;
		}
	}

	return result;
}

export function buildAutoPlan(
	objective: string,
	budget: number,
): AutoPlanStep[] {
	const cappedBudget = Math.max(1, budget);
	const steps: AutoPlanStep[] = [];
	for (let iteration = 1; iteration <= cappedBudget; iteration++) {
		if (iteration === 1) {
			steps.push({
				iteration,
				action: "propose_change",
				goal: `Target objective '${objective}' with one focused candidate change`,
			});
		} else if (iteration === cappedBudget) {
			steps.push({
				iteration,
				action: "decide_keep_or_discard",
				goal: "Compare against baseline and make a final keep/discard decision",
			});
		} else {
			steps.push({
				iteration,
				action: "run_and_compare",
				goal: "Execute evals, inspect regressions, and refine the candidate",
			});
		}
	}
	return steps;
}

function detectAutoExecutionMode(options: AutoOptions): AutoExecutionMode {
	if (options.promptPath) {
		return "prompt-edit";
	}
	if (options.head) {
		return "artifact";
	}
	return "plan";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter(
		(entry): entry is string =>
			typeof entry === "string" && entry.trim().length > 0,
	);
}

function resolvePositiveInteger(value: unknown, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return fallback;
	}
	return Math.max(1, Math.round(value));
}

function resolveOptionalFiniteNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolveAdaptiveLlmRuntimeConfig(
	configValue: unknown,
): AutoLoopLlmRuntimeConfig {
	if (!isRecord(configValue)) {
		return { llmConfig: null };
	}
	const provider = configValue.provider;
	const apiKeyEnv = configValue.api_key_env;
	if (
		(provider !== "openai" && provider !== "anthropic") ||
		typeof apiKeyEnv !== "string" ||
		apiKeyEnv.trim().length === 0
	) {
		return {
			llmConfig: null,
			maxTokens:
				resolveOptionalFiniteNumber(configValue.max_tokens) ?? undefined,
		};
	}
	const apiKey = process.env[apiKeyEnv];
	if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
		console.warn(
			`EvalGate auto WARNING: skipped ${provider} adaptive loop config because ${apiKeyEnv} is not set.`,
		);
		return {
			llmConfig: null,
			maxTokens:
				resolveOptionalFiniteNumber(configValue.max_tokens) ?? undefined,
		};
	}
	return {
		llmConfig: {
			provider,
			apiKey,
			model:
				typeof configValue.model === "string" &&
				configValue.model.trim().length > 0
					? configValue.model
					: undefined,
			baseUrl:
				typeof configValue.base_url === "string" &&
				configValue.base_url.trim().length > 0
					? configValue.base_url
					: undefined,
			timeoutMs:
				resolveOptionalFiniteNumber(configValue.timeout_ms) ?? undefined,
		},
		maxTokens: resolveOptionalFiniteNumber(configValue.max_tokens) ?? undefined,
	};
}

function resolveAdaptiveLoopRuntimeConfig(
	program: AutoProgram | null | undefined,
	objective: string,
): AdaptiveLoopRuntimeConfig {
	const mutation: Record<string, unknown> = isRecord(program?.mutation)
		? program.mutation
		: {};
	const adaptiveLoop: Record<string, unknown> = isRecord(program?.adaptive_loop)
		? program.adaptive_loop
		: {};
	const allowedFamilies = normalizeStringArray(mutation.allowed_families);
	return {
		allowedFamilies,
		clusterId:
			objective.trim().length > 0 ? buildAutoClusterId(objective) : null,
		clusterResolvedThreshold: resolveOptionalFiniteNumber(
			adaptiveLoop.cluster_resolved_threshold,
		),
		familyRetryAfterIterations: resolvePositiveInteger(
			adaptiveLoop.family_retry_after_iterations,
			3,
		),
		planner: resolveAdaptiveLlmRuntimeConfig(adaptiveLoop.planner),
		recentReflectionsLimit: resolvePositiveInteger(
			adaptiveLoop.recent_reflections_limit,
			3,
		),
		reflection: resolveAdaptiveLlmRuntimeConfig(adaptiveLoop.reflection),
	};
}

function readRecentReflectionArtifacts(
	ledgerEntries: AutoLedgerEntry[],
	projectRoot: string,
	limit: number,
): AutoReflection[] {
	const reflections: AutoReflection[] = [];
	for (const entry of [...ledgerEntries].reverse()) {
		const reflectionPath = resolveAutoReflectionPath(
			entry.experimentId,
			projectRoot,
		);
		if (!fs.existsSync(reflectionPath)) {
			continue;
		}
		try {
			reflections.push(readAutoReflection(reflectionPath));
		} catch {
			continue;
		}
		if (reflections.length >= limit) {
			break;
		}
	}
	return reflections.reverse();
}

function summarizeReflectionArtifact(
	reflection: AutoReflection,
): string | null {
	const summary = [
		reflection.whatChanged,
		reflection.whyItLikelyHelped,
		reflection.whatRegressed,
	]
		.filter(
			(entry): entry is string =>
				typeof entry === "string" && entry.trim().length > 0,
		)
		.join(" ")
		.trim();
	return summary.length > 0 ? summary : null;
}

function buildObservedPatterns(
	reflection: AutoReflection | null,
	details: AutoExperimentDetails,
): string[] {
	const values = [
		...(reflection?.whatNotToRetry ?? []),
		...(reflection?.whatToTryNext ?? []),
		...(reflection?.whatRegressed ? [reflection.whatRegressed] : []),
		...details.anomalies.unexpectedFlips,
	];
	return [
		...new Set(
			values.map((value) => value.trim()).filter((value) => value.length > 0),
		),
	];
}

async function finalizeAdaptiveArtifacts(input: {
	allowedFamilies: string[];
	clusterId: string | null;
	clusterResolvedThreshold: number | null;
	objective: string;
	persisted: PersistedAutoLoopIteration;
	projectRoot: string;
	reflection: AutoLoopLlmRuntimeConfig;
}): Promise<void> {
	let reflectionArtifact: AutoReflection | null = null;
	try {
		reflectionArtifact = await generateAndWriteAutoReflection({
			entry: input.persisted.entry,
			details: input.persisted.details,
			projectRoot: input.projectRoot,
			llmConfig: input.reflection.llmConfig ?? undefined,
			maxTokens: input.reflection.maxTokens,
			logger: console,
		});
		const updatedDetails: AutoExperimentDetails = {
			...input.persisted.details,
			reflection:
				summarizeReflectionArtifact(reflectionArtifact) ??
				input.persisted.details.reflection,
		};
		writeAutoExperimentDetails(
			updatedDetails,
			resolveAutoDetailsPath(input.persisted.experimentId, input.projectRoot),
		);
	} catch (error) {
		console.warn(
			`EvalGate auto WARNING: failed to finalize reflection artifact for ${input.persisted.experimentId}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	try {
		if (input.allowedFamilies.length === 0 || !input.clusterId) {
			return;
		}
		const ledgerEntries = readAutoLedgerEntries(
			resolveAutoWorkspacePaths(input.projectRoot).ledgerPath,
		);
		const familyPriors = computeFamilyPriors(ledgerEntries, input.objective);
		updateClusterMemoryForIteration({
			entry: input.persisted.entry,
			allowedFamilies: input.allowedFamilies,
			familyPriors,
			projectRoot: input.projectRoot,
			clusterId: input.clusterId,
			observedPatterns: buildObservedPatterns(
				reflectionArtifact,
				input.persisted.details,
			),
			resolvedThreshold: input.clusterResolvedThreshold,
		});
	} catch (error) {
		console.warn(
			`EvalGate auto WARNING: failed to update cluster memory for ${input.persisted.experimentId}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

export function generatePromptCandidates(
	objective: string,
	hypothesis: string | null,
	budget: number,
): PromptCandidate[] {
	const normalizedObjective = objective.trim();
	const normalizedHypothesis = hypothesis?.trim() ?? "";
	const ideas = new Map<string, string>();

	if (normalizedHypothesis.length > 0) {
		ideas.set("hypothesis", normalizedHypothesis);
	}

	ideas.set(
		"objective",
		`Primary optimization target: reduce ${normalizedObjective}. Before answering, explicitly self-check against this objective.`,
	);
	ideas.set(
		"guardrail",
		`Before finalizing the response, verify it does not introduce regressions outside ${normalizedObjective} and revise if needed.`,
	);
	ideas.set(
		"checklist",
		`Use a short internal checklist: identify the user need, satisfy required constraints, then confirm the reply avoids ${normalizedObjective}.`,
	);

	const lowerObjective = normalizedObjective.toLowerCase();
	if (lowerObjective.includes("tone")) {
		ideas.set(
			"tone-guide",
			"Use a calm, empathetic, non-defensive tone. Acknowledge the user's concern before giving the answer.",
		);
	}
	if (
		lowerObjective.includes("hallucination") ||
		lowerObjective.includes("factual")
	) {
		ideas.set(
			"uncertainty",
			"If information is uncertain or missing, say so explicitly instead of inventing details.",
		);
	}
	if (lowerObjective.includes("format")) {
		ideas.set(
			"format-lock",
			"Return the answer strictly in the requested format and validate that the structure is complete before sending it.",
		);
	}
	if (
		lowerObjective.includes("constraint") ||
		lowerObjective.includes("policy")
	) {
		ideas.set(
			"constraint-check",
			"Before responding, enumerate the required constraints and ensure each one is satisfied in the final answer.",
		);
	}
	if (lowerObjective.includes("safety")) {
		ideas.set(
			"safety-check",
			"Run a final safety check and refuse or safely redirect unsafe requests before providing the answer.",
		);
	}

	return [...ideas.entries()]
		.slice(0, Math.max(1, budget))
		.map(([id, instruction], index) => ({
			id: `${id}-${index + 1}`,
			label: id,
			instruction,
		}));
}

function stripAutoCandidateBlock(content: string): string {
	return content
		.replace(
			/\n?\[EvalGate auto start:[^\n]*\]\n[\s\S]*?\n\[EvalGate auto end\]\n?/g,
			"\n",
		)
		.trimEnd();
}

export function applyPromptCandidate(
	originalContent: string,
	candidate: PromptCandidate,
): string {
	const sanitized = stripAutoCandidateBlock(originalContent);
	return [
		sanitized,
		"",
		`[EvalGate auto start: ${candidate.id} | ${candidate.label}]`,
		candidate.instruction,
		"[EvalGate auto end]",
		"",
	].join("\n");
}

export function resolveObjectiveFailureModeDelta(
	objective: string,
	failureModes?: Record<string, { base: number; head: number; delta: number }>,
): number | null {
	if (!failureModes || Object.keys(failureModes).length === 0) {
		return null;
	}

	const normalizedObjective = objective.trim().toLowerCase();
	if (normalizedObjective.length === 0) {
		return null;
	}

	for (const [mode, stats] of Object.entries(failureModes)) {
		const normalizedMode = mode.toLowerCase();
		if (
			normalizedObjective === normalizedMode ||
			normalizedObjective.includes(normalizedMode) ||
			normalizedMode.includes(normalizedObjective)
		) {
			return stats.delta;
		}
	}

	return null;
}

export function decideAutoExperiment(input: AutoDecisionInput): {
	decision: AutoDecision;
	rationale: string[];
	nextActions: string[];
} {
	if (input.dryRun || !input.diff) {
		return {
			decision: "plan",
			rationale: [
				"No candidate run artifact was provided, so EvalGate auto is operating in planning mode.",
				"The loop can define candidate iterations and budget, but it cannot score keep/discard until a candidate run is available.",
			],
			nextActions: [
				"Generate or run one candidate change against the target objective.",
				"Re-run evalgate auto with --head <candidate-run.json> or --prompt <path> to score the iteration.",
			],
		};
	}

	const rationale: string[] = [];
	const nextActions: string[] = [];
	const objectiveDelta = input.diff.objectiveFailureModeDelta;

	if (objectiveDelta !== null) {
		if (objectiveDelta < 0) {
			rationale.push(
				`Target failure mode improved by ${Math.abs(objectiveDelta)} case(s) relative to baseline.`,
			);
		} else if (objectiveDelta > 0) {
			rationale.push(
				`Target failure mode worsened by ${objectiveDelta} case(s) relative to baseline.`,
			);
		} else {
			rationale.push("Target failure mode is unchanged relative to baseline.");
		}
	}

	if (
		input.diff.regressions > input.diff.improvements &&
		input.diff.regressions > 0
	) {
		rationale.push(
			`Regressions (${input.diff.regressions}) outnumber improvements (${input.diff.improvements}).`,
		);
		nextActions.push("Revert or narrow the candidate change.");
		nextActions.push(
			"Inspect the top regressions before trying another iteration.",
		);
		return { decision: "discard", rationale, nextActions };
	}

	if (objectiveDelta !== null && objectiveDelta > 0) {
		rationale.push("The candidate moves the objective in the wrong direction.");
		nextActions.push("Discard this candidate and try a new hypothesis.");
		return { decision: "discard", rationale, nextActions };
	}

	if (
		input.diff.regressions === 0 &&
		input.diff.passRateDelta >= 0 &&
		(objectiveDelta === null || objectiveDelta <= 0) &&
		(input.diff.improvements > 0 ||
			input.diff.scoreDelta > 0 ||
			objectiveDelta !== null)
	) {
		rationale.push(
			"No regressions were detected and aggregate quality did not decline.",
		);
		nextActions.push(
			"Keep this candidate and use it as the new baseline for the next iteration.",
		);
		if (objectiveDelta === null) {
			nextActions.push(
				"Add failure-mode labeling coverage if you want objective-specific gating.",
			);
		}
		return { decision: "keep", rationale, nextActions };
	}

	if (input.diff.passRateDelta < 0) {
		rationale.push(
			`Pass rate declined by ${(input.diff.passRateDelta * 100).toFixed(1)} percentage points.`,
		);
	}
	if (input.diff.improvements === 0 && input.diff.regressions === 0) {
		rationale.push(
			"The candidate did not create a strong measurable behavioral change.",
		);
	}
	if (objectiveDelta === null) {
		rationale.push(
			"The objective could not be tied to a labeled failure mode delta, so the result needs human review.",
		);
	}
	if (nextActions.length === 0) {
		nextActions.push(
			"Inspect the diff summary and decide whether to refine or rerun the candidate.",
		);
		nextActions.push(
			"Prefer smaller, more targeted changes for the next iteration.",
		);
	}

	return { decision: "investigate", rationale, nextActions };
}

function diffSnapshotFromReports(
	objective: string,
	base: RunResult,
	head: RunResult,
): AutoDiffSnapshot {
	const result = compareReports(base, head);
	return {
		passRateDelta: result.summary.passRateDelta,
		scoreDelta: result.summary.scoreDelta,
		regressions: result.summary.regressions,
		improvements: result.summary.improvements,
		added: result.summary.added,
		removed: result.summary.removed,
		objectiveFailureModeDelta: resolveObjectiveFailureModeDelta(
			objective,
			result.summary.failureModes,
		),
	};
}

function scoreIteration(
	snapshot: AutoDiffSnapshot,
	decision: AutoDecision,
): number {
	let score = snapshot.improvements * 40 - snapshot.regressions * 100;
	score += snapshot.passRateDelta * 1000;
	score += snapshot.scoreDelta * 800;
	if (snapshot.objectiveFailureModeDelta !== null) {
		score += -snapshot.objectiveFailureModeDelta * 60;
	}
	if (decision === "keep") {
		score += 200;
	} else if (decision === "discard") {
		score -= 200;
	}
	return score;
}

class AutoIterationPersistenceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AutoIterationPersistenceError";
	}
}

function generateAutoRecordId(prefix: string): string {
	return `${prefix}_${crypto.randomBytes(3).toString("hex")}`;
}

function hashCandidateContent(content: string): string {
	return crypto
		.createHash("sha256")
		.update(content, "utf8")
		.digest("hex")
		.slice(0, 12);
}

function summarizeCandidateInstruction(instruction: string): string {
	const normalized = instruction.trim().replace(/\s+/g, " ");
	return normalized.length <= 120
		? normalized
		: `${normalized.slice(0, 117)}...`;
}

function computeRelativeDeltaRatio(
	baselineValue: number,
	candidateValue: number,
): number {
	if (baselineValue === 0) {
		return candidateValue === 0 ? 0 : candidateValue;
	}
	return (candidateValue - baselineValue) / baselineValue;
}

function resolveObjectiveFailureModeCount(
	objective: string,
	run: RunResult,
): number {
	const failureModes = run.summary.failureModes;
	if (!failureModes || Object.keys(failureModes).length === 0) {
		return 0;
	}
	const normalizedObjective = objective.trim().toLowerCase();
	if (normalizedObjective.length === 0) {
		return 0;
	}
	for (const [mode, count] of Object.entries(failureModes)) {
		const normalizedMode = mode.toLowerCase();
		if (
			normalizedObjective === normalizedMode ||
			normalizedObjective.includes(normalizedMode) ||
			normalizedMode.includes(normalizedObjective)
		) {
			return count;
		}
	}
	return 0;
}

function resolveObjectiveFailureModeRate(
	objective: string,
	run: RunResult,
): number {
	const total = run.metadata.executedSpecs || run.results.length;
	if (total <= 0) {
		return 0;
	}
	return resolveObjectiveFailureModeCount(objective, run) / total;
}

function buildTargetedSpecSummary(
	diffResult: DiffResult,
	targetedSpecIds: string[],
): {
	passToFailIds: string[];
	failToPassIds: string[];
	unchangedIds: string[];
	unexpectedFlipIds: string[];
} {
	const passToFailIds: string[] = [];
	const failToPassIds: string[] = [];
	const unexpectedFlipIds: string[] = [];
	const changedIds = new Set<string>();
	for (const changedSpec of diffResult.changedSpecs) {
		changedIds.add(changedSpec.specId);
		if (changedSpec.classification === "new_failure") {
			passToFailIds.push(changedSpec.specId);
		} else if (changedSpec.classification === "fixed_failure") {
			failToPassIds.push(changedSpec.specId);
		} else {
			unexpectedFlipIds.push(changedSpec.specId);
		}
	}
	return {
		passToFailIds: passToFailIds.sort((left, right) =>
			left.localeCompare(right),
		),
		failToPassIds: failToPassIds.sort((left, right) =>
			left.localeCompare(right),
		),
		unchangedIds: targetedSpecIds
			.filter((specId) => !changedIds.has(specId))
			.sort((left, right) => left.localeCompare(right)),
		unexpectedFlipIds: unexpectedFlipIds.sort((left, right) =>
			left.localeCompare(right),
		),
	};
}

function persistAutoLoopIteration(input: {
	sessionId: string;
	parentExperimentId: string;
	objective: string;
	projectRoot: string;
	targetClusterId: string | null;
	promptPath: string;
	targetedSpecIds: string[];
	baselineRun: RunResult;
	baselineRunPath: string;
	candidateRun: RunResult | null;
	candidateRunPath: string | null;
	candidate: PromptCandidate;
	candidateContent: string;
	iterationResult: AutoIterationResult;
	utilityScore: number | null;
}): PersistedAutoLoopIteration {
	try {
		const experimentId = generateAutoRecordId("exp");
		const baselineObjectiveRate = resolveObjectiveFailureModeRate(
			input.objective,
			input.baselineRun,
		);
		const candidateObjectiveRate = input.candidateRun
			? resolveObjectiveFailureModeRate(input.objective, input.candidateRun)
			: baselineObjectiveRate;
		const passRateResolution = input.candidateRun
			? resolvePassRateBasisFromRuns(input.baselineRun, input.candidateRun)
			: {
					passRateBasis: "raw" as const,
					baselinePassRate: input.baselineRun.summary.passRate,
					candidatePassRate: Math.max(
						input.baselineRun.summary.passRate +
							input.iterationResult.diff.passRateDelta,
						0,
					),
					deltaRatio: input.iterationResult.diff.passRateDelta,
				};
		const baselineDurationMs = input.baselineRun.metadata.duration;
		const candidateDurationMs = input.candidateRun?.metadata.duration ?? 0;
		const baselineCostUsd = input.baselineRun.summary.totalCostUsd ?? 0;
		const candidateCostUsd = input.candidateRun?.summary.totalCostUsd ?? 0;
		const diffResult = input.candidateRun
			? compareReports(input.baselineRun, input.candidateRun)
			: null;
		const targetedSpecSummary = diffResult
			? buildTargetedSpecSummary(diffResult, input.targetedSpecIds)
			: {
					passToFailIds: [],
					failToPassIds: [],
					unchangedIds: [...input.targetedSpecIds].sort((left, right) =>
						left.localeCompare(right),
					),
					unexpectedFlipIds: [],
				};
		const details: AutoExperimentDetails = {
			experimentId,
			sessionId: input.sessionId,
			baselineRef: normalizeWorkspacePath(
				input.baselineRunPath,
				input.projectRoot,
			),
			candidateRef: input.candidateRunPath
				? normalizeWorkspacePath(input.candidateRunPath, input.projectRoot)
				: `failed:${input.candidate.id}`,
			mutation: {
				target: input.promptPath,
				family: input.candidate.label,
				summary: summarizeCandidateInstruction(input.candidate.instruction),
			},
			utility: {
				inputMetrics: {
					objectiveReductionRatio: computeObjectiveReductionRatio(
						baselineObjectiveRate,
						candidateObjectiveRate,
					),
					regressions: input.iterationResult.diff.regressions,
					improvements: input.iterationResult.diff.improvements,
					passRateDeltaRatio: input.iterationResult.diff.passRateDelta,
					scoreDelta: input.iterationResult.diff.scoreDelta,
					objectiveFailureModeDelta:
						input.iterationResult.diff.objectiveFailureModeDelta,
				},
				weights: {
					improvements: 40,
					regressions: -100,
					passRateDelta: 1000,
					scoreDelta: 800,
					objectiveFailureModeDelta: -60,
					keepBonus: 200,
					discardPenalty: -200,
				},
				computedScore: input.utilityScore,
			},
			veto: {
				evaluatedRules: [],
				matchedRule: null,
			},
			targetedSpecSummary: {
				passToFailIds: targetedSpecSummary.passToFailIds,
				failToPassIds: targetedSpecSummary.failToPassIds,
				unchangedIds: targetedSpecSummary.unchangedIds,
			},
			holdoutSpecSummary: {
				passToFailIds: [],
				failToPassIds: [],
				unchangedIds: [],
			},
			anomalies: {
				latencySpikes: [],
				unexpectedFlips: targetedSpecSummary.unexpectedFlipIds,
				missingFailureModeMapping:
					input.iterationResult.diff.objectiveFailureModeDelta === null
						? [input.objective]
						: [],
			},
			reportPaths: {
				baseline: normalizeWorkspacePath(
					input.baselineRunPath,
					input.projectRoot,
				),
				candidate: input.candidateRunPath
					? normalizeWorkspacePath(input.candidateRunPath, input.projectRoot)
					: `failed:${input.candidate.id}`,
				targeted: input.candidateRunPath
					? normalizeWorkspacePath(input.candidateRunPath, input.projectRoot)
					: `failed:${input.candidate.id}`,
			},
			reflection:
				input.iterationResult.rationale.length > 0
					? input.iterationResult.rationale.join(" ")
					: null,
		};
		writeAutoExperimentDetails(
			details,
			resolveAutoDetailsPath(experimentId, input.projectRoot),
		);
		const entry = createAutoLedgerEntry({
			experimentId,
			sessionId: input.sessionId,
			timestamp: new Date().toISOString(),
			parentExperimentId: input.parentExperimentId,
			baselineRef: details.baselineRef,
			candidateRef: details.candidateRef,
			targetFailureMode: input.objective,
			targetClusterId: input.targetClusterId,
			mutationTarget: input.promptPath,
			mutationFamily: input.candidate.label,
			patchSummary: summarizeCandidateInstruction(input.candidate.instruction),
			patchHash: hashCandidateContent(input.candidateContent),
			targetedSpecs: [...input.targetedSpecIds].sort((left, right) =>
				left.localeCompare(right),
			),
			holdoutSpecs: [],
			utilityScore: input.utilityScore,
			objectiveReductionRatio: computeObjectiveReductionRatio(
				baselineObjectiveRate,
				candidateObjectiveRate,
			),
			baselineObjectiveRate,
			candidateObjectiveRate,
			regressions: input.iterationResult.diff.regressions,
			improvements: input.iterationResult.diff.improvements,
			holdoutRegressions: 0,
			passRateDeltaRatio: input.iterationResult.diff.passRateDelta,
			correctedPassRateDeltaRatio: passRateResolution.deltaRatio,
			passRateBasis: passRateResolution.passRateBasis,
			latencyDeltaRatio: computeRelativeDeltaRatio(
				baselineDurationMs,
				candidateDurationMs,
			),
			costDeltaRatio: computeRelativeDeltaRatio(
				baselineCostUsd,
				candidateCostUsd,
			),
			decision: input.iterationResult.decision,
			hardVetoReason: null,
			costUsd: candidateCostUsd,
			durationMs: candidateDurationMs,
			detailsPath: resolveAutoDetailsRelativePath(
				experimentId,
				input.projectRoot,
			),
			reflection: details.reflection,
		});
		appendAutoLedgerEntry(entry);
		return {
			experimentId,
			entry,
			details,
		};
	} catch (error) {
		throw new AutoIterationPersistenceError(
			`Failed to persist auto iteration artifacts: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function normalizeWorkspacePath(filePath: string, projectRoot: string): string {
	return path
		.relative(projectRoot, path.resolve(projectRoot, filePath))
		.replace(/\\/g, "/");
}

function resolvePromptSelection(
	manifest: EvaluationManifest,
	projectRoot: string,
	explicitPromptPath: string | null,
): { absolutePath: string; relativePath: string } {
	if (explicitPromptPath) {
		const absolutePath = path.isAbsolute(explicitPromptPath)
			? explicitPromptPath
			: path.join(projectRoot, explicitPromptPath);
		if (!fs.existsSync(absolutePath)) {
			throw new Error(`Prompt file not found: ${explicitPromptPath}`);
		}
		return {
			absolutePath,
			relativePath: normalizeWorkspacePath(absolutePath, projectRoot),
		};
	}

	const promptPaths = [
		...new Set(manifest.specs.flatMap((spec) => spec.dependsOn.prompts)),
	];
	if (promptPaths.length !== 1) {
		throw new Error(
			"Pass --prompt <path> to run the live auto loop, because the manifest does not resolve to exactly one prompt dependency.",
		);
	}

	const absolutePath = path.join(projectRoot, promptPaths[0]);
	if (!fs.existsSync(absolutePath)) {
		throw new Error(`Prompt file not found: ${promptPaths[0]}`);
	}

	return {
		absolutePath,
		relativePath: promptPaths[0],
	};
}

function persistAutoRunArtifact(
	result: RunResult,
	label: string,
	projectRoot: string,
): string {
	const runsDir = path.join(projectRoot, ".evalgate", "auto", "runs");
	fs.mkdirSync(runsDir, { recursive: true });
	const safeLabel = label.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
	const runPath = path.join(runsDir, `${safeLabel}-${result.runId}.json`);
	fs.writeFileSync(runPath, JSON.stringify(result, null, 2), "utf8");
	return runPath;
}

async function executePromptLoop(
	options: AutoOptions,
	manifest: EvaluationManifest,
	projectRoot: string,
	program?: AutoProgram | null,
): Promise<{
	diff: AutoDiffSnapshot | null;
	impactedSpecIds: string[];
	iterations: AutoIterationResult[];
	head: string | null;
	promptPath: string;
}> {
	const promptSelection = resolvePromptSelection(
		manifest,
		projectRoot,
		options.promptPath,
	);
	const impact = analyzeImpact([promptSelection.relativePath], manifest);
	if (impact.impactedSpecIds.length === 0) {
		throw new Error(
			`No impacted specs found for prompt file ${promptSelection.relativePath}`,
		);
	}

	const originalContent = fs.readFileSync(promptSelection.absolutePath, "utf8");
	const baselineRun = await runEvaluations(
		{
			specIds: impact.impactedSpecIds,
			format: "json",
			writeResults: false,
		},
		projectRoot,
	);
	const baselineRunPath = persistAutoRunArtifact(
		baselineRun,
		"baseline",
		projectRoot,
	);

	const adaptiveLoop = resolveAdaptiveLoopRuntimeConfig(
		program,
		options.objective ?? "",
	);
	const staticCandidates =
		adaptiveLoop.allowedFamilies.length === 0
			? generatePromptCandidates(
					options.objective ?? "",
					options.hypothesis,
					options.budget,
				)
			: null;
	const iterations: AutoIterationResult[] = [];
	let bestKeep: {
		score: number;
		result: AutoIterationResult;
		content: string;
	} | null = null;
	let bestOverall: {
		score: number;
		result: AutoIterationResult;
		content: string;
	} | null = null;
	const sessionId = generateAutoRecordId("session");
	let parentExperimentId = "root";

	try {
		for (let index = 0; index < Math.max(1, options.budget); index++) {
			const proposal = staticCandidates
				? null
				: await planNextIteration({
						iteration: index + 1,
						objective: options.objective ?? "",
						targetPath: promptSelection.relativePath,
						targetContent: originalContent,
						allowedFamilies: adaptiveLoop.allowedFamilies,
						clusterMemory: adaptiveLoop.clusterId
							? readClusterMemoryById(adaptiveLoop.clusterId, projectRoot)
							: null,
						familyPriors: computeFamilyPriors(
							readAutoLedgerEntries(
								resolveAutoWorkspacePaths(projectRoot).ledgerPath,
							),
							options.objective ?? "",
						),
						ledgerEntries: readAutoLedgerEntries(
							resolveAutoWorkspacePaths(projectRoot).ledgerPath,
						),
						recentReflections: readRecentReflectionArtifacts(
							readAutoLedgerEntries(
								resolveAutoWorkspacePaths(projectRoot).ledgerPath,
							),
							projectRoot,
							adaptiveLoop.recentReflectionsLimit,
						),
						hypothesis: options.hypothesis,
						llmConfig: adaptiveLoop.planner.llmConfig ?? undefined,
						maxTokens: adaptiveLoop.planner.maxTokens,
						retryAfterIterations: adaptiveLoop.familyRetryAfterIterations,
						logger: console,
					});
			const candidate = staticCandidates
				? staticCandidates[index]
				: (proposal?.candidate ?? null);
			if (!candidate) {
				if (proposal?.reason === "cluster_exhausted") {
					console.warn(
						`EvalGate auto WARNING: stopping prompt loop because cluster_exhausted for ${adaptiveLoop.clusterId ?? options.objective ?? "current objective"}.`,
					);
				}
				break;
			}
			const candidateContent = applyPromptCandidate(originalContent, candidate);
			fs.writeFileSync(promptSelection.absolutePath, candidateContent, "utf8");

			try {
				const candidateRun = await runEvaluations(
					{
						specIds: impact.impactedSpecIds,
						format: "json",
						writeResults: false,
					},
					projectRoot,
				);
				const runPath = persistAutoRunArtifact(
					candidateRun,
					`iter-${index + 1}-${candidate.id}`,
					projectRoot,
				);
				const snapshot = diffSnapshotFromReports(
					options.objective ?? "",
					baselineRun,
					candidateRun,
				);
				const iterationDecision = decideAutoExperiment({
					dryRun: false,
					objective: options.objective ?? "",
					diff: snapshot,
				});
				const iterationResult: AutoIterationResult = {
					iteration: index + 1,
					candidateId: candidate.id,
					label: candidate.label,
					runPath,
					decision: iterationDecision.decision,
					diff: snapshot,
					rationale: iterationDecision.rationale,
				};
				iterations.push(iterationResult);

				const score = scoreIteration(snapshot, iterationDecision.decision);
				const persisted = persistAutoLoopIteration({
					sessionId,
					parentExperimentId,
					objective: options.objective ?? "",
					projectRoot,
					targetClusterId: adaptiveLoop.clusterId,
					promptPath: promptSelection.relativePath,
					targetedSpecIds: impact.impactedSpecIds,
					baselineRun,
					baselineRunPath,
					candidateRun,
					candidateRunPath: runPath,
					candidate,
					candidateContent,
					iterationResult,
					utilityScore: score,
				});
				parentExperimentId = persisted.experimentId;
				await finalizeAdaptiveArtifacts({
					allowedFamilies: adaptiveLoop.allowedFamilies,
					clusterId: adaptiveLoop.clusterId,
					clusterResolvedThreshold: adaptiveLoop.clusterResolvedThreshold,
					objective: options.objective ?? "",
					persisted,
					projectRoot,
					reflection: adaptiveLoop.reflection,
				});
				if (!bestOverall || score > bestOverall.score) {
					bestOverall = {
						score,
						result: iterationResult,
						content: candidateContent,
					};
				}
				if (
					iterationDecision.decision === "keep" &&
					(!bestKeep || score > bestKeep.score)
				) {
					bestKeep = {
						score,
						result: iterationResult,
						content: candidateContent,
					};
				}
			} catch (error) {
				if (error instanceof AutoIterationPersistenceError) {
					throw error;
				}
				const failedIteration: AutoIterationResult = {
					iteration: index + 1,
					candidateId: candidate.id,
					label: candidate.label,
					runPath: "",
					decision: "discard",
					diff: {
						passRateDelta: -1,
						scoreDelta: -1,
						regressions: impact.impactedSpecIds.length,
						improvements: 0,
						added: 0,
						removed: 0,
						objectiveFailureModeDelta: null,
					},
					rationale: [
						`Iteration failed to execute: ${error instanceof Error ? error.message : String(error)}`,
					],
				};
				iterations.push(failedIteration);
				const persisted = persistAutoLoopIteration({
					sessionId,
					parentExperimentId,
					objective: options.objective ?? "",
					projectRoot,
					targetClusterId: adaptiveLoop.clusterId,
					promptPath: promptSelection.relativePath,
					targetedSpecIds: impact.impactedSpecIds,
					baselineRun,
					baselineRunPath,
					candidateRun: null,
					candidateRunPath: null,
					candidate,
					candidateContent,
					iterationResult: failedIteration,
					utilityScore: null,
				});
				parentExperimentId = persisted.experimentId;
				await finalizeAdaptiveArtifacts({
					allowedFamilies: adaptiveLoop.allowedFamilies,
					clusterId: adaptiveLoop.clusterId,
					clusterResolvedThreshold: adaptiveLoop.clusterResolvedThreshold,
					objective: options.objective ?? "",
					persisted,
					projectRoot,
					reflection: adaptiveLoop.reflection,
				});
			} finally {
				fs.writeFileSync(promptSelection.absolutePath, originalContent, "utf8");
			}
		}
	} finally {
		fs.writeFileSync(promptSelection.absolutePath, originalContent, "utf8");
	}

	if (bestKeep) {
		fs.writeFileSync(promptSelection.absolutePath, bestKeep.content, "utf8");
		return {
			diff: bestKeep.result.diff,
			impactedSpecIds: impact.impactedSpecIds,
			iterations,
			head: bestKeep.result.runPath,
			promptPath: promptSelection.relativePath,
		};
	}

	return {
		diff: bestOverall?.result.diff ?? null,
		impactedSpecIds: impact.impactedSpecIds,
		iterations,
		head: bestOverall?.result.runPath ?? null,
		promptPath: promptSelection.relativePath,
	};
}

export function buildAutoReport(input: {
	options: AutoOptions;
	executionMode: AutoExecutionMode;
	diff: AutoDiffSnapshot | null;
	executionBudget: AutoReport["executionBudget"];
	impactedSpecIds?: string[];
	iterations?: AutoIterationResult[];
	head?: string | null;
	promptPath?: string | null;
}): AutoReport {
	const objective = input.options.objective ?? "";
	const decision = decideAutoExperiment({
		dryRun: input.options.dryRun || input.executionMode === "plan",
		objective,
		diff: input.diff,
	});

	return {
		objective,
		hypothesis: input.options.hypothesis,
		executionMode: input.executionMode,
		dryRun: input.options.dryRun || input.executionMode === "plan",
		iterationBudget: input.options.budget,
		base: input.options.base,
		head: input.head ?? input.options.head,
		promptPath: input.promptPath ?? input.options.promptPath,
		impactedSpecIds: input.impactedSpecIds ?? [],
		decision: decision.decision,
		rationale: decision.rationale,
		nextActions: decision.nextActions,
		executionBudget: input.executionBudget,
		diff: input.diff,
		planSteps: buildAutoPlan(objective, input.options.budget),
		iterations: input.iterations ?? [],
		generatedAt: new Date().toISOString(),
		outputPath: input.options.outputPath,
	};
}

export function formatAutoHuman(report: AutoReport): string {
	const lines = [
		"Auto phase",
		`Objective: ${report.objective}`,
		`Decision: ${report.decision.toUpperCase()}`,
		`Execution mode: ${report.executionMode}`,
		`Mode: ${report.dryRun ? "plan" : "evaluate"}`,
		`Iteration budget: ${report.iterationBudget}`,
		`Base: ${report.base}`,
		`Head: ${report.head ?? "(not provided)"}`,
	];

	if (report.promptPath) {
		lines.push(`Prompt: ${report.promptPath}`);
	}
	if (report.impactedSpecIds.length > 0) {
		lines.push(`Impacted specs: ${report.impactedSpecIds.join(", ")}`);
	}
	if (report.executionBudget) {
		lines.push(
			`Execution budget: ${report.executionBudget.mode} limit ${report.executionBudget.limit}`,
		);
	}
	if (report.diff) {
		lines.push(
			`Diff: ${report.diff.regressions} regressions, ${report.diff.improvements} improvements, ${(report.diff.passRateDelta * 100).toFixed(1)}pp pass-rate delta`,
		);
		if (report.diff.objectiveFailureModeDelta !== null) {
			lines.push(
				`Objective failure-mode delta: ${report.diff.objectiveFailureModeDelta}`,
			);
		}
	}
	if (report.iterations.length > 0) {
		lines.push(
			`Iterations: ${report.iterations.map((iteration) => `${iteration.iteration}:${iteration.label}:${iteration.decision}`).join(" | ")}`,
		);
	}
	if (report.rationale.length > 0) {
		lines.push(`Rationale: ${report.rationale.join(" ")}`);
	}
	if (report.nextActions.length > 0) {
		lines.push(`Next actions: ${report.nextActions.join(" ")}`);
	}

	return lines.join("\n");
}

function writeAutoReport(report: AutoReport, outputPath: string): void {
	const directory = path.dirname(outputPath);
	if (!fs.existsSync(directory)) {
		fs.mkdirSync(directory, { recursive: true });
	}
	fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
}

export async function runLegacyAuto(
	args: string[],
	program?: AutoProgram | null,
): Promise<number> {
	const options = parseAutoArgs(args);
	if (!options.objective || options.objective.trim().length === 0) {
		console.error("EvalGate auto ERROR: --objective is required");
		return 1;
	}

	const projectRoot = process.cwd();
	const config = loadConfig(projectRoot);
	const executionBudget = config?.normalizedBudget
		? {
				mode: config.normalizedBudget.mode,
				limit:
					config.normalizedBudget.mode === "traces"
						? (config.normalizedBudget.maxTraces ?? 0)
						: (config.normalizedBudget.maxCostUsd ?? 0),
			}
		: null;
	const executionMode = detectAutoExecutionMode(options);

	let diff: AutoDiffSnapshot | null = null;
	let impactedSpecIds: string[] = [];
	let iterations: AutoIterationResult[] = [];
	let resolvedHead = options.head;
	let resolvedPromptPath = options.promptPath;

	try {
		if (executionMode === "prompt-edit") {
			const manifest = await readManifest(projectRoot);
			if (!manifest) {
				throw new Error(
					"No evaluation manifest found. Run 'evalgate discover --manifest' first.",
				);
			}

			if (options.dryRun) {
				const promptSelection = resolvePromptSelection(
					manifest,
					projectRoot,
					options.promptPath,
				);
				resolvedPromptPath = promptSelection.relativePath;
				impactedSpecIds = analyzeImpact(
					[promptSelection.relativePath],
					manifest,
				).impactedSpecIds;
			} else {
				const loopResult = await executePromptLoop(
					options,
					manifest,
					projectRoot,
					program,
				);
				diff = loopResult.diff;
				impactedSpecIds = loopResult.impactedSpecIds;
				iterations = loopResult.iterations;
				resolvedHead = loopResult.head;
				resolvedPromptPath = loopResult.promptPath;
			}
		} else if (!options.dryRun && options.head) {
			const result = await runDiff({
				base: options.base,
				head: options.head,
				format: "json",
			});
			diff = {
				passRateDelta: result.summary.passRateDelta,
				scoreDelta: result.summary.scoreDelta,
				regressions: result.summary.regressions,
				improvements: result.summary.improvements,
				added: result.summary.added,
				removed: result.summary.removed,
				objectiveFailureModeDelta: resolveObjectiveFailureModeDelta(
					options.objective,
					result.summary.failureModes,
				),
			};
		}
	} catch (error) {
		console.error(
			`EvalGate auto ERROR: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 2;
	}

	const report = buildAutoReport({
		options,
		executionMode,
		diff,
		executionBudget,
		impactedSpecIds,
		iterations,
		head: resolvedHead,
		promptPath: resolvedPromptPath,
	});

	try {
		writeAutoReport(report, options.outputPath);
	} catch (error) {
		console.error(
			`EvalGate auto ERROR: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 3;
	}

	if (options.format === "json") {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(formatAutoHuman(report));
		console.log(`\nSaved → ${path.relative(projectRoot, options.outputPath)}`);
	}

	return 0;
}
