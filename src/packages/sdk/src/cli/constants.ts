/**
 * Standardized exit codes for evalgate check.
 */
export const EXIT = {
	PASS: 0,
	SCORE_BELOW: 1,
	REGRESSION: 2,
	POLICY_VIOLATION: 3,
	API_ERROR: 4,
	BAD_ARGS: 5,
	LOW_N: 6,
	WEAK_EVIDENCE: 7,
	/** Near-regression: score dropped within warn band (warnDrop ≤ drop < maxDrop) */
	WARN_REGRESSION: 8,
} as const;
