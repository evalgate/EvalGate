#!/usr/bin/env node

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

// Standardized exit codes
export const EXIT = {
  PASS: 0,
  SCORE_BELOW: 1,
  REGRESSION: 2,
  POLICY_VIOLATION: 3,
  API_ERROR: 4,
  BAD_ARGS: 5,
  LOW_N: 6,
  WEAK_EVIDENCE: 7,
} as const;

import { loadConfig, mergeConfigWithArgs } from './config';

export interface CheckArgs {
  baseUrl: string;
  apiKey: string;
  minScore: number;
  maxDrop?: number;
  minN?: number;
  allowWeakEvidence: boolean;
  evaluationId: string;
  policy?: string;
  baseline: 'published' | 'previous' | 'production';
}

export function parseArgs(argv: string[]): CheckArgs {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = 'true'; // bare flag
      }
    }
  }

  let baseUrl = args.baseUrl || process.env.EVALAI_BASE_URL || 'http://localhost:3000';
  const apiKey = args.apiKey || process.env.EVALAI_API_KEY || '';
  let minScore = parseInt(args.minScore || '0');
  const maxDrop = args.maxDrop ? parseInt(args.maxDrop) : undefined;
  let minN = args.minN ? parseInt(args.minN) : undefined;
  let allowWeakEvidence = args.allowWeakEvidence === 'true' || args.allowWeakEvidence === '1';
  let evaluationId = args.evaluationId || '';
  const policy = args.policy || undefined;
  let baseline = (
    args.baseline === 'previous'
      ? 'previous'
      : args.baseline === 'production'
        ? 'production'
        : 'published'
  ) as CheckArgs['baseline'];

  // Load config when evaluationId not provided. Priority: CLI flags > config > defaults
  if (!evaluationId) {
    const config = loadConfig(process.cwd());
    const merged = mergeConfigWithArgs(config, {
      evaluationId: args.evaluationId,
      baseUrl: args.baseUrl || process.env.EVALAI_BASE_URL,
      minScore: args.minScore,
      minN: args.minN,
      allowWeakEvidence: args.allowWeakEvidence,
      baseline: args.baseline,
    });
    if (merged.evaluationId) evaluationId = merged.evaluationId;
    if (merged.baseUrl) baseUrl = merged.baseUrl;
    if (merged.minScore != null && !args.minScore) minScore = merged.minScore;
    if (merged.minN != null && !args.minN) minN = merged.minN;
    if (merged.allowWeakEvidence != null && !args.allowWeakEvidence) allowWeakEvidence = merged.allowWeakEvidence;
    if (merged.baseline && !args.baseline) baseline = merged.baseline;
  }

  if (!apiKey) {
    console.error('Error: --apiKey or EVALAI_API_KEY is required');
    process.exit(EXIT.BAD_ARGS);
  }

  if (!evaluationId) {
    console.error('Run npx evalai init and paste your evaluationId, or pass --evaluationId.');
    process.exit(EXIT.BAD_ARGS);
  }

  if (isNaN(minScore) || minScore < 0 || minScore > 100) {
    console.error('Error: --minScore must be 0-100');
    process.exit(EXIT.BAD_ARGS);
  }

  if (minN !== undefined && (isNaN(minN) || minN < 1)) {
    console.error('Error: --minN must be a positive number');
    process.exit(EXIT.BAD_ARGS);
  }

  return { baseUrl, apiKey, minScore, maxDrop, minN, allowWeakEvidence, evaluationId, policy, baseline };
}

