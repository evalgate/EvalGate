// Evaluation service for running tests and managing evaluation logic

import type { AssertionResult } from "../assertions";

export interface TestCaseInput {
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  context?: Record<string, any>;
}

export interface TestCaseResult {
  testCaseId: string;
  status: "passed" | "failed" | "skipped";
  actualOutput: any;
  assertions: AssertionResult[];
  durationMs: number;
  errorMessage?: string;
  traceId?: string;
}

export interface EvaluationRunResult {
  runId: string;
  status: "completed" | "failed";
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: TestCaseResult[];
  startTime: Date;
  endTime: Date;
}

export class EvaluationService {
  /**
   * Execute a single test case
   */
  async executeTestCase(
    testCase: {
      id: string;
      input: TestCaseInput;
      expectedOutput?: any;
    },
    modelFunction: (input: TestCaseInput) => Promise<any>,
    assertions: ((output: any) => AssertionResult)[],
  ): Promise<TestCaseResult> {
    const startTime = Date.now();

    try {
      // Execute the model function
      const actualOutput = await modelFunction(testCase.input);

      // Run all assertions
      const assertionResults = assertions.map((assertion) => {
        try {
          return assertion(actualOutput);
        } catch (error) {
          return {
            name: "assertion_error",
            passed: false,
            expected: null,
            actual: actualOutput,
            message: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });

      const durationMs = Date.now() - startTime;
      const allPassed = assertionResults.every((result) => result.passed);

      return {
        testCaseId: testCase.id,
        status: allPassed ? "passed" : "failed",
        actualOutput,
        assertions: assertionResults,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return {
        testCaseId: testCase.id,
        status: "failed",
        actualOutput: null,
        assertions: [],
        durationMs,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Execute an entire evaluation run
   */
  async executeEvaluationRun(
    evaluationId: string,
    testCases: Array<{
      id: string;
      input: TestCaseInput;
      expectedOutput?: any;
    }>,
    modelFunction: (input: TestCaseInput) => Promise<any>,
    assertionFactory: (testCase: any) => ((output: any) => AssertionResult)[],
  ): Promise<EvaluationRunResult> {
    const startTime = new Date();
    const results: TestCaseResult[] = [];

    // Execute test cases sequentially (could be parallelized)
    for (const testCase of testCases) {
      const assertions = assertionFactory(testCase);
      const result = await this.executeTestCase(testCase, modelFunction, assertions);
      results.push(result);
    }

    const endTime = new Date();
    const passedTests = results.filter((r) => r.status === "passed").length;
    const failedTests = results.filter((r) => r.status === "failed").length;

    return {
      runId: evaluationId,
      status: failedTests === 0 ? "completed" : "failed",
      totalTests: testCases.length,
      passedTests,
      failedTests,
      results,
      startTime,
      endTime,
    };
  }

  /**
   * Calculate metrics from evaluation results
   */
  calculateMetrics(results: TestCaseResult[]): Record<string, any> {
    const totalTests = results.length;
    const passedTests = results.filter((r) => r.status === "passed").length;
    const failedTests = results.filter((r) => r.status === "failed").length;

    const avgDuration = results.reduce((sum, r) => sum + r.durationMs, 0) / totalTests;

    const assertionStats = results.flatMap((r) => r.assertions);
    const totalAssertions = assertionStats.length;
    const passedAssertions = assertionStats.filter((a) => a.passed).length;

    return {
      accuracy: totalTests > 0 ? passedTests / totalTests : 0,
      passRate: totalTests > 0 ? passedTests / totalTests : 0,
      failRate: totalTests > 0 ? failedTests / totalTests : 0,
      avgLatencyMs: avgDuration,
      totalTests,
      passedTests,
      failedTests,
      assertionPassRate: totalAssertions > 0 ? passedAssertions / totalAssertions : 0,
    };
  }
}

export const evaluationService = new EvaluationService();
