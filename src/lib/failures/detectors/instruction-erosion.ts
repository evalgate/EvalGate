/**
 * Instruction Erosion Detector — tracks gradual drift in instruction adherence.
 *
 * Compares current agent behaviour against a set of declared instructions
 * and detects when instructions are being progressively ignored or weakened
 * over a sequence of responses.
 *
 * Pure module — no DB or I/O dependencies.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** A single declared instruction that the agent should follow */
export interface Instruction {
	/** Unique identifier */
	id: string;
	/** Human-readable description */
	description: string;
	/** Keywords or phrases that signal adherence */
	adherenceSignals: string[];
	/** Keywords or phrases that signal violation */
	violationSignals: string[];
	/** Relative importance 0-1 (used for weighted erosion score) */
	importance: number;
}

/** A single observation of one instruction in one response */
export interface InstructionObservation {
	instructionId: string;
	/** The response text to evaluate */
	responseText: string;
	/** Wall-clock timestamp (ms) */
	timestamp: number;
	/** Optional: manually overridden adherence score (0-1) */
	manualScore?: number;
}

/** Adherence result for one instruction in one observation */
export interface InstructionAdherence {
	instructionId: string;
	/** 0 = no adherence, 1 = full adherence */
	score: number;
	/** Whether any violation signals were matched */
	violated: boolean;
	/** Matched violation signals (if any) */
	violationEvidence: string[];
	/** Matched adherence signals (if any) */
	adherenceEvidence: string[];
}

/** Erosion result over a time window for a single instruction */
export interface InstructionErosionResult {
	instructionId: string;
	description: string;
	importance: number;
	/** Mean adherence score over the window */
	meanAdherence: number;
	/** Linear slope of adherence over time (-1 to +1 range) */
	adherenceSlope: number;
	/** Whether this instruction shows statistically significant erosion */
	isEroding: boolean;
	/** Severity: none / mild / moderate / severe */
	severity: ErosionSeverity;
	/** Number of observations in window */
	observationCount: number;
	/** Number of observations with violations */
	violationCount: number;
}

export type ErosionSeverity = "none" | "mild" | "moderate" | "severe";

/** Summary of instruction erosion across all instructions */
export interface ErosionReport {
	/** Weighted erosion index (0-1, higher = more erosion) */
	overallErosionIndex: number;
	/** Whether the overall erosion is above the alert threshold */
	alertTriggered: boolean;
	/** Per-instruction results */
	instructions: InstructionErosionResult[];
	/** Instructions actively showing erosion, sorted by severity */
	erodingInstructions: InstructionErosionResult[];
}

/** Config for the erosion detector */
export interface ErosionConfig {
	/** Minimum slope magnitude to flag as eroding (default: -0.05 per obs) */
	erosionSlopeThreshold?: number;
	/** Mean adherence below which a result is always flagged (default: 0.6) */
	lowAdherenceThreshold?: number;
	/** Minimum observations required to compute slope (default: 3) */
	minObservationsForSlope?: number;
	/** Overall erosion index threshold to trigger alert (default: 0.3) */
	alertThreshold?: number;
}

// ── Signal matching ───────────────────────────────────────────────────────────

function matchSignals(text: string, signals: string[]): string[] {
	const lower = text.toLowerCase();
	return signals.filter((s) => lower.includes(s.toLowerCase()));
}

/**
 * Score a single response against one instruction (0-1).
 * Uses signal matching: violations dominate adherence signals.
 */
export function scoreAdherence(
	instruction: Instruction,
	responseText: string,
): InstructionAdherence {
	const violationEvidence = matchSignals(responseText, instruction.violationSignals);
	const adherenceEvidence = matchSignals(responseText, instruction.adherenceSignals);

	let score: number;
	const violated = violationEvidence.length > 0;

	if (violated) {
		// Violations override: score penalised by violation density
		score = Math.max(0, 0.5 - violationEvidence.length * 0.2);
	} else if (adherenceEvidence.length > 0) {
		// Adherence signals present: score scales with coverage
		const coverage = Math.min(1, adherenceEvidence.length / Math.max(1, instruction.adherenceSignals.length));
		score = 0.5 + coverage * 0.5;
	} else {
		// No signals either way — neutral score
		score = 0.5;
	}

	return {
		instructionId: instruction.id,
		score,
		violated,
		violationEvidence,
		adherenceEvidence,
	};
}

