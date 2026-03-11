import * as fs from "node:fs";
import * as path from "node:path";

import { resolveEvalWorkspace } from "./workspace";

export const AUTO_LEDGER_SCHEMA_VERSION = 1;

export type AutoDecision =
	| "plan"
	| "keep"
	| "discard"
	| "vetoed"
	| "investigate";

export type AutoPassRateBasis = "raw" | "corrected";

export interface AutoWorkspacePaths {
	projectRoot: string;
	evalDir: string;
	autoDir: string;
	ledgerPath: string;
	detailsDir: string;
	holdoutPath: string;
	latestPath: string;
	runsDir: string;
	programPath: string;
}

export interface AutoLedgerEntry {
	schemaVersion: number;
	experimentId: string;
	sessionId: string;
	timestamp: string;
	parentExperimentId: string;
	baselineRef: string;
	candidateRef: string;
	targetFailureMode: string;
	targetClusterId: string | null;
	mutationTarget: string;
	mutationFamily: string;
	patchSummary: string;
	patchHash: string;
	targetedSpecs: string[];
	holdoutSpecs: string[];
	utilityScore: number | null;
	objectiveReductionRatio: number;
	baselineObjectiveRate: number;
	candidateObjectiveRate: number;
	regressions: number;
	improvements: number;
	holdoutRegressions: number;
	passRateDeltaRatio: number;
	correctedPassRateDeltaRatio: number;
	passRateBasis: AutoPassRateBasis;
	latencyDeltaRatio: number;
	costDeltaRatio: number;
	decision: AutoDecision;
	hardVetoReason: string | null;
	costUsd: number;
	durationMs: number;
	detailsPath: string;
	reflection: string | null;
}

export type AutoLedgerEntryInput = Omit<AutoLedgerEntry, "schemaVersion">;

export interface AutoSpecSummary {
	passToFailIds: string[];
	failToPassIds: string[];
	unchangedIds: string[];
}

export interface AutoMutationDetails {
	target: string;
	family: string;
	summary: string;
}

export interface AutoUtilityDetails {
	inputMetrics: Record<string, unknown>;
	weights: Record<string, unknown>;
	computedScore: number | null;
}

export interface AutoVetoDetails {
	evaluatedRules: string[];
	matchedRule: string | null;
}

export interface AutoAnomalyDetails {
	latencySpikes: string[];
	unexpectedFlips: string[];
	missingFailureModeMapping: string[];
}

export interface AutoReportPaths {
	baseline: string;
	candidate: string;
	targeted?: string;
	holdout?: string;
}

