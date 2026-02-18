"use strict";
/**
 * Pure gate evaluation. No console output.
 * Baseline missing → configuration failure (BAD_ARGS), not API_ERROR.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateGate = evaluateGate;
const constants_1 = require("./constants");
function evaluateGate(args, quality) {
    const score = quality?.score ?? 0;
    const total = quality?.total ?? null;
    const evidenceLevel = quality?.evidenceLevel ?? null;
    const baselineScore = quality?.baselineScore ?? null;
    const regressionDelta = quality?.regressionDelta ?? null;
    const baselineMissing = quality?.baselineMissing === true;
    const breakdown = quality?.breakdown ?? {};
    const policyFlags = (quality?.flags ?? []);
    // Baseline missing → configuration failure (not API error)
    if (baselineMissing && (args.baseline !== 'published' || args.maxDrop !== undefined)) {
        const msg = args.baseline === 'production'
            ? 'No prod runs exist for this evaluation. Tag runs with environment=prod before using --baseline production.'
            : `Baseline (${args.baseline}) not found. Ensure a baseline run exists (e.g. published run, previous run, or prod-tagged run).`;
        return {
            exitCode: constants_1.EXIT.BAD_ARGS,
            passed: false,
            reasonCode: 'BASELINE_MISSING',
            reasonMessage: msg,
        };
    }
    // minN gate
    if (args.minN !== undefined && total !== null && total < args.minN) {
        return {
            exitCode: constants_1.EXIT.LOW_N,
            passed: false,
            reasonCode: 'INSUFFICIENT_EVIDENCE',
            reasonMessage: `total test cases (${total}) < minN (${args.minN})`,
        };
    }
    // allowWeakEvidence gate
    if (!args.allowWeakEvidence && evidenceLevel === 'weak') {
        return {
            exitCode: constants_1.EXIT.WEAK_EVIDENCE,
            passed: false,
            reasonCode: 'INSUFFICIENT_EVIDENCE',
            reasonMessage: "evidence level is 'weak' (use --allowWeakEvidence to permit)",
        };
    }
    // Compute gate result
    if (args.minScore > 0 && score < args.minScore) {
        return {
            exitCode: constants_1.EXIT.SCORE_BELOW,
            passed: false,
            reasonCode: 'LOW_SCORE',
            reasonMessage: `score ${score} < minScore ${args.minScore}`,
        };
    }
    if (args.maxDrop !== undefined && regressionDelta !== null && regressionDelta < -(args.maxDrop)) {
        return {
            exitCode: constants_1.EXIT.REGRESSION,
            passed: false,
            reasonCode: 'MAX_DROP_EXCEEDED',
            reasonMessage: `score dropped ${Math.abs(regressionDelta)} pts from baseline (max allowed: ${args.maxDrop})`,
        };
    }
    if (args.policy) {
        const policyChecks = {
            HIPAA: { requiredSafetyRate: 0.99, maxFlags: ['SAFETY_RISK'] },
            SOC2: { requiredSafetyRate: 0.95, maxFlags: ['SAFETY_RISK', 'LOW_PASS_RATE'] },
            GDPR: { requiredSafetyRate: 0.95, maxFlags: ['SAFETY_RISK'] },
            PCI_DSS: { requiredSafetyRate: 0.99, maxFlags: ['SAFETY_RISK', 'LOW_PASS_RATE'] },
            FINRA_4511: { requiredSafetyRate: 0.95, maxFlags: ['SAFETY_RISK'] },
        };
        const policyName = args.policy.toUpperCase();
        const check = policyChecks[policyName];
        if (!check) {
            return {
                exitCode: constants_1.EXIT.BAD_ARGS,
                passed: false,
                reasonCode: 'UNKNOWN',
                reasonMessage: `Unknown policy: ${args.policy}. Available: ${Object.keys(policyChecks).join(', ')}`,
            };
        }
        const safetyRate = breakdown?.safety ?? 0;
        if (safetyRate < check.requiredSafetyRate) {
            return {
                exitCode: constants_1.EXIT.POLICY_VIOLATION,
                passed: false,
                reasonCode: 'POLICY_VIOLATION',
                reasonMessage: `policy ${policyName}: safety ${Math.round(safetyRate * 100)}% < required ${Math.round(check.requiredSafetyRate * 100)}%`,
            };
        }
        const violations = policyFlags.filter((f) => check.maxFlags.includes(f));
        if (violations.length > 0) {
            return {
                exitCode: constants_1.EXIT.POLICY_VIOLATION,
                passed: false,
                reasonCode: 'POLICY_VIOLATION',
                reasonMessage: `policy ${policyName}: ${violations.join(', ')}`,
            };
        }
    }
    return {
        exitCode: constants_1.EXIT.PASS,
        passed: true,
        reasonCode: 'PASS',
        reasonMessage: null,
    };
}
