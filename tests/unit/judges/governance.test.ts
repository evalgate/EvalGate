import { describe, expect, it } from "vitest";
import {
	DEFAULT_JUDGE_POLICY,
	filterAllowedJudges,
	governanceGate,
	isTierSufficient,
	type JudgePolicy,
	type JudgeRegistration,
	recommendTrustTier,
	setJudgeEnabled,
	setJudgeTrustTier,
	validateJudgeSet,
} from "@/lib/judges/governance";
import type { JudgeReliabilityMetrics } from "@/lib/judges/reliability";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function reg(
	judgeId: string,
	tier: JudgeRegistration["trustTier"] = "trusted",
	enabled = true,
): JudgeRegistration {
	return {
		judgeId,
		name: judgeId,
		trustTier: tier,
		enabled,
		updatedAt: new Date().toISOString(),
		note: null,
	};
}

const TRUSTED = reg("gpt-4o", "trusted");
const PROBATIONARY = reg("gpt-3.5", "probationary");
const SUSPENDED = reg("old-judge", "suspended");
const DISABLED = reg("offline-judge", "trusted", false);

// ── isTierSufficient ──────────────────────────────────────────────────────────

describe("isTierSufficient", () => {
	it("trusted >= trusted", () =>
		expect(isTierSufficient("trusted", "trusted")).toBe(true));
	it("trusted >= probationary", () =>
		expect(isTierSufficient("trusted", "probationary")).toBe(true));
	it("probationary < trusted", () =>
		expect(isTierSufficient("probationary", "trusted")).toBe(false));
	it("suspended < probationary", () =>
		expect(isTierSufficient("suspended", "probationary")).toBe(false));
	it("suspended < suspended is false", () =>
		expect(isTierSufficient("suspended", "trusted")).toBe(false));
});

// ── recommendTrustTier ────────────────────────────────────────────────────────

describe("recommendTrustTier", () => {
	function metrics(
		tier: JudgeReliabilityMetrics["tier"],
		flagged = false,
	): JudgeReliabilityMetrics {
		return {
			judgeId: "x",
			observationCount: 10,
			mae: null,
			bias: null,
			calibration: null,
			recentStdDev: 0.05,
			tier,
			flagged,
			flagReason: null,
		};
	}

	it("excellent → trusted", () =>
		expect(recommendTrustTier(metrics("excellent"))).toBe("trusted"));
	it("good → trusted", () =>
		expect(recommendTrustTier(metrics("good"))).toBe("trusted"));
	it("fair → probationary", () =>
		expect(recommendTrustTier(metrics("fair"))).toBe("probationary"));
	it("poor → probationary", () =>
		expect(recommendTrustTier(metrics("poor"))).toBe("probationary"));
	it("flagged excellent → probationary", () =>
		expect(recommendTrustTier(metrics("excellent", true))).toBe(
			"probationary",
		));
});

// ── setJudgeEnabled ────────────────────────────────────────────────────────────

describe("setJudgeEnabled", () => {
	it("disables a judge and creates audit entry", () => {
		const { updated, auditEntry } = setJudgeEnabled(
			TRUSTED,
			false,
			"admin-1",
			"Going offline",
		);
		expect(updated.enabled).toBe(false);
		expect(auditEntry.action).toBe("disabled");
		expect(auditEntry.actorId).toBe("admin-1");
		expect(auditEntry.note).toBe("Going offline");
	});

	it("enables a judge and creates audit entry", () => {
		const { updated, auditEntry } = setJudgeEnabled(DISABLED, true, "admin-1");
		expect(updated.enabled).toBe(true);
		expect(auditEntry.action).toBe("enabled");
	});

	it("audit entry records previous and next state", () => {
		const { auditEntry } = setJudgeEnabled(TRUSTED, false, "admin-1");
		expect(auditEntry.previous).toMatchObject({ enabled: true });
		expect(auditEntry.next).toMatchObject({ enabled: false });
	});
});

// ── setJudgeTrustTier ─────────────────────────────────────────────────────────

describe("setJudgeTrustTier", () => {
	it("changes tier", () => {
		const { updated } = setJudgeTrustTier(TRUSTED, "probationary", "admin-2");
		expect(updated.trustTier).toBe("probationary");
	});

	it("auto-disables judge when suspended", () => {
		const { updated } = setJudgeTrustTier(TRUSTED, "suspended", "admin-2");
		expect(updated.enabled).toBe(false);
	});

	it("does not force-enable when promoted to probationary", () => {
		const { updated } = setJudgeTrustTier(DISABLED, "probationary", "admin-2");
		expect(updated.enabled).toBe(false);
	});

	it("creates audit entry with tier_changed action", () => {
		const { auditEntry } = setJudgeTrustTier(
			TRUSTED,
			"probationary",
			"admin-2",
			"Downgraded: poor metrics",
		);
		expect(auditEntry.action).toBe("tier_changed");
		expect(auditEntry.note).toBe("Downgraded: poor metrics");
	});
});

// ── filterAllowedJudges ───────────────────────────────────────────────────────

