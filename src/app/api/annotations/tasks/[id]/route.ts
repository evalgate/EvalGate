import { NextResponse, NextRequest } from "next/server"
import { db } from '@/db'
import { annotationTasks, testCases, evaluationRuns, evaluations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request)
    const { id } = await params

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch task with related data using joins
    const taskData = await db
      .select({
        task: annotationTasks,
        testCase: {
          name: testCases.name,
          input: testCases.input,
          expectedOutput: testCases.expectedOutput,
        },
        evaluationRun: {
          id: evaluationRuns.id,
        },
        evaluation: {
          name: evaluations.name,
          type: evaluations.type,
        }
      })
      .from(annotationTasks)
      .leftJoin(testCases, eq(annotationTasks.id, testCases.id))
      .leftJoin(evaluationRuns, eq(annotationTasks.id, evaluationRuns.id))
      .leftJoin(evaluations, eq(evaluationRuns.evaluationId, evaluations.id))
      .where(eq(annotationTasks.id, parseInt(id)))
      .limit(1)

    if (taskData.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Format response to match Supabase structure
    const formattedTask = {
      ...taskData[0].task,
      test_cases: taskData[0].testCase,
      evaluation_runs: taskData[0].evaluationRun ? {
        ...taskData[0].evaluationRun,
        evaluations: taskData[0].evaluation,
      } : null,
    }

    return NextResponse.json({ task: formattedTask })
  } catch (error) {
    console.error('GET annotation task error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}