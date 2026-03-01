/**
 * Standardized exit codes for evalgate check.
 */
export declare const EXIT: {
    readonly PASS: 0;
    readonly SCORE_BELOW: 1;
    readonly REGRESSION: 2;
    readonly POLICY_VIOLATION: 3;
    readonly API_ERROR: 4;
    readonly BAD_ARGS: 5;
    readonly LOW_N: 6;
    readonly WEAK_EVIDENCE: 7;
    /** Near-regression: score dropped within warn band (warnDrop ≤ drop < maxDrop) */
    readonly WARN_REGRESSION: 8;
};
