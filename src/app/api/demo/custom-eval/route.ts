/**
 * Custom Eval API Route
 * Runs SDK assertions against user-provided AI input/output
 * Public endpoint (no auth required) with anonymous rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api-rate-limit';
import { calculateQualityScore } from '@/lib/ai-quality-score';
import { expect as evalExpect } from '@/packages/sdk/src/assertions';

interface CustomEvalRequest {
  input: string;
  output: string;
  expectedOutput?: string;
  assertions: string[];
  keywords?: string[];
  lengthMin?: number;
  lengthMax?: number;
}

interface AssertionResultItem {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  message?: string;
}

// Map assertion IDs to their execution logic
function runAssertion(
  id: string,
  output: string,
  opts: { expectedOutput?: string; keywords?: string[]; lengthMin?: number; lengthMax?: number }
): AssertionResultItem {
  try {
    switch (id) {
      case 'no-pii': {
        const r = evalExpect(output).toNotContainPII();
        return { name: 'No PII Detected', passed: r.passed, expected: r.expected, actual: r.actual, message: r.message };
      }
      case 'professional': {
        const r = evalExpect(output).toBeProfessional();
        return { name: 'Professional Tone', passed: r.passed, expected: r.expected, actual: r.actual, message: r.message };
      }
      case 'proper-grammar': {
        const r = evalExpect(output).toHaveProperGrammar();
        return { name: 'Proper Grammar', passed: r.passed, expected: r.expected, actual: r.actual, message: r.message };
      }
      case 'valid-json': {
        const r = evalExpect(output).toBeValidJSON();
        return { name: 'Valid JSON', passed: r.passed, expected: r.expected, actual: r.actual, message: r.message };
      }
      case 'contains-code': {
        const r = evalExpect(output).toContainCode();
        return { name: 'Contains Code', passed: r.passed, expected: r.expected, actual: r.actual, message: r.message };
      }
      case 'positive-sentiment': {
        const r = evalExpect(output).toHaveSentiment('positive');
        return { name: 'Positive Sentiment', passed: r.passed, expected: r.expected, actual: r.actual, message: r.message };
      }
      case 'negative-sentiment': {
        const r = evalExpect(output).toHaveSentiment('negative');
        return { name: 'Negative Sentiment', passed: r.passed, expected: r.expected, actual: r.actual, message: r.message };
      }
      case 'neutral-sentiment': {
        const r = evalExpect(output).toHaveSentiment('neutral');
        return { name: 'Neutral Sentiment', passed: r.passed, expected: r.expected, actual: r.actual, message: r.message };
      }
      case 'not-hallucinated': {
        if (!opts.expectedOutput) {
          return { name: 'No Hallucination', passed: false, expected: 'Ground truth provided', actual: 'No expected output', message: 'Expected output is required for hallucination check' };
        }
        const facts = opts.expectedOutput.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
        const r = evalExpect(output).toNotHallucinate(facts);
        return { name: 'No Hallucination', passed: r.passed, expected: r.expected, actual: r.actual, message: r.message };
      }
      case 'length-check': {
        const range: { min?: number; max?: number } = {};
        if (opts.lengthMin !== undefined) range.min = opts.lengthMin;
        if (opts.lengthMax !== undefined) range.max = opts.lengthMax;
        const r = evalExpect(output).toHaveLength(range);
        return { name: 'Length Check', passed: r.passed, expected: r.expected, actual: r.actual, message: r.message };
      }
      case 'contains-keywords': {
        if (!opts.keywords || opts.keywords.length === 0) {
          return { name: 'Contains Keywords', passed: false, expected: 'Keywords provided', actual: 'No keywords', message: 'Keywords are required for this assertion' };
        }
        const r = evalExpect(output).toContainKeywords(opts.keywords);
        return { name: 'Contains Keywords', passed: r.passed, expected: r.expected, actual: r.actual, message: r.message };
      }
      case 'matches-expected': {
        if (!opts.expectedOutput) {
          return { name: 'Matches Expected', passed: false, expected: 'Expected output provided', actual: 'No expected output', message: 'Expected output is required for exact match' };
        }
        const r = evalExpect(output).toEqual(opts.expectedOutput);
        return { name: 'Matches Expected', passed: r.passed, expected: r.expected, actual: r.actual, message: r.message };
      }
      default:
        return { name: id, passed: false, expected: 'Valid assertion', actual: `Unknown assertion: ${id}`, message: `Unknown assertion ID: ${id}` };
    }
  } catch (error) {
    return {
      name: id,
      passed: false,
      expected: 'No error',
      actual: error instanceof Error ? error.message : 'Unknown error',
      message: `Assertion threw an error: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const body: CustomEvalRequest = await request.json();
      const { input, output, expectedOutput, assertions, keywords, lengthMin, lengthMax } = body;

      if (!output || typeof output !== 'string') {
        return NextResponse.json(
          { error: 'output is required and must be a string', code: 'MISSING_OUTPUT' },
          { status: 400 }
        );
      }

      if (!assertions || !Array.isArray(assertions) || assertions.length === 0) {
        return NextResponse.json(
          { error: 'assertions must be a non-empty array of assertion IDs', code: 'MISSING_ASSERTIONS' },
          { status: 400 }
        );
      }

      const startTime = Date.now();

      // Run all selected assertions
      const results: AssertionResultItem[] = assertions.map((id) =>
        runAssertion(id, output, { expectedOutput, keywords, lengthMin, lengthMax })
      );

      const durationMs = Date.now() - startTime;
      const passedCount = results.filter((r) => r.passed).length;
      const failedCount = results.length - passedCount;

      // Build quality score using the platform's standard calculation
      const qualityScore = calculateQualityScore({
        totalEvaluations: results.length,
        passedEvaluations: passedCount,
        failedEvaluations: failedCount,
        averageLatency: durationMs,
        averageCost: 0,
        averageScore: results.length > 0 ? (passedCount / results.length) * 100 : 0,
        consistencyScore: 85,
      });

      // Return in the exact shape the playground expects
      return NextResponse.json({
        name: 'Custom Evaluation',
        results: {
          totalTests: results.length,
          passed: passedCount,
          failed: failedCount,
          tests: results.map((r, i) => ({
            id: i + 1,
            input: input || 'N/A',
            expected: r.expected || 'Pass',
            actual: r.actual || output.slice(0, 200),
            status: r.passed ? 'passed' : 'failed',
            score: r.passed ? 100 : 0,
            notes: r.message || (r.passed ? `${r.name} passed` : `${r.name} failed`),
          })),
        },
        qualityScore,
      });
    } catch (error) {
      console.error('Custom eval error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { customTier: 'anonymous' });
}
