"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXIT = void 0;
/**
 * Standardized exit codes for evalai check.
 */
exports.EXIT = {
    PASS: 0,
    SCORE_BELOW: 1,
    REGRESSION: 2,
    POLICY_VIOLATION: 3,
    API_ERROR: 4,
    BAD_ARGS: 5,
    LOW_N: 6,
    WEAK_EVIDENCE: 7,
};