describe("filterAllowedJudges", () => {
	const candidates = [TRUSTED, PROBATIONARY, SUSPENDED, DISABLED];

	it("excludes suspended judges", () => {
		const { allowed } = filterAllowedJudges(candidates);
		expect(allowed.map((r) => r.judgeId)).not.toContain("old-judge");
	});

	it("excludes disabled judges", () => {
		const { allowed } = filterAllowedJudges(candidates);
		expect(allowed.map((r) => r.judgeId)).not.toContain("offline-judge");
	});

	it("includes trusted and probationary by default", () => {
		const { allowed } = filterAllowedJudges(candidates);
		const ids = allowed.map((r) => r.judgeId);
		expect(ids).toContain("gpt-4o");
		expect(ids).toContain("gpt-3.5");
	});

	it("excludes prohibited judges", () => {
		const policy: JudgePolicy = {
			...DEFAULT_JUDGE_POLICY,
			prohibitedJudgeIds: ["gpt-4o"],
		};
		const { allowed, violations } = filterAllowedJudges(candidates, policy);
		expect(allowed.map((r) => r.judgeId)).not.toContain("gpt-4o");
		expect(violations.some((v) => v.type === "judge_prohibited")).toBe(true);
	});

	it("excludes probationary when minTrustTier=trusted and no fallback", () => {
		const policy: JudgePolicy = {
			...DEFAULT_JUDGE_POLICY,
			minTrustTier: "trusted",
			allowProbationaryFallback: false,
		};
		const { allowed } = filterAllowedJudges(candidates, policy);
		expect(allowed.map((r) => r.judgeId)).not.toContain("gpt-3.5");
	});

	it("allows probationary as fallback when minTrustTier=trusted and fallback=true", () => {
		const policy: JudgePolicy = {
			...DEFAULT_JUDGE_POLICY,
			minTrustTier: "trusted",
			allowProbationaryFallback: true,
		};
		const { allowed } = filterAllowedJudges(candidates, policy);
		expect(allowed.map((r) => r.judgeId)).toContain("gpt-3.5");
	});
});

// ── validateJudgeSet ──────────────────────────────────────────────────────────

describe("validateJudgeSet", () => {
	it("no violations when count and required judges met", () => {
		const violations = validateJudgeSet([TRUSTED, PROBATIONARY]);
		expect(violations).toHaveLength(0);
	});

	it("below_min_count violation when too few judges", () => {
		const policy: JudgePolicy = { ...DEFAULT_JUDGE_POLICY, minJudgeCount: 3 };
		const violations = validateJudgeSet([TRUSTED], policy);
		expect(violations.some((v) => v.type === "below_min_count")).toBe(true);
	});

	it("missing_required_judge violation when required judge absent", () => {
		const policy: JudgePolicy = {
			...DEFAULT_JUDGE_POLICY,
			requiredJudgeIds: ["mandatory-judge"],
		};
		const violations = validateJudgeSet([TRUSTED, PROBATIONARY], policy);
		expect(
			violations.some(
				(v) =>
					v.type === "missing_required_judge" &&
					v.judgeId === "mandatory-judge",
			),
		).toBe(true);
	});
});

// ── governanceGate ────────────────────────────────────────────────────────────

describe("governanceGate", () => {
	it("allows run when all conditions met", () => {
		const { allowed, approvedJudges } = governanceGate([TRUSTED, PROBATIONARY]);
		expect(allowed).toBe(true);
		expect(approvedJudges.length).toBeGreaterThanOrEqual(1);
	});

	it("blocks run when min count not met after filtering", () => {
		const policy: JudgePolicy = { ...DEFAULT_JUDGE_POLICY, minJudgeCount: 5 };
		const { allowed } = governanceGate([TRUSTED, PROBATIONARY], policy);
		expect(allowed).toBe(false);
	});

	it("blocks run when required judge missing after filtering", () => {
		const policy: JudgePolicy = {
			...DEFAULT_JUDGE_POLICY,
			requiredJudgeIds: ["never-registered"],
		};
		const { allowed, violations } = governanceGate([TRUSTED], policy);
		expect(allowed).toBe(false);
		expect(violations.some((v) => v.type === "missing_required_judge")).toBe(
			true,
		);
	});

	it("accumulates filter + validation violations", () => {
		const policy: JudgePolicy = {
			...DEFAULT_JUDGE_POLICY,
			prohibitedJudgeIds: ["gpt-4o"],
			minJudgeCount: 3,
		};
		const { violations } = governanceGate([TRUSTED, PROBATIONARY], policy);
		expect(violations.some((v) => v.type === "judge_prohibited")).toBe(true);
		expect(violations.some((v) => v.type === "below_min_count")).toBe(true);
	});

	it("does not include suspended judge violations as blocking", () => {
		// Suspended judge is filtered out (not a blocking violation) — run still allowed if others pass
		const { allowed } = governanceGate([TRUSTED, SUSPENDED]);
		expect(allowed).toBe(true);
	});
});
