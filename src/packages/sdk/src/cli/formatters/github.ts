/**
 * GitHub formatter for evalai check.
 * - stdout: minimal (verdict + score + link) + ::error annotations for failed cases
 * - Step summary: full Markdown written to GITHUB_STEP_SUMMARY (not stdout)
 */

import * as fs from 'fs';
import type { CheckReport, FailedCase } from './types';
import { truncateSnippet } from '../render/snippet';

const ANNOTATION_MAX = 10;

function escapeAnnotationMessage(s: string): string {
  return s.replace(/\r/g, '').replace(/\n/g, '%0A');
}

function formatAnnotation(fc: FailedCase): string {
  const id = fc.testCaseId ?? fc.name ?? 'unknown';
  const reason = fc.reason ?? fc.outputSnippet ?? fc.output ?? 'no output';
  const msg = escapeAnnotationMessage(`TestCase ${id} failed - ${truncateSnippet(reason, 100)}`);
  return `::error title=EvalAI regression::${msg}`;
}

export function appendStepSummary(report: CheckReport): void {
  const path = typeof process !== 'undefined' && process.env?.GITHUB_STEP_SUMMARY;
  if (!path) return;

  const lines: string[] = [];
  const passed = report.verdict === 'pass';

  lines.push('## EvalAI Gate');
  lines.push('');
  lines.push(passed ? '✅ **PASSED**' : `❌ **FAILED**: ${report.reasonMessage ?? report.reasonCode}`);
  lines.push('');
  const deltaStr =
    report.baselineScore != null && report.delta != null
      ? ` (baseline ${report.baselineScore}, ${report.delta >= 0 ? '+' : ''}${report.delta} pts)`
      : '';
  lines.push(`**Score:** ${report.score ?? 0}/100${deltaStr}`);
  lines.push('');

  const failedCases = report.failedCases ?? [];
  if (failedCases.length > 0) {
    lines.push(`### ${failedCases.length} failing case${failedCases.length === 1 ? '' : 's'}`);
    lines.push('');
    for (const fc of failedCases.slice(0, 10)) {
      const label = fc.name ?? fc.input ?? '(unnamed)';
      const exp = truncateSnippet(fc.expectedOutput ?? fc.expectedSnippet, 80);
      const out = truncateSnippet(fc.output ?? fc.outputSnippet, 80);
      const reason = out ? `got "${out}"` : 'no output';
      lines.push(`- **${truncateSnippet(label, 60)}** — expected: ${exp || '(any)'}, ${reason}`);
    }
    if (failedCases.length > 10) {
      lines.push(`- _+ ${failedCases.length - 10} more_`);
    }
    lines.push('');
  }

  if (report.dashboardUrl) {
    lines.push(`[View Dashboard](${report.dashboardUrl})`);
    lines.push('');
  }

  try {
    fs.appendFileSync(path, lines.join('\n'), 'utf8');
  } catch {
    // Non-fatal: step summary is best-effort
  }
}

export function formatGitHub(report: CheckReport): string {
  const stdoutLines: string[] = [];

  // Emit ::error annotations for failed cases (up to N)
  const failedCases = report.failedCases ?? [];
  const toAnnotate = failedCases.slice(0, ANNOTATION_MAX);
  for (const fc of toAnnotate) {
    stdoutLines.push(formatAnnotation(fc));
  }

  // Minimal summary: verdict + score + link
  const passed = report.verdict === 'pass';
  const failReason = report.reasonMessage ?? report.reasonCode;
  stdoutLines.push(
    passed ? '\n✓ EvalAI gate PASSED' : `\n✗ EvalAI gate FAILED: ${failReason}`
  );

  const deltaStr =
    report.baselineScore != null && report.delta != null
      ? ` (baseline ${report.baselineScore}, ${report.delta >= 0 ? '+' : ''}${report.delta} pts)`
      : '';
  stdoutLines.push(`Score: ${report.score ?? 0}/100${deltaStr}`);

  if (report.dashboardUrl) {
    stdoutLines.push(`Dashboard: ${report.dashboardUrl}`);
  }

  // Write full markdown to GITHUB_STEP_SUMMARY (not stdout)
  appendStepSummary(report);

  return stdoutLines.join('\n');
}
