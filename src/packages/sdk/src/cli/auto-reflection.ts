import * as fs from "node:fs";
import * as path from "node:path";

import type { AssertionLLMConfig } from "../assertions";
import {
	type AutoDecision,
	type AutoExperimentDetails,
	type AutoLedgerEntry,
	resolveAutoWorkspacePaths,
} from "./auto-ledger";

export const AUTO_REFLECTION_SCHEMA_VERSION = "1";
const DEFAULT_REFLECTION_MAX_TOKENS = 500;
const DEFAULT_REFLECTION_TIMEOUT_MS = 30_000;
const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export interface AutoReflection {
	schemaVersion: "1";
	experimentId: string;
	sessionId: string;
	generatedAt: string;
	targetFailureMode: string;
	mutationFamily: string;
	decision: AutoDecision;
	whatChanged: string;
	whyItLikelyHelped: string | null;
	whatRegressed: string | null;
	whatToTryNext: string[];
	whatNotToRetry: string[];
	clusterId: string | null;
	utilityScore: number;
	objectiveRateBefore: number;
	objectiveRateAfter: number;
	regressions: number;
	hardVetoReason: string | null;
}

export interface GenerateAutoReflectionInput {
	entry: AutoLedgerEntry;
	details: AutoExperimentDetails;
	projectRoot?: string;
	llmConfig?: AssertionLLMConfig;
	maxTokens?: number;
	logger?: Pick<Console, "warn">;
}

