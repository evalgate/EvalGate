import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { evaluationRuns, evaluations, testCases, testResults } from "@/db/schema";
import { notFound } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { SCOPES } from "@/lib/auth/scopes";

export const GET = secureRoute(
  async (req: NextRequest, ctx: AuthContext, params) => {
    const evaluationId = parseInt(params.id, 10);
    const runId = parseInt(params.runId, 10);
    const compareRunIdParam = req.nextUrl.searchParams.get("compareRunId");
    const compareRunId = compareRunIdParam ? parseInt(compareRunIdParam, 10) : null;

    // Verify the evaluation exists and belongs to this org
    const evalData = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.id, evaluationId))
      .limit(1);

    if (evalData.length === 0 || evalData[0].organizationId !== ctx.organizationId) {
      return notFound("Evaluation not found");
    }

    // Fetch run
    const runData = await db
      .select()
      .from(evaluationRuns)
      .where(eq(evaluationRuns.id, runId))
      .limit(1);

    if (runData.length === 0) {
      return notFound("Run not found");
    }

    // Fetch test results for this run with test case details
    const results = await db
      .select({
        result: testResults,
        testCase: {
          name: testCases.name,
          input: testCases.input,
          expectedOutput: testCases.expectedOutput,
        },
      })
      .from(testResults)
      .leftJoin(testCases, eq(testResults.testCaseId, testCases.id))
      .where(eq(testResults.evaluationRunId, runId))
      .orderBy(asc(testResults.createdAt));

    const formattedResults = results.map((r) => ({
      ...r.result,
      test_cases: r.testCase,
    }));

    let baselineResults: typeof formattedResults | undefined;
    if (
      compareRunId != null &&
      !Number.isNaN(compareRunId) &&
      compareRunId !== runId &&
      compareRunId > 0
    ) {
      const [baselineRun] = await db
        .select()
        .from(evaluationRuns)
        .where(
          and(
            eq(evaluationRuns.id, compareRunId),
            eq(evaluationRuns.evaluationId, evaluationId),
            eq(evaluationRuns.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (baselineRun) {
        const baseline = await db
          .select({
            result: testResults,
            testCase: {
              name: testCases.name,
              input: testCases.input,
              expectedOutput: testCases.expectedOutput,
            },
          })
          .from(testResults)
          .leftJoin(testCases, eq(testResults.testCaseId, testCases.id))
          .where(eq(testResults.evaluationRunId, compareRunId))
          .orderBy(asc(testResults.createdAt));
        baselineResults = baseline.map((r) => ({
          ...r.result,
          test_cases: r.testCase,
        }));
      }
    }

    const payload: Record<string, unknown> = {
      run: runData[0],
      results: formattedResults,
    };
    if (baselineResults) {
      payload.baselineResults = baselineResults;
      payload.compareRunId = compareRunId;
    }

    return NextResponse.json(payload);
  },
  { requiredScopes: [SCOPES.RUNS_READ] },
);