export async function runCheck(args: CheckArgs): Promise<number> {
  const headers = { Authorization: `Bearer ${args.apiKey}` };

  // ── 1. Fetch latest quality score ──
  const scoreUrl = `${args.baseUrl}/api/quality?evaluationId=${args.evaluationId}&action=latest&baseline=${args.baseline}`;
  let scoreRes: Response;
  try {
    scoreRes = await fetch(scoreUrl, { headers });
  } catch (err: any) {
    console.error(`EvalAI gate ERROR: Network failure — ${err.message}`);
    return EXIT.API_ERROR;
  }

  if (!scoreRes.ok) {
    const body = await scoreRes.text();
    console.error(`EvalAI gate ERROR: API returned ${scoreRes.status} — ${body}`);
    return EXIT.API_ERROR;
  }

  const data = (await scoreRes.json()) as {
    score?: number;
    total?: number | null;
    evidenceLevel?: string | null;
    baselineScore?: number | null;
    regressionDelta?: number | null;
    baselineMissing?: boolean | null;
    breakdown?: { passRate?: number; safety?: number; judge?: number };
    flags?: string[];
    evaluationRunId?: number;
    evaluationId?: number;
  };
  const score: number = data?.score ?? 0;
  const total: number | null = data?.total ?? null;
  const evidenceLevel: string | null = data?.evidenceLevel ?? null;
  const baselineScore: number | null = data?.baselineScore ?? null;
  const regressionDelta: number | null = data?.regressionDelta ?? null;
  const baselineMissing: boolean = data?.baselineMissing === true;
  const breakdown = data?.breakdown ?? {};
  const evaluationRunId = data?.evaluationRunId;
  const evalId = args.evaluationId;

  // ── 2. Fetch run details for failed cases + dashboard link (when evaluationRunId present) ──
  type FailedCase = { name?: string; input?: string; expectedOutput?: string; output?: string };
  let failedCases: FailedCase[] = [];
  let dashboardUrl: string | null = null;

  if (evaluationRunId != null) {
    dashboardUrl = `${args.baseUrl.replace(/\/$/, '')}/evaluations/${evalId}/runs/${evaluationRunId}`;
    try {
      const runUrl = `${args.baseUrl}/api/evaluations/${evalId}/runs/${evaluationRunId}`;
      const runRes = await fetch(runUrl, { headers });
      if (runRes.ok) {
        const runData = (await runRes.json()) as {
          results?: Array<{
            status?: string;
            output?: string;
            test_cases?: { name?: string; input?: string; expectedOutput?: string };
          }>;
        };
        const results = runData?.results ?? [];
        failedCases = results
          .filter((r) => r.status === 'failed')
          .map((r) => ({
            name: r.test_cases?.name,
            input: r.test_cases?.input,
            expectedOutput: r.test_cases?.expectedOutput,
            output: r.output,
          }));
      }
    } catch {
      // Non-fatal: we still have score and dashboard URL
    }
  }

  // ── Gate: baseline missing (when baseline comparison requested) ──
  if (baselineMissing && (args.baseline !== 'published' || args.maxDrop !== undefined)) {
    const msg =
      args.baseline === 'production'
        ? `\n✗ FAILED: No prod runs exist for this evaluation. Tag runs with environment=prod before using --baseline production.`
        : `\n✗ FAILED: baseline (${args.baseline}) not found. Ensure a baseline run exists (e.g. published run, previous run, or prod-tagged run).`;
    console.error(msg);
    return EXIT.API_ERROR;
  }

  // ── Gate: minN (low sample size) ──
  if (args.minN !== undefined && total !== null && total < args.minN) {
    console.error(`\n✗ FAILED: total test cases (${total}) < minN (${args.minN})`);
    return EXIT.LOW_N;
  }

  // ── Gate: allowWeakEvidence ──
  if (!args.allowWeakEvidence && evidenceLevel === 'weak') {
    console.error(`\n✗ FAILED: evidence level is 'weak' (use --allowWeakEvidence to permit)`);
    return EXIT.WEAK_EVIDENCE;
  }

  // ── Compute gate result (before printing, for deterministic output order) ──
  let exitCode = EXIT.PASS;
  let failReason: string | null = null;

  if (args.minScore > 0 && score < args.minScore) {
    exitCode = EXIT.SCORE_BELOW;
    failReason = `score ${score} < minScore ${args.minScore}`;
  } else if (args.maxDrop !== undefined && regressionDelta !== null && regressionDelta < -(args.maxDrop)) {
    exitCode = EXIT.REGRESSION;
    failReason = `score dropped ${Math.abs(regressionDelta)} pts from baseline (max allowed: ${args.maxDrop})`;
  } else if (args.policy) {
    const policyFlags = (data?.flags ?? []) as string[];
    const policyChecks: Record<string, { requiredSafetyRate: number; maxFlags: string[] }> = {
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
      return EXIT.BAD_ARGS;
    }
    const safetyRate = breakdown?.safety ?? 0;
    if (safetyRate < check.requiredSafetyRate) {
      exitCode = EXIT.POLICY_VIOLATION;
      failReason = `policy ${policyName}: safety ${Math.round(safetyRate * 100)}% < required ${Math.round(check.requiredSafetyRate * 100)}%`;
    } else {
      const violations = policyFlags.filter((f) => check.maxFlags.includes(f));
      if (violations.length > 0) {
        exitCode = EXIT.POLICY_VIOLATION;
        failReason = `policy ${policyName}: ${violations.join(', ')}`;
      }
    }
  }

  // ── Print deterministic, copy-pastable output (verdict → score → failures → link → hint) ──
  const passed = exitCode === EXIT.PASS;
  console.log(passed ? '\n✓ EvalAI gate PASSED' : `\n✗ EvalAI gate FAILED: ${failReason}`);
  const deltaStr =
    baselineScore !== null && regressionDelta !== null
      ? ` (baseline ${baselineScore}, ${regressionDelta >= 0 ? '+' : ''}${regressionDelta} pts)`
      : '';
  console.log(`Score: ${score}/100${deltaStr}`);
  if (failedCases.length > 0) {
    const toShow = failedCases.slice(0, 3);
    console.log(`${failedCases.length} failing case${failedCases.length === 1 ? '' : 's'}:`);
    const trunc = (s: string | undefined, max = 50) =>
      s == null ? '' : s.length <= max ? s : s.slice(0, max) + '…';
    for (const fc of toShow) {
      const label = fc.name || fc.input || '(unnamed)';
      const exp = trunc(fc.expectedOutput);
      const out = trunc(fc.output);
      const reason = out ? `got "${out}"` : 'no output';
      console.log(`  - "${trunc(label)}" → expected: ${exp || '(any)'}, ${reason}`);
    }
    if (failedCases.length > toShow.length) {
      console.log(`  + ${failedCases.length - toShow.length} more`);
    }
  }
  if (dashboardUrl) {
    console.log(`Dashboard: ${dashboardUrl}`);
  }
  if (!passed) {
    console.log('Next: View full report above, fix failing cases, or adjust gate with --minScore / --maxDrop');
  }

  return exitCode;
}

// Main entry point
const isDirectRun = typeof require !== 'undefined' && require.main === module;
if (isDirectRun) {
  const args = parseArgs(process.argv.slice(2));
  runCheck(args).then((code) => {
    process.exit(code);
  }).catch((err) => {
    console.error(`EvalAI gate ERROR: ${err.message}`);
    process.exit(EXIT.API_ERROR);
  });
}