// ── Slope computation ─────────────────────────────────────────────────────────

/**
 * Compute linear regression slope for a time series of scores.
 * Returns slope per observation index (not per ms).
 */
function computeSlope(scores: number[]): number {
	const n = scores.length;
	if (n < 2) return 0;
	const xs = scores.map((_, i) => i);
	const meanX = (n - 1) / 2;
	const meanY = scores.reduce((a, b) => a + b, 0) / n;
	const num = xs.reduce((s, x, i) => s + (x - meanX) * (scores[i]! - meanY), 0);
	const den = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
	return den === 0 ? 0 : num / den;
}

function classifySeverity(
	isEroding: boolean,
	meanAdherence: number,
	slope: number,
): ErosionSeverity {
	if (!isEroding) return "none";
	if (meanAdherence < 0.3 || slope < -0.15) return "severe";
	if (meanAdherence < 0.5 || slope < -0.08) return "moderate";
	return "mild";
}

// ── Per-instruction erosion ───────────────────────────────────────────────────

/**
 * Detect erosion for a single instruction across a sequence of observations.
 */
export function detectInstructionErosion(
	instruction: Instruction,
	observations: InstructionObservation[],
	config: ErosionConfig = {},
): InstructionErosionResult {
	const {
		erosionSlopeThreshold = -0.05,
		lowAdherenceThreshold = 0.6,
		minObservationsForSlope = 3,
	} = config;

	const myObs = observations
		.filter((o) => o.instructionId === instruction.id)
		.sort((a, b) => a.timestamp - b.timestamp);

	const scores = myObs.map((o) =>
		o.manualScore !== undefined
			? o.manualScore
			: scoreAdherence(instruction, o.responseText).score,
	);

	const violationCount = myObs.filter((o) => {
		if (o.manualScore !== undefined) return o.manualScore < 0.4;
		return scoreAdherence(instruction, o.responseText).violated;
	}).length;

	const meanAdherence = scores.length > 0
		? scores.reduce((a, b) => a + b, 0) / scores.length
		: 1.0;

	const slope = scores.length >= minObservationsForSlope ? computeSlope(scores) : 0;

	const isEroding =
		slope <= erosionSlopeThreshold || meanAdherence < lowAdherenceThreshold;

	return {
		instructionId: instruction.id,
		description: instruction.description,
		importance: instruction.importance,
		meanAdherence,
		adherenceSlope: slope,
		isEroding,
		severity: classifySeverity(isEroding, meanAdherence, slope),
		observationCount: myObs.length,
		violationCount,
	};
}

// ── Report ─────────────────────────────────────────────────────────────────────

/**
 * Generate a full erosion report across all declared instructions.
 */
export function generateErosionReport(
	instructions: Instruction[],
	observations: InstructionObservation[],
	config: ErosionConfig = {},
): ErosionReport {
	const { alertThreshold = 0.3 } = config;

	const results = instructions.map((inst) =>
		detectInstructionErosion(inst, observations, config),
	);

	const erodingInstructions = results
		.filter((r) => r.isEroding)
		.sort((a, b) => {
			const sev: Record<ErosionSeverity, number> = { severe: 3, moderate: 2, mild: 1, none: 0 };
			return sev[b.severity] - sev[a.severity];
		});

	// Weighted erosion index: per-instruction erosion contribution weighted by importance
	const totalImportance = instructions.reduce((s, i) => s + i.importance, 0);
	const overallErosionIndex = totalImportance === 0 ? 0 :
		results.reduce((s, r) => {
			const erosionMagnitude = r.isEroding ? (1 - r.meanAdherence) : 0;
			return s + erosionMagnitude * (r.importance / totalImportance);
		}, 0);

	return {
		overallErosionIndex: Math.min(1, Math.max(0, overallErosionIndex)),
		alertTriggered: overallErosionIndex >= alertThreshold,
		instructions: results,
		erodingInstructions,
	};
}