export interface AutoExperimentDetails {
	experimentId: string;
	sessionId: string;
	baselineRef: string;
	candidateRef: string;
	mutation: AutoMutationDetails;
	utility: AutoUtilityDetails;
	veto: AutoVetoDetails;
	targetedSpecSummary: AutoSpecSummary;
	holdoutSpecSummary: AutoSpecSummary;
	anomalies: AutoAnomalyDetails;
	reportPaths: AutoReportPaths;
	reflection: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isIsoTimestamp(value: string): boolean {
	return !Number.isNaN(Date.parse(value));
}

function assertString(
	value: unknown,
	fieldName: string,
	allowEmpty = false,
): asserts value is string {
	if (typeof value !== "string") {
		throw new Error(`${fieldName} must be a string`);
	}
	if (!allowEmpty && value.trim().length === 0) {
		throw new Error(`${fieldName} must be a non-empty string`);
	}
}

function assertNullableString(
	value: unknown,
	fieldName: string,
): asserts value is string | null {
	if (value !== null && typeof value !== "string") {
		throw new Error(`${fieldName} must be a string or null`);
	}
	if (typeof value === "string" && value.trim().length === 0) {
		throw new Error(`${fieldName} must not be an empty string`);
	}
}

function assertNumber(
	value: unknown,
	fieldName: string,
): asserts value is number {
	if (!isFiniteNumber(value)) {
		throw new Error(`${fieldName} must be a finite number`);
	}
}

function assertNullableNumber(
	value: unknown,
	fieldName: string,
): asserts value is number | null {
	if (value !== null && !isFiniteNumber(value)) {
		throw new Error(`${fieldName} must be a finite number or null`);
	}
}

function assertStringArray(
	value: unknown,
	fieldName: string,
): asserts value is string[] {
	if (!Array.isArray(value)) {
		throw new Error(`${fieldName} must be an array of strings`);
	}
	for (const entry of value) {
		assertString(entry, fieldName);
	}
}

function assertDecision(value: unknown): asserts value is AutoDecision {
	if (
		value !== "plan" &&
		value !== "keep" &&
		value !== "discard" &&
		value !== "vetoed" &&
		value !== "investigate"
	) {
		throw new Error(
			"decision must be one of plan, keep, discard, vetoed, investigate",
		);
	}
}

function assertPassRateBasis(
	value: unknown,
): asserts value is AutoPassRateBasis {
	if (value !== "raw" && value !== "corrected") {
		throw new Error("passRateBasis must be 'raw' or 'corrected'");
	}
}

function parseJsonlRows(filePath: string): unknown[] {
	const content = fs.readFileSync(filePath, "utf8");
	return content
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line, index) => {
			try {
				return JSON.parse(line) as unknown;
			} catch {
				throw new Error(`Invalid JSONL at line ${index + 1}: ${line}`);
			}
		});
}

function ensureDirectoryForFile(filePath: string): void {
	const directory = path.dirname(filePath);
	if (!fs.existsSync(directory)) {
		fs.mkdirSync(directory, { recursive: true });
	}
}

function assertSpecSummary(
	value: unknown,
	fieldName: string,
): asserts value is AutoSpecSummary {
	if (!isRecord(value)) {
		throw new Error(`${fieldName} must be an object`);
	}
	assertStringArray(value.passToFailIds, `${fieldName}.passToFailIds`);
	assertStringArray(value.failToPassIds, `${fieldName}.failToPassIds`);
	assertStringArray(value.unchangedIds, `${fieldName}.unchangedIds`);
}

export function resolveAutoWorkspacePaths(
	projectRoot: string = process.cwd(),
): AutoWorkspacePaths {
	const workspace = resolveEvalWorkspace(projectRoot);
	const autoDir = path.join(workspace.evalDir, "auto");
	return {
		projectRoot,
		evalDir: workspace.evalDir,
		autoDir,
		ledgerPath: path.join(autoDir, "ledger.jsonl"),
		detailsDir: path.join(autoDir, "details"),
		holdoutPath: path.join(autoDir, "holdout.json"),
		latestPath: path.join(autoDir, "latest.json"),
		runsDir: path.join(autoDir, "runs"),
		programPath: path.join(autoDir, "program.md"),
	};
}

export function resolveAutoDetailsPath(
	experimentId: string,
	projectRoot: string = process.cwd(),
): string {
	assertString(experimentId, "experimentId");
	return path.join(
		resolveAutoWorkspacePaths(projectRoot).detailsDir,
		`${experimentId}.json`,
	);
}

export function resolveAutoDetailsRelativePath(
	experimentId: string,
	projectRoot: string = process.cwd(),
): string {
	return path.relative(
		projectRoot,
		resolveAutoDetailsPath(experimentId, projectRoot),
	);
}

export function createAutoLedgerEntry(
	input: AutoLedgerEntryInput,
): AutoLedgerEntry {
	return {
		schemaVersion: AUTO_LEDGER_SCHEMA_VERSION,
		...input,
	};
}

