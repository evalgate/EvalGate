/**
 * Quarantine → Promote lifecycle for generated test cases.
 *
 * Generated test cases start in quarantine and cannot gate merges until
 * a human promotes them. Promotion is audited (who/when/why).
 *
 * State machine:
 *   generated → quarantined → promoted  (gates merges)
 *                           → rejected  (permanent, never gates)
 *
 * Pure module — persistence is handled by callers.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type QuarantineStatus =
	| "generated" // just created by auto-generation, not yet reviewed
	| "quarantined" // reviewed but pending approval
	| "promoted" // human approved — gates merges
	| "rejected"; // permanently excluded

export interface QuarantineAuditEvent {
	action: "quarantined" | "promoted" | "rejected";
	actor: string;
	reason: string;
	timestamp: string;
}

export interface QuarantinedTestCase {
	id: string;
	/** Original generated test case payload (opaque — callers own the schema) */
	payload: Record<string, unknown>;
	/** Current lifecycle status */
	status: QuarantineStatus;
	/** Who or what generated this case */
	generatedBy: string;
	/** When it was generated */
	generatedAt: string;
	/** Audit trail of all lifecycle transitions */
	auditTrail: QuarantineAuditEvent[];
	/** Quality score from test-quality-evaluator (0–1) */
	qualityScore: number | null;
	/** Tags inherited from the source trace */
	tags: string[];
}

export interface PromoteOptions {
	actor: string;
	reason?: string;
	/** Minimum quality score required to promote (default: 0 = no minimum) */
	minQualityScore?: number;
}

export interface RejectOptions {
	actor: string;
	reason: string;
}

export interface QuarantineOptions {
	actor?: string;
	reason?: string;
}

// ── Transition results ────────────────────────────────────────────────────────

export type TransitionResult =
	| { success: true; testCase: QuarantinedTestCase }
	| { success: false; reason: string; testCase: QuarantinedTestCase };

// ── Lifecycle transitions ─────────────────────────────────────────────────────

/**
 * Move a generated test case into quarantine for review.
 * Idempotent if already quarantined.
 */
export function quarantineTestCase(
	tc: QuarantinedTestCase,
	opts: QuarantineOptions = {},
): TransitionResult {
	if (tc.status === "promoted" || tc.status === "rejected") {
		return {
			success: false,
			reason: `Cannot quarantine a test case with status "${tc.status}"`,
			testCase: tc,
		};
	}

	const updated: QuarantinedTestCase = {
		...tc,
		status: "quarantined",
		auditTrail: [
			...tc.auditTrail,
			{
				action: "quarantined",
				actor: opts.actor ?? "system",
				reason: opts.reason ?? "Moved to quarantine for human review",
				timestamp: new Date().toISOString(),
			},
		],
	};

	return { success: true, testCase: updated };
}

/**
 * Promote a quarantined test case so it can gate merges.
 * Fails if quality score is below the minimum threshold.
 */
export function promoteTestCase(
	tc: QuarantinedTestCase,
	opts: PromoteOptions,
): TransitionResult {
	if (tc.status === "promoted") {
		return { success: true, testCase: tc }; // idempotent
	}

	if (tc.status === "rejected") {
		return {
			success: false,
			reason: "Cannot promote a rejected test case",
			testCase: tc,
		};
	}

	if (tc.status === "generated") {
		return {
			success: false,
			reason: "Test case must be quarantined before it can be promoted",
			testCase: tc,
		};
	}

	const minScore = opts.minQualityScore ?? 0;
	if (tc.qualityScore !== null && tc.qualityScore < minScore) {
		return {
			success: false,
			reason: `Quality score ${tc.qualityScore.toFixed(2)} is below minimum ${minScore.toFixed(2)}`,
			testCase: tc,
		};
	}

	const updated: QuarantinedTestCase = {
		...tc,
		status: "promoted",
		auditTrail: [
			...tc.auditTrail,
			{
				action: "promoted",
				actor: opts.actor,
				reason: opts.reason ?? "Approved for merge gating",
				timestamp: new Date().toISOString(),
			},
		],
	};

	return { success: true, testCase: updated };
}

/**
 * Permanently reject a test case. Rejected cases never gate merges.
 */
export function rejectTestCase(
	tc: QuarantinedTestCase,
	opts: RejectOptions,
): TransitionResult {
	if (tc.status === "rejected") {
		return { success: true, testCase: tc }; // idempotent
	}

	if (tc.status === "promoted") {
		return {
			success: false,
			reason: "Cannot reject a promoted test case — demote first",
			testCase: tc,
		};
	}

	const updated: QuarantinedTestCase = {
		...tc,
		status: "rejected",
		auditTrail: [
			...tc.auditTrail,
			{
				action: "rejected",
				actor: opts.actor,
				reason: opts.reason,
				timestamp: new Date().toISOString(),
			},
		],
	};

	return { success: true, testCase: updated };
}

// ── Gating filter ─────────────────────────────────────────────────────────────

/**
 * Return only test cases that are eligible to gate merges.
 * Quarantined and generated cases are silently excluded.
 */
export function getGatingCases(
	cases: QuarantinedTestCase[],
): QuarantinedTestCase[] {
	return cases.filter((tc) => tc.status === "promoted");
}

/**
 * Return only cases pending human review.
 */
export function getPendingReviewCases(
	cases: QuarantinedTestCase[],
): QuarantinedTestCase[] {
	return cases.filter(
		(tc) => tc.status === "quarantined" || tc.status === "generated",
	);
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a new generated test case in initial "generated" state.
 */
export function createGeneratedTestCase(params: {
	id: string;
	payload: Record<string, unknown>;
	generatedBy: string;
	qualityScore?: number | null;
	tags?: string[];
}): QuarantinedTestCase {
	return {
		id: params.id,
		payload: params.payload,
		status: "generated",
		generatedBy: params.generatedBy,
		generatedAt: new Date().toISOString(),
		auditTrail: [],
		qualityScore: params.qualityScore ?? null,
		tags: params.tags ?? [],
	};
}

// ── Audit summary ─────────────────────────────────────────────────────────────

export interface QuarantineStats {
	total: number;
	byStatus: Record<QuarantineStatus, number>;
	promotedBy: Record<string, number>;
	rejectedBy: Record<string, number>;
}

/**
 * Summarise the quarantine status of a collection of test cases.
 */
export function summarizeQuarantineStatus(
	cases: QuarantinedTestCase[],
): QuarantineStats {
	const byStatus: Record<QuarantineStatus, number> = {
		generated: 0,
		quarantined: 0,
		promoted: 0,
		rejected: 0,
	};
	const promotedBy: Record<string, number> = {};
	const rejectedBy: Record<string, number> = {};

	for (const tc of cases) {
		byStatus[tc.status]++;

		for (const event of tc.auditTrail) {
			if (event.action === "promoted") {
				promotedBy[event.actor] = (promotedBy[event.actor] ?? 0) + 1;
			}
			if (event.action === "rejected") {
				rejectedBy[event.actor] = (rejectedBy[event.actor] ?? 0) + 1;
			}
		}
	}

	return { total: cases.length, byStatus, promotedBy, rejectedBy };
}
