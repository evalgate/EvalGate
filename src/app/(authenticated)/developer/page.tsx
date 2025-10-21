"use client"

import { Card } from "@/components/ui/card"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useOrganizationId } from "@/hooks/use-organization"
import { getBearerToken } from "@/hooks/use-safe-storage"
import { Activity, Clock, AlertCircle, TrendingUp, BarChart3, Zap } from "lucide-react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

// Lazy load Recharts components
// Import as type "any" to avoid type conflicts with dynamic imports
const LineChart = dynamic<any>(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false }
)
const Line = dynamic<any>(() => import("recharts").then((mod) => mod.Line), { ssr: false })
const BarChart = dynamic<any>(
  () => import("recharts").then((mod) => mod.BarChart),
  { ssr: false }
)
const Bar = dynamic<any>(() => import("recharts").then((mod) => mod.Bar), { ssr: false })
const XAxis = dynamic<any>(() => import("recharts").then((mod) => mod.XAxis), { ssr: false })
const YAxis = dynamic<any>(() => import("recharts").then((mod) => mod.YAxis), { ssr: false })
const CartesianGrid = dynamic<any>(() => import("recharts").then((mod) => mod.CartesianGrid), { ssr: false })
const Tooltip = dynamic<any>(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic<any>(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false })

interface UsageSummary {
  totalRequests: number
  avgResponseTime: number
  errorRate: number
  successRate: number
  requestsByStatusCode: Record<string, number>
  topEndpoints: Array<{ endpoint: string; count: number }>
  requestsOverTime: Array<{ date: string; count: number }>
}

export default function DeveloperDashboardPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const organizationId = useOrganizationId()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [period, setPeriod] = useState("7d")

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/auth/login")
    }
  }, [session, isPending, router])

  useEffect(() => {
    if (session?.user) {
      fetchUsageSummary()
    }
  }, [session, period])

  const fetchUsageSummary = async () => {
    if (!organizationId) return;
    
    try {
      const token = getBearerToken()
      if (!token) return;
      
      const response = await fetch(
        `/api/developer/usage/summary?organizationId=${organizationId}&period=${period}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setSummary(data.summary)
      }
    } catch (error) {
      // Error already handled
    } finally {
      setLoading(false)
    }
  }

  if (isPending || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 md:p-8 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Developer Dashboard</h2>
          <p className="text-muted-foreground">
            API usage metrics, analytics, and performance insights
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-background"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {summary && (
        <>
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                  <p className="text-2xl font-bold">{summary.totalRequests.toLocaleString()}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-500" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                  <p className="text-2xl font-bold">{summary.avgResponseTime}ms</p>
                </div>
                <Clock className="h-8 w-8 text-green-500" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                  <p className="text-2xl font-bold">{summary.errorRate.toFixed(2)}%</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">{summary.successRate.toFixed(2)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-500" />
              </div>
            </Card>
          </div>

          {/* Charts Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Requests Over Time */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Requests Over Time
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={summary.requestsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Top Endpoints */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Top Endpoints
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={summary.topEndpoints.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="endpoint" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Status Codes */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Requests by Status Code</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.entries(summary.requestsByStatusCode).map(([code, count]) => (
                <div key={code} className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-sm text-muted-foreground">{code}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}