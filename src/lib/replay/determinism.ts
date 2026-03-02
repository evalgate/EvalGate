/**
 * Replay Determinism — Tier classification and tolerance rules for replay.
 *
 * Tiers prevent overpromising determinism to users:
 *   A = Deterministic: all tool outputs + model config + pinned commitSha
 *   B = Semi-deterministic: same inputs, model nondeterminism within tolerance
 *   C = Best-effort: external APIs not recorded; reconstructs flow only
 */

import type { ReplayTier } from "@/lib/traces/trace-freezer";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeterminismClassification {
	tier: ReplayTier;
	label: string;
	description: string;
	confidence: number;
	scoreTolerance: number;
	reasons: string[];
	warnings: string[];
}

export interface DeterminismOptions {
	/** Required score similarity for Tier B replay to be considered "matching" (0-1) */
	tierBScoreTolerance?: number;
	/** Required score similarity for Tier A replay (0-1) */
	tierAScoreTolerance?: number;
}

export interface ReplayValidationResult {
	passed: boolean;
	tier: ReplayTier;
	originalScore: number;
	replayScore: number;
	delta: number;
	withinTolerance: boolean;
	toleranceUsed: number;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_TIER_A_TOLERANCE = 0.05; // 5% delta allowed
const DEFAULT_TIER_B_TOLERANCE = 0.15; // 15% delta allowed

// ── Tier labels ───────────────────────────────────────────────────────────────

const TIER_LABELS: Record<
	ReplayTier,
	{ label: string; description: string; confidence: number }
> = {
	A: {
		label: "Deterministic",
		description:
			"Same tool outputs + model config + pinned commit → identical behavior expected",
		confidence: 0.95,
	},
	B: {
		label: "Semi-deterministic",
		description:
			"Same inputs captured but model nondeterminism may cause variation; matches within score tolerance",
		confidence: 0.7,
	},
	C: {
		label: "Best-effort",
		description:
			"External APIs not recorded; replay reconstructs the execution flow but outputs may differ",
		confidence: 0.4,
	},
};

// ── Core classification ───────────────────────────────────────────────────────

export interface SnapshotForClassification {
	commitSha: string | null;
	toolOutputCaptureMode: "full" | "hash" | "none";
	externalDeps: Array<{ captured: boolean; type: string }>;
	modelConfig: {
		model: string | null;
		temperature: number | null;
	};
	spans: Array<{
		toolCalls: Array<{ captureMode: string }>;
	}>;
}

/**
 * Classify the determinism tier of a frozen snapshot and explain the reasoning.
 */
export function classifyDeterminism(
	snapshot: SnapshotForClassification,
	options: DeterminismOptions = {},
): DeterminismClassification {
	const reasons: string[] = [];
	const warnings: string[] = [];
	let tier: ReplayTier = "A";

	const tierAScoreTolerance =
		options.tierAScoreTolerance ?? DEFAULT_TIER_A_TOLERANCE;
	const tierBScoreTolerance =
		options.tierBScoreTolerance ?? DEFAULT_TIER_B_TOLERANCE;

	// Check external deps
	const uncapturedDeps = snapshot.externalDeps.filter((d) => !d.captured);
	if (uncapturedDeps.length > 0) {
		tier = "C";
		reasons.push(
			`${uncapturedDeps.length} external dependency(ies) not captured: ${uncapturedDeps.map((d) => d.type).join(", ")}`,
		);
		warnings.push("External API calls will be re-executed; outputs may differ");
	}

	// Check tool output capture
	if (tier !== "C") {
		const hasToolCalls = snapshot.spans.some((s) =>
			s.toolCalls.some((t) => t.captureMode !== "full"),
		);
		if (hasToolCalls) {
			tier = "B";
			reasons.push("Tool calls present but outputs not fully captured");
			warnings.push("Tool re-execution may produce different outputs");
		}
	}

	// Check model config
	if (tier !== "C") {
		if (!snapshot.modelConfig.model) {
			if (tier === "A") tier = "B";
			reasons.push("Model name not captured");
			warnings.push("Different model may be used on replay");
		}
		if (snapshot.modelConfig.temperature === null) {
			if (tier === "A") tier = "B";
			reasons.push("Temperature not captured");
			warnings.push("Model sampling may differ on replay");
		}
	}

	// Check commitSha
	if (tier !== "C") {
		if (!snapshot.commitSha) {
			if (tier === "A") tier = "B";
			reasons.push("No commit SHA recorded — code may have changed");
			warnings.push("Prompt/tool code may differ on replay");
		}
	}

	// Populate positive reasons for Tier A
	if (tier === "A") {
		reasons.push("All tool outputs captured (full mode)");
		reasons.push("Model config (model + temperature) captured");
		reasons.push(`Commit SHA pinned: ${snapshot.commitSha}`);
	}

	const meta = TIER_LABELS[tier];

	return {
		tier,
		label: meta.label,
		description: meta.description,
		confidence: meta.confidence,
		scoreTolerance:
			tier === "A"
				? tierAScoreTolerance
				: tier === "B"
					? tierBScoreTolerance
					: 1.0,
		reasons,
		warnings,
	};
}

/**
 * Validate whether a replay result passes the tier's tolerance criteria.
 */
export function validateReplayResult(
	tier: ReplayTier,
	originalScore: number,
	replayScore: number,
	options: DeterminismOptions = {},
): ReplayValidationResult {
	const tierAScoreTolerance =
		options.tierAScoreTolerance ?? DEFAULT_TIER_A_TOLERANCE;
	const tierBScoreTolerance =
		options.tierBScoreTolerance ?? DEFAULT_TIER_B_TOLERANCE;

	const toleranceUsed =
		tier === "A"
			? tierAScoreTolerance
			: tier === "B"
				? tierBScoreTolerance
				: 1.0;

	const delta = Math.abs(originalScore - replayScore);
	const withinTolerance = delta <= toleranceUsed;

	return {
		passed: tier === "C" || withinTolerance,
		tier,
		originalScore,
		replayScore,
		delta,
		withinTolerance,
		toleranceUsed,
	};
}

/**
 * Format a human-readable tier summary for CLI output.
 */
export function formatTierSummary(
	classification: DeterminismClassification,
): string {
	const lines = [
		`Replay Tier: ${classification.tier} — ${classification.label}`,
		`Description: ${classification.description}`,
		`Score Tolerance: ±${(classification.scoreTolerance * 100).toFixed(0)}%`,
	];

	if (classification.reasons.length > 0) {
		lines.push("", "Reasons:");
		for (const r of classification.reasons) {
			lines.push(`  • ${r}`);
		}
	}

	if (classification.warnings.length > 0) {
		lines.push("", "Warnings:");
		for (const w of classification.warnings) {
			lines.push(`  ⚠ ${w}`);
		}
	}

	return lines.join("\n");
}
