"use client"

import { use } from 'react'  // Add this import
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ArrowLeft, Play, Plus, FileText } from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

// Update type
type PageProps = {
  params: Promise<{ id: string }>
}

export default function EvaluationDetailPage({ params }: PageProps) {
  const { id } = use(params)  // Unwrap Promise with use()
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [evaluation, setEvaluation] = useState<any>(null)
  const [testCases, setTestCases] = useState<any[]>([])
  const [runs, setRuns] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/auth/login")
      return
    }

    if (session?.user) {
      const token = localStorage.getItem("bearer_token")
      
      // Fetch evaluation
      fetch(`/api/evaluations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            router.push("/evaluations")
          } else {
            setEvaluation(data.evaluation)
          }
        })

      // Fetch test cases
      fetch(`/api/evaluations/${id}/test-cases`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setTestCases(data.testCases || []))

      // Fetch runs
      fetch(`/api/evaluations/${id}/runs`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          setRuns(data.runs || [])
          setIsLoading(false)
        })
    }
  }, [session, isPending, router, id])  // Changed from params.id to id

  if (isPending || !session?.user || isLoading || !evaluation) {
    return null
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="sm" asChild className="h-9">
          <Link href="/evaluations">
            <ArrowLeft className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Back to Evaluations</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </Button>
      </div>

      {/* Evaluation Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold">{evaluation.name}</h1>
              <Badge
                variant="outline"
                className={`${
                  evaluation.type === "unit_test"
                    ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                    : evaluation.type === "human_eval"
                      ? "bg-green-500/10 text-green-500 border-green-500/20"
                      : evaluation.type === "model_eval"
                        ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                        : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                }`}
              >
                {evaluation.type.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">{evaluation.description || "No description provided"}</p>
          </div>
          <Button size="sm" className="w-full sm:w-auto">
            <Play className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Run Evaluation
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-3">
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium">Test Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{testCases.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{runs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium">Last Run</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs sm:text-sm">
              {runs.length > 0 ? new Date(runs[0].started_at).toLocaleDateString() : "Never"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Cases */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-semibold">Test Cases</h2>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <Plus className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Add Test Case
          </Button>
        </div>

        {testCases.length > 0 ? (
          <div className="space-y-2 sm:space-y-3">
            {testCases.map((testCase: any) => (
              <Card key={testCase.id}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm sm:text-base font-semibold mb-2">{testCase.name}</h3>
                      <div className="grid gap-2 sm:gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Input</p>
                          <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-24">
                            {JSON.stringify(testCase.input, null, 2)}
                          </pre>
                        </div>
                        {testCase.expected_output && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Expected Output</p>
                            <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-24">
                              {JSON.stringify(testCase.expected_output, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No test cases yet</h3>
              <p className="text-muted-foreground mb-4">Add test cases to start evaluating your AI models</p>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Test Case
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Runs */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Recent Runs</h2>
        {runs.length > 0 ? (
          <div className="space-y-3">
            {runs.map((run: any) => (
              <Card key={run.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <Badge
                          variant="outline"
                          className={`${
                            run.status === "completed"
                              ? "bg-green-500/10 text-green-500 border-green-500/20"
                              : run.status === "running"
                                ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                : run.status === "failed"
                                  ? "bg-red-500/10 text-red-500 border-red-500/20"
                                  : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                          }`}
                        >
                          {run.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{new Date(run.started_at).toLocaleString()}</span>
                      </div>
                      {run.status === "completed" && (
                        <p className="text-sm">
                          {run.passed_tests} / {run.total_tests} tests passed
                        </p>
                      )}
                    </div>
                    <Button variant="outline" size="sm">
                      View Results
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No runs yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
