/**
 * Judge Governance — trust tiers, policy enforcement, and audit trail.
 *
 * Controls which judges are allowed to participate in evaluations and
 * enforces per-organisation policies (minimum judge count, required judges,
 * prohibited judges, trust-tier gates).
 *
 * Pure business-logic module — no DB or I/O dependencies.
 */

import type { JudgeReliabilityMetrics, ReliabilityTier } from "./reliability";

// ── Types ────────────────────────────────────────────────────────────────────

export type TrustTier = "trusted" | "probationary" | "suspended";

export interface JudgeRegistration {
	judgeId: string;
	name: string;
	/** Current trust tier */
	trustTier: TrustTier;
	/** Whether this judge is active and allowed to run */
	enabled: boolean;
	/** ISO timestamp when the registration was last updated */
	updatedAt: string;
	/** Optional note recorded by the governance actor */
	note: string | null;
}

export interface JudgePolicy {
	/** Minimum number of judges that must participate in a run */
	minJudgeCount: number;
	/** Judge IDs that MUST be included in every run (if enabled) */
	requiredJudgeIds: string[];
	/** Judge IDs that are prohibited from running */
	prohibitedJudgeIds: string[];
	/** Minimum trust tier for automatic participation */
	minTrustTier: TrustTier;
	/** Whether to allow probationary judges when trust tier = "trusted" is required */
	allowProbationaryFallback: boolean;
}

export interface GovernanceViolation {
	type:
		| "judge_suspended"
		| "judge_prohibited"
		| "below_min_count"
		| "missing_required_judge"
		| "below_trust_tier";
	judgeId?: string;
	detail: string;
}

export interface GovernanceAuditEntry {
	/** The judge affected */
	judgeId: string;
	/** What changed */
	action: "enabled" | "disabled" | "tier_changed" | "policy_updated";
	/** Who made the change (opaque actor ID) */
	actorId: string;
	/** Note */
	note: string | null;
	/** When */
	timestamp: string;
	/** Previous state snapshot */
	previous: Partial<JudgeRegistration> | Partial<JudgePolicy>;
	/** New state snapshot */
	next: Partial<JudgeRegistration> | Partial<JudgePolicy>;
}

// ── Default policy ────────────────────────────────────────────────────────────

export const DEFAULT_JUDGE_POLICY: JudgePolicy = {
	minJudgeCount: 1,
	requiredJudgeIds: [],
	prohibitedJudgeIds: [],
	minTrustTier: "probationary",
	allowProbationaryFallback: true,
};

// ── Trust tier helpers ────────────────────────────────────────────────────────

const TIER_RANK: Record<TrustTier, number> = {
	suspended: 0,
	probationary: 1,
	trusted: 2,
};

export function isTierSufficient(
	tier: TrustTier,
	minRequired: TrustTier,
): boolean {
	return TIER_RANK[tier] >= TIER_RANK[minRequired];
}

/**
 * Derive a recommended trust tier from reliability metrics.
 * Allows the governance layer to auto-promote/demote based on observed quality.
 */
export function recommendTrustTier(
	metrics: JudgeReliabilityMetrics,
): TrustTier {
	if (metrics.flagged) return "probationary";
	const tierMap: Record<ReliabilityTier, TrustTier> = {
		excellent: "trusted",
		good: "trusted",
		fair: "probationary",
		poor: "probationary",
		unrated: "probationary",
	};
	return tierMap[metrics.tier];
}

// ── Registration management ───────────────────────────────────────────────────

/**
 * Enable or disable a judge, creating an audit entry.
 */
export function setJudgeEnabled(
	registration: JudgeRegistration,
	enabled: boolean,
	actorId: string,
	note?: string,
): { updated: JudgeRegistration; auditEntry: GovernanceAuditEntry } {
	const previous = { ...registration };
	const updated: JudgeRegistration = {
		...registration,
		enabled,
		updatedAt: new Date().toISOString(),
		note: note ?? null,
	};
	const auditEntry: GovernanceAuditEntry = {
		judgeId: registration.judgeId,
		action: enabled ? "enabled" : "disabled",
		actorId,
		note: note ?? null,
		timestamp: updated.updatedAt,
		previous: { enabled: previous.enabled },
		next: { enabled },
	};
	return { updated, auditEntry };
}

