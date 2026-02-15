import { NextResponse, NextRequest } from "next/server"
import { db } from '@/db'
import { traces, spans } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request)
    const { id } = await params

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch trace
    const traceData = await db
      .select()
      .from(traces)
      .where(eq(traces.id, parseInt(id)))
      .limit(1)

    if (traceData.length === 0) {
      return NextResponse.json({ error: "Trace not found" }, { status: 404 })
    }

    // Fetch all spans for this trace ordered by start time
    const traceSpans = await db
      .select()
      .from(spans)
      .where(eq(spans.traceId, parseInt(id)))
      .orderBy(asc(spans.startTime))

    return NextResponse.json({ trace: traceData[0], spans: traceSpans })
  } catch (error) {
    console.error('GET trace error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}