export function assertValidAutoLedgerEntry(
	value: unknown,
	fieldName = "entry",
): asserts value is AutoLedgerEntry {
	if (!isRecord(value)) {
		throw new Error(`${fieldName} must be an object`);
	}
	assertNumber(value.schemaVersion, `${fieldName}.schemaVersion`);
	if (value.schemaVersion !== AUTO_LEDGER_SCHEMA_VERSION) {
		throw new Error(
			`${fieldName}.schemaVersion must equal ${AUTO_LEDGER_SCHEMA_VERSION}`,
		);
	}
	assertString(value.experimentId, `${fieldName}.experimentId`);
	assertString(value.sessionId, `${fieldName}.sessionId`);
	assertString(value.timestamp, `${fieldName}.timestamp`);
	if (!isIsoTimestamp(value.timestamp)) {
		throw new Error(`${fieldName}.timestamp must be a valid ISO timestamp`);
	}
	assertString(value.parentExperimentId, `${fieldName}.parentExperimentId`);
	assertString(value.baselineRef, `${fieldName}.baselineRef`);
	assertString(value.candidateRef, `${fieldName}.candidateRef`);
	assertString(value.targetFailureMode, `${fieldName}.targetFailureMode`);
	assertNullableString(value.targetClusterId, `${fieldName}.targetClusterId`);
	assertString(value.mutationTarget, `${fieldName}.mutationTarget`);
	assertString(value.mutationFamily, `${fieldName}.mutationFamily`);
	assertString(value.patchSummary, `${fieldName}.patchSummary`);
	assertString(value.patchHash, `${fieldName}.patchHash`);
	assertStringArray(value.targetedSpecs, `${fieldName}.targetedSpecs`);
	assertStringArray(value.holdoutSpecs, `${fieldName}.holdoutSpecs`);
	assertNullableNumber(value.utilityScore, `${fieldName}.utilityScore`);
	assertNumber(
		value.objectiveReductionRatio,
		`${fieldName}.objectiveReductionRatio`,
	);
	assertNumber(
		value.baselineObjectiveRate,
		`${fieldName}.baselineObjectiveRate`,
	);
	assertNumber(
		value.candidateObjectiveRate,
		`${fieldName}.candidateObjectiveRate`,
	);
	assertNumber(value.regressions, `${fieldName}.regressions`);
	assertNumber(value.improvements, `${fieldName}.improvements`);
	assertNumber(value.holdoutRegressions, `${fieldName}.holdoutRegressions`);
	assertNumber(value.passRateDeltaRatio, `${fieldName}.passRateDeltaRatio`);
	assertNumber(
		value.correctedPassRateDeltaRatio,
		`${fieldName}.correctedPassRateDeltaRatio`,
	);
	assertPassRateBasis(value.passRateBasis);
	assertNumber(value.latencyDeltaRatio, `${fieldName}.latencyDeltaRatio`);
	assertNumber(value.costDeltaRatio, `${fieldName}.costDeltaRatio`);
	assertDecision(value.decision);
	assertNullableString(value.hardVetoReason, `${fieldName}.hardVetoReason`);
	assertNumber(value.costUsd, `${fieldName}.costUsd`);
	assertNumber(value.durationMs, `${fieldName}.durationMs`);
	assertString(value.detailsPath, `${fieldName}.detailsPath`);
	assertNullableString(value.reflection, `${fieldName}.reflection`);
}

