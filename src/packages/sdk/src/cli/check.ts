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
 *   --baseline <mode>   Baseline comparison mode: "published" (default), "previous", or "production"
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

import { loadConfig, mergeConfigWithArgs } from './config';
import { fetchQualityLatest, fetchRunDetails, importRunOnFail, type ImportResult } from './api';
import { captureCiContext, computeIdempotencyKey } from './ci-context';
import { evaluateGate } from './gate';
import { buildCheckReport } from './report/build-check-report';
import { formatHuman } from './formatters/human';
import { formatJson } from './formatters/json';
import { formatGitHub } from './formatters/github';
import { EXIT } from './constants';

export { EXIT } from './constants';

export type FormatType = 'human' | 'json' | 'github';

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
  format: FormatType;
  explain: boolean;
  onFail?: 'import';
}

export type ParseArgsResult =
  | { ok: true; args: CheckArgs }
  | { ok: false; exitCode: number; message: string };

export function parseArgs(argv: string[]): ParseArgsResult {
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
        args[key] = 'true';
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
  const formatRaw = args.format || 'human';
  const format: CheckArgs['format'] =
    formatRaw === 'json' ? 'json' : formatRaw === 'github' ? 'github' : 'human';
  const explain = args.explain === 'true' || args.explain === '1';
  const onFail = args.onFail === 'import' ? 'import' as const : undefined;
  let baseline = (
    args.baseline === 'previous'
      ? 'previous'
      : args.baseline === 'production'
        ? 'production'
        : 'published'
  ) as CheckArgs['baseline'];

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
    if (merged.minScore != null && !args.minScore) minScore = merged.minScore ?? 0;
    if (merged.minN != null && !args.minN) minN = merged.minN;
    if (merged.allowWeakEvidence != null && !args.allowWeakEvidence) allowWeakEvidence = merged.allowWeakEvidence ?? false;
    if (merged.baseline && !args.baseline) baseline = merged.baseline;
  }

  if (!apiKey) {
    return { ok: false, exitCode: EXIT.BAD_ARGS, message: 'Error: --apiKey or EVALAI_API_KEY is required' };
  }

  if (!evaluationId) {
    return { ok: false, exitCode: EXIT.BAD_ARGS, message: 'Run npx evalai init and paste your evaluationId, or pass --evaluationId.' };
  }

  if (isNaN(minScore) || minScore < 0 || minScore > 100) {
    return { ok: false, exitCode: EXIT.BAD_ARGS, message: 'Error: --minScore must be 0-100' };
  }

  if (minN !== undefined && (isNaN(minN) || minN < 1)) {
    return { ok: false, exitCode: EXIT.BAD_ARGS, message: 'Error: --minN must be a positive number' };
  }

  return {
    ok: true,
    args: { baseUrl, apiKey, minScore, maxDrop, minN, allowWeakEvidence, evaluationId, policy, baseline, format, explain, onFail },
  };
}

export async function runCheck(args: CheckArgs): Promise<number> {
  const qualityResult = await fetchQualityLatest(
    args.baseUrl,
    args.apiKey,
    args.evaluationId,
    args.baseline
  );

  if (!qualityResult.ok) {
    if (qualityResult.status === 0) {
      console.error(`EvalAI gate ERROR: Network failure — ${qualityResult.body}`);
    } else {
      console.error(`EvalAI gate ERROR: API returned ${qualityResult.status} — ${qualityResult.body}`);
    }
    return EXIT.API_ERROR;
  }

  const { data: quality, requestId } = qualityResult;
  const evaluationRunId = quality?.evaluationRunId;

  let runDetails: import('./api').RunDetailsData | null = null;
  if (evaluationRunId != null) {
    const runRes = await fetchRunDetails(
      args.baseUrl,
      args.apiKey,
      args.evaluationId,
      evaluationRunId
    );
    if (runRes.ok) runDetails = runRes.data;
  }

  const gateResult = evaluateGate(args, quality);

  const report = buildCheckReport({
    args,
    quality,
    runDetails,
    gateResult,
    requestId,
  });

  const formatted =
    args.format === 'json'
      ? formatJson(report)
      : args.format === 'github'
        ? formatGitHub(report)
        : formatHuman(report);
  console.log(formatted);

  // --onFail import: when gate fails, import run with CI context
  if (!gateResult.passed && args.onFail === 'import' && runDetails?.results && quality?.evaluationRunId) {
    const importResults: ImportResult[] = runDetails.results
      .filter((r) => r.testCaseId != null && (r.status === 'passed' || r.status === 'failed'))
      .map((r) => ({
        testCaseId: r.testCaseId!,
        status: r.status as 'passed' | 'failed',
        output: r.output ?? '',
        latencyMs: r.durationMs,
        assertionsJson: r.assertionsJson,
      }));
    if (importResults.length > 0) {
      const ci = captureCiContext();
      const idempotencyKey = ci ? computeIdempotencyKey(args.evaluationId, ci) : undefined;
      const importRes = await importRunOnFail(
        args.baseUrl,
        args.apiKey,
        args.evaluationId,
        importResults,
        { idempotencyKey, ci, importClientVersion: 'evalai-cli' }
      );
      if (!importRes.ok) {
        console.error(`EvalAI import (onFail): ${importRes.status} — ${importRes.body}`);
      }
    }
  }

  return gateResult.exitCode;
}

// Main entry point
const isDirectRun = typeof require !== 'undefined' && require.main === module;
if (isDirectRun) {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.message);
    process.exit(parsed.exitCode);
  }
  runCheck(parsed.args)
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`EvalAI gate ERROR: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(EXIT.API_ERROR);
    });
}
