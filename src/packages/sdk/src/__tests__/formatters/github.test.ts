/**
 * GitHub formatter tests.
 * Assert ::error when fail; assert summary written to env var path when set.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { formatGitHub, appendStepSummary } from '../../cli/formatters/github';
import type { CheckReport } from '../../cli/formatters/types';

describe('formatGitHub', () => {
  it('emits ::error annotations when gate fails with failed cases', () => {
    const report: CheckReport = {
      evaluationId: 'eval-1',
      verdict: 'fail',
      reasonCode: 'LOW_SCORE',
      reasonMessage: 'Score below threshold',
      score: 60,
      failedCases: [
        { testCaseId: 1, name: 'tc1', reason: 'assertion failed' },
        { testCaseId: 2, name: 'tc2', output: 'wrong output' },
      ],
    };
    const out = formatGitHub(report);
    expect(out).toContain('::error title=EvalAI regression::');
    expect(out).toContain('TestCase 1 failed');
    expect(out).toContain('TestCase 2 failed');
    expect(out).toContain('✗ EvalAI gate FAILED');
    expect(out).toContain('Score: 60/100');
  });

  it('does not emit ::error when gate passes', () => {
    const report: CheckReport = {
      evaluationId: 'eval-1',
      verdict: 'pass',
      reasonCode: 'UNKNOWN',
      score: 95,
    };
    const out = formatGitHub(report);
    expect(out).not.toContain('::error');
    expect(out).toContain('✓ EvalAI gate PASSED');
  });

  it('emits minimal stdout (verdict + score + link)', () => {
    const report: CheckReport = {
      evaluationId: 'eval-1',
      verdict: 'pass',
      reasonCode: 'UNKNOWN',
      score: 90,
      dashboardUrl: 'https://example.com/dash',
    };
    const out = formatGitHub(report);
    expect(out).toContain('✓ EvalAI gate PASSED');
    expect(out).toContain('Score: 90/100');
    expect(out).toContain('Dashboard: https://example.com/dash');
  });
});

describe('appendStepSummary', () => {
  let summaryPath: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    summaryPath = '';
    originalEnv = process.env.GITHUB_STEP_SUMMARY;
    delete process.env.GITHUB_STEP_SUMMARY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) process.env.GITHUB_STEP_SUMMARY = originalEnv;
    else delete process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
      try {
        fs.unlinkSync(summaryPath);
      } catch {
        /* ignore */
      }
    }
  });

  it('writes summary to GITHUB_STEP_SUMMARY when set', () => {
    const tmpDir = process.env.TEMP || process.env.TMP || '/tmp';
    summaryPath = `${tmpDir}/evalai-step-summary-${Date.now()}.md`;
    process.env.GITHUB_STEP_SUMMARY = summaryPath;

    const report: CheckReport = {
      evaluationId: 'eval-1',
      verdict: 'fail',
      reasonCode: 'LOW_SCORE',
      reasonMessage: 'Score below threshold',
      score: 70,
      failedCases: [{ testCaseId: 1, name: 'tc1', reason: 'failed' }],
    };

    appendStepSummary(report);

    expect(fs.existsSync(summaryPath)).toBe(true);
    const content = fs.readFileSync(summaryPath, 'utf8');
    expect(content).toContain('## EvalAI Gate');
    expect(content).toContain('FAILED');
    expect(content).toContain('70/100');
    expect(content).toContain('tc1');
  });

  it('does nothing when GITHUB_STEP_SUMMARY is not set', () => {
    const report: CheckReport = {
      evaluationId: 'eval-1',
      verdict: 'pass',
      reasonCode: 'UNKNOWN',
      score: 100,
    };
    expect(() => appendStepSummary(report)).not.toThrow();
  });
});