/**
 * Change a judge's trust tier, creating an audit entry.
 */
export function setJudgeTrustTier(
	registration: JudgeRegistration,
	tier: TrustTier,
	actorId: string,
	note?: string,
): { updated: JudgeRegistration; auditEntry: GovernanceAuditEntry } {
	const previous = { ...registration };
	const updated: JudgeRegistration = {
		...registration,
		trustTier: tier,
		// Auto-suspend: disabled when tier is suspended
		enabled: tier === "suspended" ? false : registration.enabled,
		updatedAt: new Date().toISOString(),
		note: note ?? null,
	};
	const auditEntry: GovernanceAuditEntry = {
		judgeId: registration.judgeId,
		action: "tier_changed",
		actorId,
		note: note ?? null,
		timestamp: updated.updatedAt,
		previous: { trustTier: previous.trustTier, enabled: previous.enabled },
		next: { trustTier: tier, enabled: updated.enabled },
	};
	return { updated, auditEntry };
}

// ── Policy enforcement ────────────────────────────────────────────────────────

/**
 * Filter a candidate judge list to those allowed by the governance policy.
 * Returns the approved list plus any violations detected.
 */
export function filterAllowedJudges(
	candidates: JudgeRegistration[],
	policy: JudgePolicy = DEFAULT_JUDGE_POLICY,
): { allowed: JudgeRegistration[]; violations: GovernanceViolation[] } {
	const violations: GovernanceViolation[] = [];
	const prohibited = new Set(policy.prohibitedJudgeIds);

	const allowed = candidates.filter((reg) => {
		if (!reg.enabled) return false;

		if (reg.trustTier === "suspended") {
			violations.push({
				type: "judge_suspended",
				judgeId: reg.judgeId,
				detail: `Judge ${reg.judgeId} is suspended and cannot participate`,
			});
			return false;
		}

		if (prohibited.has(reg.judgeId)) {
			violations.push({
				type: "judge_prohibited",
				judgeId: reg.judgeId,
				detail: `Judge ${reg.judgeId} is on the prohibited list`,
			});
			return false;
		}

		if (!isTierSufficient(reg.trustTier, policy.minTrustTier)) {
			if (
				!(policy.allowProbationaryFallback && reg.trustTier === "probationary")
			) {
				violations.push({
					type: "below_trust_tier",
					judgeId: reg.judgeId,
					detail: `Judge ${reg.judgeId} trust tier "${reg.trustTier}" is below required "${policy.minTrustTier}"`,
				});
				return false;
			}
		}

		return true;
	});

	return { allowed, violations };
}

/**
 * Validate a set of approved judges against the policy constraints.
 * Returns any policy violations that would block a run.
 */
export function validateJudgeSet(
	approved: JudgeRegistration[],
	policy: JudgePolicy = DEFAULT_JUDGE_POLICY,
): GovernanceViolation[] {
	const violations: GovernanceViolation[] = [];
	const approvedIds = new Set(approved.map((r) => r.judgeId));

	if (approved.length < policy.minJudgeCount) {
		violations.push({
			type: "below_min_count",
			detail: `Only ${approved.length} judge(s) available, policy requires at least ${policy.minJudgeCount}`,
		});
	}

	for (const required of policy.requiredJudgeIds) {
		if (!approvedIds.has(required)) {
			violations.push({
				type: "missing_required_judge",
				judgeId: required,
				detail: `Required judge "${required}" is not in the approved set`,
			});
		}
	}

	return violations;
}

/**
 * Full governance gate: filter + validate in one call.
 * Returns whether the run is allowed, the approved judge list, and all violations.
 */
export function governanceGate(
	candidates: JudgeRegistration[],
	policy: JudgePolicy = DEFAULT_JUDGE_POLICY,
): {
	allowed: boolean;
	approvedJudges: JudgeRegistration[];
	violations: GovernanceViolation[];
} {
	const { allowed: approvedJudges, violations: filterViolations } =
		filterAllowedJudges(candidates, policy);
	const validationViolations = validateJudgeSet(approvedJudges, policy);
	const violations = [...filterViolations, ...validationViolations];
	const blockingViolations = validationViolations.filter(
		(v) => v.type === "below_min_count" || v.type === "missing_required_judge",
	);

	return {
		allowed: blockingViolations.length === 0,
		approvedJudges,
		violations,
	};
}