interface ReflectionModelResponse {
	whyItLikelyHelped?: unknown;
	whatRegressed?: unknown;
	whatToTryNext?: unknown;
	whatNotToRetry?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
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

function assertStringArray(
	value: unknown,
	fieldName: string,
): asserts value is string[] {
	if (!Array.isArray(value)) {
		throw new Error(`${fieldName} must be an array of strings`);
	}
	for (const item of value) {
		assertString(item, fieldName);
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

function ensureDirectoryForFile(filePath: string): void {
	const directory = path.dirname(filePath);
	if (!fs.existsSync(directory)) {
		fs.mkdirSync(directory, { recursive: true });
	}
}

function isIsoTimestamp(value: string): boolean {
	return !Number.isNaN(Date.parse(value));
}

function resolveMaxTokens(maxTokens: number | undefined): number {
	if (typeof maxTokens !== "number" || !Number.isFinite(maxTokens)) {
		return DEFAULT_REFLECTION_MAX_TOKENS;
	}
	return Math.max(
		1,
		Math.min(DEFAULT_REFLECTION_MAX_TOKENS, Math.round(maxTokens)),
	);
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const deduped = new Set<string>();
	for (const item of value) {
		if (typeof item !== "string") {
			continue;
		}
		const trimmed = item.trim();
		if (trimmed.length > 0) {
			deduped.add(trimmed);
		}
	}
	return [...deduped];
}

function formatPercent(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}

function deriveWhatChanged(
	entry: AutoLedgerEntry,
	details: AutoExperimentDetails,
): string {
	const summary = details.mutation.summary.trim();
	if (summary.length > 0) {
		return summary;
	}
	return entry.patchSummary;
}

function deriveWhyItLikelyHelped(entry: AutoLedgerEntry): string | null {
	if (entry.decision === "discard" || entry.decision === "vetoed") {
		return null;
	}
	if (entry.candidateObjectiveRate < entry.baselineObjectiveRate) {
		return `The candidate reduced the target failure rate from ${formatPercent(entry.baselineObjectiveRate)} to ${formatPercent(entry.candidateObjectiveRate)}.`;
	}
	if (entry.improvements > 0) {
		return `The candidate improved ${entry.improvements} targeted spec${entry.improvements === 1 ? "" : "s"}.`;
	}
	return null;
}

function deriveWhatRegressed(entry: AutoLedgerEntry): string | null {
	const parts: string[] = [];
	if (entry.regressions > 0) {
		parts.push(
			`Observed ${entry.regressions} regression${entry.regressions === 1 ? "" : "s"}.`,
		);
	}
	if (entry.hardVetoReason) {
		parts.push(`Hard veto reason: ${entry.hardVetoReason}.`);
	}
	return parts.length > 0 ? parts.join(" ") : null;
}

function buildReflectionPrompt(
	entry: AutoLedgerEntry,
	details: AutoExperimentDetails,
): string {
	return [
		"You are summarizing an EvalGate auto experiment iteration.",
		"Return JSON only with this exact shape:",
		'{"whyItLikelyHelped":string|null,"whatRegressed":string|null,"whatToTryNext":string[],"whatNotToRetry":string[]}',
		"Rules:",
		"- Do not include markdown or code fences.",
		"- Keep each string concise and specific.",
		"- If the decision is discard or vetoed, set whyItLikelyHelped to null.",
		"- If there were no regressions and no hard veto, set whatRegressed to null.",
		"- whatToTryNext should be ordered next-step suggestions.",
		"- whatNotToRetry should contain explicit exclusions when the experiment clearly failed.",
		"Experiment ledger context:",
		JSON.stringify(
			{
				experimentId: entry.experimentId,
				sessionId: entry.sessionId,
				targetFailureMode: entry.targetFailureMode,
				mutationFamily: entry.mutationFamily,
				decision: entry.decision,
				patchSummary: entry.patchSummary,
				utilityScore: entry.utilityScore,
				objectiveRateBefore: entry.baselineObjectiveRate,
				objectiveRateAfter: entry.candidateObjectiveRate,
				regressions: entry.regressions,
				improvements: entry.improvements,
				hardVetoReason: entry.hardVetoReason,
				targetedSpecs: entry.targetedSpecs,
			},
			null,
			2,
		),
		"Experiment detail artifact:",
		JSON.stringify(details, null, 2),
	].join("\n\n");
}

async function callReflectionLLM(
	prompt: string,
	config: AssertionLLMConfig,
	maxTokens: number,
): Promise<string> {
	const timeoutMs = config.timeoutMs ?? DEFAULT_REFLECTION_TIMEOUT_MS;
	const ac =
		typeof AbortController !== "undefined" ? new AbortController() : null;
	const fetchWithSignal = (url: string, init: RequestInit): Promise<Response> =>
		fetch(url, ac ? { ...init, signal: ac.signal } : init);
	const llmCall = async (): Promise<string> => {
		if (config.provider === "anthropic") {
			const baseUrl = config.baseUrl ?? "https://api.anthropic.com";
			const model = config.model ?? DEFAULT_ANTHROPIC_MODEL;
			const response = await fetchWithSignal(`${baseUrl}/v1/messages`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": config.apiKey,
					"anthropic-version": "2023-06-01",
				},
				body: JSON.stringify({
					model,
					max_tokens: maxTokens,
					temperature: 0,
					messages: [{ role: "user", content: prompt }],
				}),
			});
			if (!response.ok) {
				throw new Error(
					`Anthropic API error ${response.status}: ${await response.text()}`,
				);
			}
			const data = (await response.json()) as {
				content?: Array<{ text?: string }>;
			};
			return data.content?.[0]?.text?.trim() ?? "";
		}
		if (config.provider === "openai") {
			const baseUrl = config.baseUrl ?? "https://api.openai.com";
			const model = config.model ?? DEFAULT_OPENAI_MODEL;
			const response = await fetchWithSignal(`${baseUrl}/v1/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config.apiKey}`,
				},
				body: JSON.stringify({
					model,
					messages: [{ role: "user", content: prompt }],
					max_tokens: maxTokens,
					temperature: 0,
				}),
			});
			if (!response.ok) {
				throw new Error(
					`OpenAI API error ${response.status}: ${await response.text()}`,
				);
			}
			const data = (await response.json()) as {
				choices?: Array<{ message?: { content?: string } }>;
			};
			return data.choices?.[0]?.message?.content?.trim() ?? "";
		}
		throw new Error(`Unsupported provider: ${config.provider}`);
	};
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			ac?.abort();
			reject(
				new Error(`Auto reflection LLM call timed out after ${timeoutMs}ms`),
			);
		}, timeoutMs);
	});
	try {
		return await Promise.race([llmCall(), timeoutPromise]);
	} finally {
		clearTimeout(timer);
	}
}