export function appendAutoLedgerEntry(
	entry: AutoLedgerEntry,
	ledgerPath: string = resolveAutoWorkspacePaths().ledgerPath,
): void {
	assertValidAutoLedgerEntry(entry);
	ensureDirectoryForFile(ledgerPath);
	fs.appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`, "utf8");
}

export function readAutoLedgerEntries(
	ledgerPath: string = resolveAutoWorkspacePaths().ledgerPath,
): AutoLedgerEntry[] {
	if (!fs.existsSync(ledgerPath)) {
		return [];
	}
	return parseJsonlRows(ledgerPath).map((row, index) => {
		assertValidAutoLedgerEntry(row, `ledger[${index}]`);
		return row;
	});
}

export function assertValidAutoExperimentDetails(
	value: unknown,
	fieldName = "details",
): asserts value is AutoExperimentDetails {
	if (!isRecord(value)) {
		throw new Error(`${fieldName} must be an object`);
	}
	assertString(value.experimentId, `${fieldName}.experimentId`);
	assertString(value.sessionId, `${fieldName}.sessionId`);
	assertString(value.baselineRef, `${fieldName}.baselineRef`);
	assertString(value.candidateRef, `${fieldName}.candidateRef`);
	if (!isRecord(value.mutation)) {
		throw new Error(`${fieldName}.mutation must be an object`);
	}
	assertString(value.mutation.target, `${fieldName}.mutation.target`);
	assertString(value.mutation.family, `${fieldName}.mutation.family`);
	assertString(value.mutation.summary, `${fieldName}.mutation.summary`);
	if (!isRecord(value.utility)) {
		throw new Error(`${fieldName}.utility must be an object`);
	}
	if (!isRecord(value.utility.inputMetrics)) {
		throw new Error(`${fieldName}.utility.inputMetrics must be an object`);
	}
	if (!isRecord(value.utility.weights)) {
		throw new Error(`${fieldName}.utility.weights must be an object`);
	}
	assertNullableNumber(
		value.utility.computedScore,
		`${fieldName}.utility.computedScore`,
	);
	if (!isRecord(value.veto)) {
		throw new Error(`${fieldName}.veto must be an object`);
	}
	assertStringArray(
		value.veto.evaluatedRules,
		`${fieldName}.veto.evaluatedRules`,
	);
	assertNullableString(value.veto.matchedRule, `${fieldName}.veto.matchedRule`);
	assertSpecSummary(
		value.targetedSpecSummary,
		`${fieldName}.targetedSpecSummary`,
	);
	assertSpecSummary(
		value.holdoutSpecSummary,
		`${fieldName}.holdoutSpecSummary`,
	);
	if (!isRecord(value.anomalies)) {
		throw new Error(`${fieldName}.anomalies must be an object`);
	}
	assertStringArray(
		value.anomalies.latencySpikes,
		`${fieldName}.anomalies.latencySpikes`,
	);
	assertStringArray(
		value.anomalies.unexpectedFlips,
		`${fieldName}.anomalies.unexpectedFlips`,
	);
	assertStringArray(
		value.anomalies.missingFailureModeMapping,
		`${fieldName}.anomalies.missingFailureModeMapping`,
	);
	if (!isRecord(value.reportPaths)) {
		throw new Error(`${fieldName}.reportPaths must be an object`);
	}
	assertString(value.reportPaths.baseline, `${fieldName}.reportPaths.baseline`);
	assertString(
		value.reportPaths.candidate,
		`${fieldName}.reportPaths.candidate`,
	);
	if (value.reportPaths.targeted !== undefined) {
		assertString(
			value.reportPaths.targeted,
			`${fieldName}.reportPaths.targeted`,
		);
	}
	if (value.reportPaths.holdout !== undefined) {
		assertString(value.reportPaths.holdout, `${fieldName}.reportPaths.holdout`);
	}
	assertNullableString(value.reflection, `${fieldName}.reflection`);
}

export function writeAutoExperimentDetails(
	details: AutoExperimentDetails,
	detailsPath: string = resolveAutoDetailsPath(details.experimentId),
): void {
	assertValidAutoExperimentDetails(details);
	ensureDirectoryForFile(detailsPath);
	fs.writeFileSync(detailsPath, JSON.stringify(details, null, 2), "utf8");
}

export function readAutoExperimentDetails(
	detailsPath: string,
): AutoExperimentDetails {
	const parsed = JSON.parse(fs.readFileSync(detailsPath, "utf8")) as unknown;
	assertValidAutoExperimentDetails(parsed);
	return parsed;
}
