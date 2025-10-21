import { NextResponse, NextRequest } from "next/server"
import { db } from '@/db'
import { humanAnnotations, user, testCases, annotationTasks } from '@/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { withRateLimit } from '@/lib/api-rate-limit'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  return withRateLimit(request, async (req) => {
    try {
    const currentUser = await getCurrentUser(request)

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const evaluationRunId = searchParams.get("evaluationRunId")
    const testCaseId = searchParams.get("testCaseId")

    // Build conditions array
    const conditions = []
    if (evaluationRunId) {
      conditions.push(eq(humanAnnotations.evaluationRunId, parseInt(evaluationRunId)))
    }
    if (testCaseId) {
      conditions.push(eq(humanAnnotations.testCaseId, parseInt(testCaseId)))
    }

    // Build query with conditions
    let query = db
      .select({
        id: humanAnnotations.id,
        evaluationRunId: humanAnnotations.evaluationRunId,
        testCaseId: humanAnnotations.testCaseId,
        annotatorId: humanAnnotations.annotatorId,
        rating: humanAnnotations.rating,
        feedback: humanAnnotations.feedback,
        labels: humanAnnotations.labels,
        metadata: humanAnnotations.metadata,
        createdAt: humanAnnotations.createdAt,
        annotator: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        testCase: {
          name: testCases.name,
        }
      })
      .from(humanAnnotations)
      .leftJoin(user, eq(humanAnnotations.annotatorId, user.id))
      .leftJoin(testCases, eq(humanAnnotations.testCaseId, testCases.id))

    // Apply conditions if any exist
    let annotations
    if (conditions.length > 0) {
      annotations = await query
        .where(and(...conditions))
        .orderBy(desc(humanAnnotations.createdAt))
    } else {
      annotations = await query
        .orderBy(desc(humanAnnotations.createdAt))
    }

    // Format response to match Supabase structure
    const formattedAnnotations = annotations.map(a => ({
      ...a,
      users: a.annotator,
      test_cases: a.testCase,
      annotator: undefined,
      testCase: undefined,
    }))

    return NextResponse.json({ annotations: formattedAnnotations })
    } catch (error) {
      logger.error({ error, route: '/api/annotations', method: 'GET' }, 'Error fetching annotations')
      return NextResponse.json({ error: 'Internal server error: ' + error }, { status: 500 })
    }
  }, { customTier: 'free' });
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request)

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { evaluationRunId, testCaseId, rating, feedback, labels, metadata } = body

    if (!evaluationRunId || !testCaseId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Create annotation
    const newAnnotation = await db
      .insert(humanAnnotations)
      .values({
        evaluationRunId,
        testCaseId,
        annotatorId: currentUser.id,
        rating: rating || null,
        feedback: feedback || null,
        labels: labels || {},
        metadata: metadata || {},
        createdAt: now,
      })
      .returning()

    // Update task status to completed if it exists
    const existingTasks = await db
      .select()
      .from(annotationTasks)
      .where(eq(annotationTasks.id, testCaseId))
      .limit(1)

    if (existingTasks.length > 0) {
      await db
        .update(annotationTasks)
        .set({ 
          status: "completed",
          updatedAt: now,
        })
        .where(eq(annotationTasks.id, testCaseId))
    }

    return NextResponse.json({ annotation: newAnnotation[0] }, { status: 201 })
  } catch (error) {
    logger.error({ error, route: '/api/annotations', method: 'POST' }, 'Error creating annotation')
    return NextResponse.json({ error: 'Internal server error: ' + error }, { status: 500 })
  }
}