function parseReflectionResponse(text: string): ReflectionModelResponse {
	const trimmed = text.trim();
	const parseCandidate = (candidate: string): ReflectionModelResponse => {
		const parsed = JSON.parse(candidate) as unknown;
		if (!isRecord(parsed)) {
			throw new Error("Reflection response must be a JSON object");
		}
		return parsed as ReflectionModelResponse;
	};
	try {
		return parseCandidate(trimmed);
	} catch {
		const firstBrace = trimmed.indexOf("{");
		const lastBrace = trimmed.lastIndexOf("}");
		if (firstBrace >= 0 && lastBrace > firstBrace) {
			return parseCandidate(trimmed.slice(firstBrace, lastBrace + 1));
		}
		throw new Error("Reflection response was not valid JSON");
	}
}

function buildFallbackAutoReflection(
	input: GenerateAutoReflectionInput,
): AutoReflection {
	const { entry, details } = input;
	return {
		schemaVersion: AUTO_REFLECTION_SCHEMA_VERSION,
		experimentId: entry.experimentId,
		sessionId: entry.sessionId,
		generatedAt: new Date().toISOString(),
		targetFailureMode: entry.targetFailureMode,
		mutationFamily: entry.mutationFamily,
		decision: entry.decision,
		whatChanged: deriveWhatChanged(entry, details),
		whyItLikelyHelped: deriveWhyItLikelyHelped(entry),
		whatRegressed: deriveWhatRegressed(entry),
		whatToTryNext: [],
		whatNotToRetry:
			entry.decision === "discard" || entry.decision === "vetoed"
				? [entry.mutationFamily]
				: [],
		clusterId: entry.targetClusterId,
		utilityScore: entry.utilityScore ?? 0,
		objectiveRateBefore: entry.baselineObjectiveRate,
		objectiveRateAfter: entry.candidateObjectiveRate,
		regressions: entry.regressions,
		hardVetoReason: entry.hardVetoReason,
	};
}

function normalizeReflection(
	input: GenerateAutoReflectionInput,
	response: ReflectionModelResponse,
): AutoReflection {
	const fallback = buildFallbackAutoReflection(input);
	const whyItLikelyHelped =
		fallback.decision === "discard" || fallback.decision === "vetoed"
			? null
			: typeof response.whyItLikelyHelped === "string" &&
					response.whyItLikelyHelped.trim().length > 0
				? response.whyItLikelyHelped.trim()
				: fallback.whyItLikelyHelped;
	const whatRegressed =
		fallback.regressions === 0 && fallback.hardVetoReason === null
			? null
			: typeof response.whatRegressed === "string" &&
					response.whatRegressed.trim().length > 0
				? response.whatRegressed.trim()
				: fallback.whatRegressed;
	return {
		...fallback,
		whyItLikelyHelped,
		whatRegressed,
		whatToTryNext: normalizeStringArray(response.whatToTryNext),
		whatNotToRetry: normalizeStringArray(response.whatNotToRetry),
	};
}

export function resolveAutoReflectionPath(
	experimentId: string,
	projectRoot: string = process.cwd(),
): string {
	assertString(experimentId, "experimentId");
	return path.join(
		resolveAutoWorkspacePaths(projectRoot).autoDir,
		"reflections",
		`${experimentId}.json`,
	);
}

export function resolveAutoReflectionRelativePath(
	experimentId: string,
	projectRoot: string = process.cwd(),
): string {
	return path.relative(
		projectRoot,
		resolveAutoReflectionPath(experimentId, projectRoot),
	);
}

