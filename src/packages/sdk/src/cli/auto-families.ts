import type { AutoDecision, AutoLedgerEntry } from "./auto-ledger";

export interface MutationFamily {
	id: string;
	description: string;
	defaultPriority: number;
	targetedFailureModes: string[];
	estimatedCost: "low" | "medium" | "high";
	patchTemplate: string | null;
}

export interface FamilyPrior {
	familyId: string;
	failureMode: string;
	attempts: number;
	wins: number;
	winRate: number;
	avgUtilityOnWin: number;
	lastAttemptedAt: string;
	vetoed: number;
}

export const BUILT_IN_FAMILIES: MutationFamily[] = [
	{
		id: "constraint-clarification",
		description: "Make implicit constraints explicit in the prompt",
		defaultPriority: 8,
		targetedFailureModes: ["constraint_missing", "policy_violation"],
		estimatedCost: "low",
		patchTemplate:
			"Add explicit constraint: [CONSTRAINT] must be [REQUIREMENT]",
	},
	{
		id: "instruction-order",
		description: "Reorder instructions to front-load critical requirements",
		defaultPriority: 6,
		targetedFailureModes: ["constraint_missing", "formatting"],
		estimatedCost: "low",
		patchTemplate: null,
	},
	{
		id: "few-shot-examples",
		description: "Add 2-3 examples demonstrating correct behavior",
		defaultPriority: 7,
		targetedFailureModes: ["tone_mismatch", "generalization"],
		estimatedCost: "medium",
		patchTemplate: "Example: Input: [INPUT] → Output: [CORRECT_OUTPUT]",
	},
	{
		id: "format-lock",
		description: "Add explicit output format constraints",
		defaultPriority: 5,
		targetedFailureModes: ["formatting", "hallucination"],
		estimatedCost: "low",
		patchTemplate: null,
	},
	{
		id: "retrieval-grounding",
		description: "Add instructions to ground responses in retrieved context",
		defaultPriority: 7,
		targetedFailureModes: ["hallucination", "factual_accuracy"],
		estimatedCost: "medium",
		patchTemplate: null,
	},
	{
		id: "uncertainty-abstention",
		description: "Add explicit instructions for handling low-confidence cases",
		defaultPriority: 4,
		targetedFailureModes: ["hallucination", "overconfidence"],
		estimatedCost: "low",
		patchTemplate: null,
	},
	{
		id: "tool-before-answer",
		description: "Reorder to require tool use before generating response",
		defaultPriority: 6,
		targetedFailureModes: ["invalid_tool_call", "hallucination"],
		estimatedCost: "low",
		patchTemplate: null,
	},
];

function shouldCountAttempt(decision: AutoDecision): boolean {
	return decision === "keep" || decision === "discard" || decision === "vetoed";
}

function getDefaultPriority(
	familyId: string,
	families: MutationFamily[],
): number {
	return (
		families.find((family) => family.id === familyId)?.defaultPriority ?? 0
	);
}

export function listMutationFamilies(): MutationFamily[] {
	return BUILT_IN_FAMILIES.map((family) => ({
		...family,
		targetedFailureModes: [...family.targetedFailureModes],
	}));
}

export function getMutationFamily(familyId: string): MutationFamily | null {
	const family = BUILT_IN_FAMILIES.find(
		(candidate) => candidate.id === familyId,
	);
	return family
		? { ...family, targetedFailureModes: [...family.targetedFailureModes] }
		: null;
}

export function computeFamilyPriors(
	ledgerEntries: AutoLedgerEntry[],
	targetFailureMode: string,
): FamilyPrior[] {
	const familyStats = new Map<
		string,
		{
			attempts: number;
			wins: number;
			utilitySumOnWin: number;
			utilityWins: number;
			lastAttemptedAt: string;
			vetoed: number;
		}
	>();
	for (const entry of ledgerEntries) {
		if (entry.targetFailureMode !== targetFailureMode) {
			continue;
		}
		if (!shouldCountAttempt(entry.decision)) {
			continue;
		}
		const current = familyStats.get(entry.mutationFamily) ?? {
			attempts: 0,
			wins: 0,
			utilitySumOnWin: 0,
			utilityWins: 0,
			lastAttemptedAt: entry.timestamp,
			vetoed: 0,
		};
		current.attempts += 1;
		if (entry.decision === "keep") {
			current.wins += 1;
			if (entry.utilityScore !== null) {
				current.utilitySumOnWin += entry.utilityScore;
				current.utilityWins += 1;
			}
		}
		if (entry.decision === "vetoed") {
			current.vetoed += 1;
		}
		if (entry.timestamp.localeCompare(current.lastAttemptedAt) > 0) {
			current.lastAttemptedAt = entry.timestamp;
		}
		familyStats.set(entry.mutationFamily, current);
	}
	return [...familyStats.entries()]
		.map(([familyId, stats]) => ({
			familyId,
			failureMode: targetFailureMode,
			attempts: stats.attempts,
			wins: stats.wins,
			winRate: stats.attempts === 0 ? 0 : stats.wins / stats.attempts,
			avgUtilityOnWin:
				stats.utilityWins === 0 ? 0 : stats.utilitySumOnWin / stats.utilityWins,
			lastAttemptedAt: stats.lastAttemptedAt,
			vetoed: stats.vetoed,
		}))
		.sort((left, right) => {
			if (right.winRate !== left.winRate) {
				return right.winRate - left.winRate;
			}
			if (right.attempts !== left.attempts) {
				return right.attempts - left.attempts;
			}
			return left.familyId.localeCompare(right.familyId);
		});
}

export function resolveFamilyPriorityScore(
	familyId: string,
	familyPriors: FamilyPrior[],
	families: MutationFamily[] = BUILT_IN_FAMILIES,
): number {
	const defaultPriority = getDefaultPriority(familyId, families) / 10;
	const prior = familyPriors.find(
		(candidate) => candidate.familyId === familyId,
	);
	if (!prior || prior.attempts === 0) {
		return defaultPriority;
	}
	return prior.winRate * 0.7 + defaultPriority * 0.3;
}

export function rankMutationFamilies(
	allowedFamilies: string[],
	familyPriors: FamilyPrior[],
	families: MutationFamily[] = BUILT_IN_FAMILIES,
): string[] {
	return [...allowedFamilies].sort((left, right) => {
		const rightPriority = resolveFamilyPriorityScore(
			right,
			familyPriors,
			families,
		);
		const leftPriority = resolveFamilyPriorityScore(
			left,
			familyPriors,
			families,
		);
		if (rightPriority !== leftPriority) {
			return rightPriority - leftPriority;
		}
		const rightDefault = getDefaultPriority(right, families);
		const leftDefault = getDefaultPriority(left, families);
		if (rightDefault !== leftDefault) {
			return rightDefault - leftDefault;
		}
		return left.localeCompare(right);
	});
}
