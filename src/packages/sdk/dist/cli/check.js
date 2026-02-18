#!/usr/bin/env node
"use strict";
/**
 * evalai check — CI/CD evaluation gate
 *
 * Usage:
 *   evalai check --minScore 92 --evaluationId 42
 *   evalai check --minScore 90 --maxDrop 5 --evaluationId 42
 *   evalai check --policy HIPAA --evaluationId 42
 *   evalai check --baseline published --evaluationId 42
 *
 * Flags:
 *   --minScore <n>       Fail if quality score < n (0-100)
 *   --maxDrop <n>        Fail if score dropped > n points from baseline
 *   --minN <n>           Fail if total test cases < n (low sample size)
 *   --allowWeakEvidence  If false (default), fail when evidenceLevel is 'weak'
 *   --policy <name>      Enforce a compliance policy (e.g. HIPAA, SOC2, GDPR)
 *   --baseline <mode>    Baseline comparison mode: "published" (default), "previous", or "production"
 *   --evaluationId <id>  Required. The evaluation to gate on.
 *   --baseUrl <url>      API base URL (default: EVALAI_BASE_URL or http://localhost:3000)
 *   --apiKey <key>       API key (default: EVALAI_API_KEY env var)
 *
 * Exit codes:
 *   0  — Gate passed
 *   1  — Gate failed: score below threshold
 *   2  — Gate failed: regression exceeded maxDrop
 *   3  — Gate failed: policy violation
 *   4  — API error / network failure
 *   5  — Invalid arguments
 *   6  — Gate failed: total test cases < minN
 *   7  — Gate failed: weak evidence (evidenceLevel === 'weak')
 *
 * Environment:
 *   EVALAI_BASE_URL  — API base URL (default: http://localhost:3000)
 *   EVALAI_API_KEY   — API key for authentication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXIT = void 0;
exports.parseArgs = parseArgs;
exports.runCheck = runCheck;
// Standardized exit codes
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
function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith('--')) {
                args[key] = next;
                i++;
            }
            else {
                args[key] = 'true'; // bare flag
            }
        }
    }
    const baseUrl = args.baseUrl || process.env.EVALAI_BASE_URL || 'http://localhost:3000';
    const apiKey = args.apiKey || process.env.EVALAI_API_KEY || '';
    const minScore = parseInt(args.minScore || '0');
    const maxDrop = args.maxDrop ? parseInt(args.maxDrop) : undefined;
    const minN = args.minN ? parseInt(args.minN) : undefined;
    const allowWeakEvidence = args.allowWeakEvidence === 'true' || args.allowWeakEvidence === '1';
    const evaluationId = args.evaluationId || '';
    const policy = args.policy || undefined;
    const baseline = (args.baseline === 'previous'
        ? 'previous'
        : args.baseline === 'production'
            ? 'production'
            : 'published');
    if (!apiKey) {
        console.error('Error: --apiKey or EVALAI_API_KEY is required');
        process.exit(exports.EXIT.BAD_ARGS);
    }
    if (!evaluationId) {
        console.error('Error: --evaluationId is required');
        process.exit(exports.EXIT.BAD_ARGS);
    }
    if (isNaN(minScore) || minScore < 0 || minScore > 100) {
        console.error('Error: --minScore must be 0-100');
        process.exit(exports.EXIT.BAD_ARGS);
    }
    if (minN !== undefined && (isNaN(minN) || minN < 1)) {
        console.error('Error: --minN must be a positive number');
        process.exit(exports.EXIT.BAD_ARGS);
    }
    return { baseUrl, apiKey, minScore, maxDrop, minN, allowWeakEvidence, evaluationId, policy, baseline };
}
async function runCheck(args) {
    const headers = { Authorization: `Bearer ${args.apiKey}` };
    // ── 1. Fetch latest quality score ──
    const scoreUrl = `${args.baseUrl}/api/quality?evaluationId=${args.evaluationId}&action=latest&baseline=${args.baseline}`;
    let scoreRes;
    try {
        scoreRes = await fetch(scoreUrl, { headers });
    }
    catch (err) {
        console.error(`EvalAI gate ERROR: Network failure — ${err.message}`);
        return exports.EXIT.API_ERROR;
    }
    if (!scoreRes.ok) {
        const body = await scoreRes.text();
        console.error(`EvalAI gate ERROR: API returned ${scoreRes.status} — ${body}`);
        return exports.EXIT.API_ERROR;
    }
    const data = (await scoreRes.json());
    const score = data?.score ?? 0;
    const total = data?.total ?? null;
    const evidenceLevel = data?.evidenceLevel ?? null;
    const baselineScore = data?.baselineScore ?? null;
    const regressionDelta = data?.regressionDelta ?? null;
    const baselineMissing = data?.baselineMissing === true;
    const breakdown = data?.breakdown ?? {};
    // ── Gate: baseline missing (when baseline comparison requested) ──
    if (baselineMissing && (args.baseline !== 'published' || args.maxDrop !== undefined)) {
        console.error(`\n✗ FAILED: baseline (${args.baseline}) not found. ` +
            `Ensure a baseline run exists (e.g. published run, previous run, or prod-tagged run).`);
        return exports.EXIT.API_ERROR;
    }
    // ── Gate: minN (low sample size) ──
    if (args.minN !== undefined && total !== null && total < args.minN) {
        console.error(`\n✗ FAILED: total test cases (${total}) < minN (${args.minN})`);
        return exports.EXIT.LOW_N;
    }
    // ── Gate: allowWeakEvidence ──
    if (!args.allowWeakEvidence && evidenceLevel === 'weak') {
        console.error(`\n✗ FAILED: evidence level is 'weak' (use --allowWeakEvidence to permit)`);
        return exports.EXIT.WEAK_EVIDENCE;
    }
    // ── Print summary ──
    console.log('┌─────────────────────────────────────────┐');
    console.log(`│  EvalAI Quality Score: ${String(score).padStart(3)}/100            │`);
    console.log('├─────────────────────────────────────────┤');
    if (baselineScore !== null) {
        const delta = regressionDelta ?? 0;
        const arrow = delta >= 0 ? '▲' : '▼';
        console.log(`│  Baseline: ${baselineScore}  ${arrow} ${Math.abs(delta)} pts          │`);
    }
    if (breakdown) {
        const pct = (v) => `${Math.round((v ?? 0) * 100)}%`;
        console.log(`│  Pass: ${pct(breakdown.passRate)}  Safety: ${pct(breakdown.safety)}  Judge: ${pct(breakdown.judge)} │`);
    }
    if (data?.flags && data.flags.length > 0) {
        console.log(`│  Flags: ${data.flags.join(', ').padEnd(30)} │`);
    }
    console.log('└─────────────────────────────────────────┘');
    // ── 2. Gate: minimum score ──
    if (args.minScore > 0 && score < args.minScore) {
        console.error(`\n✗ FAILED: score=${score} < minScore=${args.minScore}`);
        return exports.EXIT.SCORE_BELOW;
    }
    // ── 3. Gate: maximum drop from baseline ──
    if (args.maxDrop !== undefined && regressionDelta !== null && regressionDelta < -(args.maxDrop)) {
        console.error(`\n✗ FAILED: score dropped ${Math.abs(regressionDelta)} pts from baseline ` +
            `(max allowed: ${args.maxDrop})`);
        return exports.EXIT.REGRESSION;
    }
    // ── 4. Gate: policy compliance ──
    if (args.policy) {
        const policyUrl = `${args.baseUrl}/api/quality?evaluationId=${args.evaluationId}&action=latest`;
        // Check policy-specific flags
        const policyFlags = (data?.flags ?? []);
        // Policy mapping: each policy has a set of required conditions
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
            console.error(`\n✗ Unknown policy: ${args.policy}. Available: ${Object.keys(policyChecks).join(', ')}`);
            return exports.EXIT.BAD_ARGS;
        }
        // Check safety rate
        const safetyRate = breakdown?.safety ?? 0;
        if (safetyRate < check.requiredSafetyRate) {
            console.error(`\n✗ POLICY VIOLATION (${policyName}): safety rate ${Math.round(safetyRate * 100)}% < ` +
                `required ${Math.round(check.requiredSafetyRate * 100)}%`);
            return exports.EXIT.POLICY_VIOLATION;
        }
        // Check for disqualifying flags
        const violations = policyFlags.filter(f => check.maxFlags.includes(f));
        if (violations.length > 0) {
            console.error(`\n✗ POLICY VIOLATION (${policyName}): ${violations.join(', ')}`);
            return exports.EXIT.POLICY_VIOLATION;
        }
        console.log(`\n✓ Policy ${policyName}: COMPLIANT`);
    }
    console.log('\n✓ EvalAI gate PASSED');
    return exports.EXIT.PASS;
}
// Main entry point
const isDirectRun = typeof require !== 'undefined' && require.main === module;
if (isDirectRun) {
    const args = parseArgs(process.argv.slice(2));
    runCheck(args).then((code) => {
        process.exit(code);
    }).catch((err) => {
        console.error(`EvalAI gate ERROR: ${err.message}`);
        process.exit(exports.EXIT.API_ERROR);
    });
}
