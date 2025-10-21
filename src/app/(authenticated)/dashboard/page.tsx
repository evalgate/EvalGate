import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Plus, Activity, FileText } from "lucide-react"
import { PlanUsageIndicator } from "@/components/plan-usage-indicator"
import { auth } from "@/lib/auth"
import { db } from "@/db"
import { evaluations, traces, evaluationRuns } from "@/db/schema"
import { eq, desc, gte, sql } from "drizzle-orm"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

async function getDashboardStats(organizationId: number) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  
  const [evalCount, traceCount, recentRuns] = await Promise.all([
    db.select({ count: sql<number>`count(*)` })
      .from(evaluations)
      .where(eq(evaluations.organizationId, organizationId)),
    db.select({ count: sql<number>`count(*)` })
      .from(traces)
      .where(eq(traces.organizationId, organizationId)),
    db.select({ count: sql<number>`count(*)` })
      .from(evaluationRuns)
      .where(gte(evaluationRuns.createdAt, sevenDaysAgo))
  ])

  return {
    totalEvaluations: evalCount[0]?.count || 0,
    totalTraces: traceCount[0]?.count || 0,
    recentRuns: recentRuns[0]?.count || 0
  }
}

async function getRecentEvaluationRuns(organizationId: number) {
  return db.select()
    .from(evaluationRuns)
    .orderBy(desc(evaluationRuns.createdAt))
    .limit(2)
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>
      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    redirect("/auth/login")
  }
  
  const organizationId = (session.user as any).organizationId || parseInt(process.env.DEFAULT_ORGANIZATION_ID || '1')
  const stats = await getDashboardStats(organizationId)
  const recentRuns = await getRecentEvaluationRuns(organizationId)
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          Welcome back! Here's an overview of your evaluation platform.
        </p>
      </div>

      {/* Usage Indicator */}
      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <PlanUsageIndicator />
      </Suspense>

      {/* Stats Grid */}
      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Evaluations</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvaluations}</div>
            <p className="text-xs text-muted-foreground">Across all types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Recent Runs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentRuns}</div>
            <p className="text-xs text-muted-foreground">In the last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Traces</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTraces}</div>
            <p className="text-xs text-muted-foreground">Recent traces</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        <Link href="/evaluations/new">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">Create Evaluation</CardTitle>
              <CardDescription className="text-sm">Set up a new test suite</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/traces">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">View Traces</CardTitle>
              <CardDescription className="text-sm">Inspect LLM calls and debug</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/evaluations">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">Browse Evaluations</CardTitle>
              <CardDescription className="text-sm">View all test suites</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="mb-3 sm:mb-4 text-base sm:text-lg font-semibold">Recent Evaluation Runs</h3>
        <Card>
          <CardContent className="p-0">
            {recentRuns.length > 0 ? (
              <div className="divide-y divide-border">
                {recentRuns.map((run) => (
                  <div key={run.id} className="p-3 sm:p-4 space-y-2">
                    <p className="font-medium text-sm sm:text-base">Evaluation Run #{run.id}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {run.totalCases} cases • {run.passedCases || 0} passed • {run.failedCases || 0} failed
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        run.status === 'completed' 
                          ? 'bg-primary/10 text-primary'
                          : run.status === 'running'
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'bg-yellow-500/10 text-yellow-500'
                      }`}
                    >
                      {run.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <p className="text-sm">No recent evaluation runs</p>
                <Link href="/evaluations/new" className="text-sm text-primary hover:underline mt-2 inline-block">
                  Create your first evaluation
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}