export function assertValidAutoReflection(
	value: unknown,
	fieldName = "reflection",
): asserts value is AutoReflection {
	if (!isRecord(value)) {
		throw new Error(`${fieldName} must be an object`);
	}
	assertString(value.schemaVersion, `${fieldName}.schemaVersion`);
	if (value.schemaVersion !== AUTO_REFLECTION_SCHEMA_VERSION) {
		throw new Error(
			`${fieldName}.schemaVersion must equal ${AUTO_REFLECTION_SCHEMA_VERSION}`,
		);
	}
	assertString(value.experimentId, `${fieldName}.experimentId`);
	assertString(value.sessionId, `${fieldName}.sessionId`);
	assertString(value.generatedAt, `${fieldName}.generatedAt`);
	if (!isIsoTimestamp(value.generatedAt)) {
		throw new Error(`${fieldName}.generatedAt must be a valid ISO timestamp`);
	}
	assertString(value.targetFailureMode, `${fieldName}.targetFailureMode`);
	assertString(value.mutationFamily, `${fieldName}.mutationFamily`);
	assertDecision(value.decision);
	assertString(value.whatChanged, `${fieldName}.whatChanged`);
	assertNullableString(
		value.whyItLikelyHelped,
		`${fieldName}.whyItLikelyHelped`,
	);
	assertNullableString(value.whatRegressed, `${fieldName}.whatRegressed`);
	assertStringArray(value.whatToTryNext, `${fieldName}.whatToTryNext`);
	assertStringArray(value.whatNotToRetry, `${fieldName}.whatNotToRetry`);
	assertNullableString(value.clusterId, `${fieldName}.clusterId`);
	assertNumber(value.utilityScore, `${fieldName}.utilityScore`);
	assertNumber(value.objectiveRateBefore, `${fieldName}.objectiveRateBefore`);
	assertNumber(value.objectiveRateAfter, `${fieldName}.objectiveRateAfter`);
	assertNumber(value.regressions, `${fieldName}.regressions`);
	assertNullableString(value.hardVetoReason, `${fieldName}.hardVetoReason`);
}

export function writeAutoReflection(
	reflection: AutoReflection,
	reflectionPath: string = resolveAutoReflectionPath(reflection.experimentId),
): void {
	assertValidAutoReflection(reflection);
	ensureDirectoryForFile(reflectionPath);
	fs.writeFileSync(reflectionPath, JSON.stringify(reflection, null, 2), "utf8");
}

export function readAutoReflection(reflectionPath: string): AutoReflection {
	const parsed = JSON.parse(fs.readFileSync(reflectionPath, "utf8")) as unknown;
	assertValidAutoReflection(parsed);
	return parsed;
}

export async function generateAutoReflection(
	input: GenerateAutoReflectionInput,
): Promise<AutoReflection> {
	const logger = input.logger ?? console;
	if (!input.llmConfig) {
		logger.warn(
			`EvalGate auto WARNING: reflection generation skipped for ${input.entry.experimentId} because no LLM config was provided.`,
		);
		return buildFallbackAutoReflection(input);
	}
	try {
		const responseText = await callReflectionLLM(
			buildReflectionPrompt(input.entry, input.details),
			input.llmConfig,
			resolveMaxTokens(input.maxTokens),
		);
		return normalizeReflection(input, parseReflectionResponse(responseText));
	} catch (error) {
		logger.warn(
			`EvalGate auto WARNING: reflection generation failed for ${input.entry.experimentId}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return buildFallbackAutoReflection(input);
	}
}

export async function generateAndWriteAutoReflection(
	input: GenerateAutoReflectionInput,
): Promise<AutoReflection> {
	const reflection = await generateAutoReflection(input);
	writeAutoReflection(
		reflection,
		resolveAutoReflectionPath(reflection.experimentId, input.projectRoot),
	);
	return reflection;
}
