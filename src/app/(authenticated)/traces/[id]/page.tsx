"use client"

import { use } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeft, Clock, Zap, AlertCircle } from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type PageProps = {
  params: Promise<{ id: string }>
}

export default function TraceDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [trace, setTrace] = useState<any>(null)
  const [spans, setSpans] = useState<any[]>([])
  const [rootSpans, setRootSpans] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/auth/login")
      return
    }

    if (session?.user) {
      const token = localStorage.getItem("bearer_token")
      
      fetch(`/api/traces/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            router.push("/traces")
          } else {
            setTrace(data.trace)
          }
        })

      fetch(`/api/traces/${id}/spans`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          const fetchedSpans = data.spans || []
          setSpans(fetchedSpans)
          
          const spanMap = new Map()
          const roots: any[] = []

          fetchedSpans.forEach((span: any) => {
            spanMap.set(span.id, { ...span, children: [] })
          })

          fetchedSpans.forEach((span: any) => {
            const spanNode = spanMap.get(span.id)
            if (span.parent_span_id) {
              const parent = spanMap.get(span.parent_span_id)
              if (parent) {
                parent.children.push(spanNode)
              } else {
                roots.push(spanNode)
              }
            } else {
              roots.push(spanNode)
            }
          })

          setRootSpans(roots)
          setIsLoading(false)
        })
    }
  }, [session, isPending, router, id])

  if (isPending || !session?.user || isLoading || !trace) {
    return null
  }

  const totalDuration = spans.reduce((sum: number, span: any) => sum + (span.duration_ms || 0), 0)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="sm" asChild className="h-9">
          <Link href="/traces">
            <ArrowLeft className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Back to Traces</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{trace.name}</h1>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {new Date(trace.created_at).toLocaleString()}
          </div>
          {trace.session_id && (
            <div className="font-mono text-xs sm:text-sm break-all">
              Session: <span className="text-foreground">{trace.session_id}</span>
            </div>
          )}
        </div>
        {trace.tags && trace.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {trace.tags.map((tag: string) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-primary/10 px-2.5 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-3">
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Spans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{spans.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{totalDuration}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{spans.filter((s: any) => s.error).length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Span Timeline</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Hierarchical view of all spans in this trace</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {rootSpans.length > 0 ? (
            <div className="space-y-2">
              {rootSpans.map((span) => (
                <SpanNode key={span.id} span={span} level={0} />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">No spans recorded</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SpanNode({ span, level }: { span: any; level: number }) {
  const hasError = !!span.error

  return (
    <div className="space-y-2">
      <div
        className={`rounded-lg border p-4 ${hasError ? "border-destructive bg-destructive/5" : "border-border bg-card"}`}
        style={{ marginLeft: `${level * 24}px` }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  span.span_type === "llm"
                    ? "bg-blue-500/10 text-blue-500"
                    : span.span_type === "tool"
                      ? "bg-green-500/10 text-green-500"
                      : span.span_type === "agent"
                        ? "bg-purple-500/10 text-purple-500"
                        : "bg-gray-500/10 text-gray-500"
                }`}
              >
                {span.span_type}
              </span>
              <span className="font-semibold">{span.name}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {span.duration_ms}ms
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(span.start_time).toLocaleTimeString()}
              </div>
            </div>
            {hasError && (
              <div className="mt-2 flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>{span.error}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Input</div>
            <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-32">
              {JSON.stringify(span.input, null, 2)}
            </pre>
          </div>
          {span.output && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Output</div>
              <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-32">
                {JSON.stringify(span.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {span.children && span.children.length > 0 && (
        <div className="space-y-2">
          {span.children.map((child: any) => (
            <SpanNode key={child.id} span={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
