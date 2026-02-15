import { NextResponse, NextRequest } from "next/server"
import { db } from '@/db'
import { evaluationRuns, testResults, testCases } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  try {
    const currentUser = await getCurrentUser(request)
    const { runId } = await params

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch run — evaluationRuns has no createdBy, so no user join needed
    const runData = await db
      .select()
      .from(evaluationRuns)
      .where(eq(evaluationRuns.id, parseInt(runId)))
      .limit(1)

    if (runData.length === 0) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 })
    }

    // Fetch test results for this run with test case details
    const results = await db
      .select({
        result: testResults,
        testCase: {
          name: testCases.name,
          input: testCases.input,
          expectedOutput: testCases.expectedOutput,
        }
      })
      .from(testResults)
      .leftJoin(testCases, eq(testResults.testCaseId, testCases.id))
      .where(eq(testResults.evaluationRunId, parseInt(runId)))
      .orderBy(asc(testResults.createdAt))

    const formattedResults = results.map(r => ({
      ...r.result,
      test_cases: r.testCase,
    }))

    return NextResponse.json({ run: runData[0], results: formattedResults })
  } catch (error) {
    console.error('GET evaluation run error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}