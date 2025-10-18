"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import Link from "next/link"
import { ArrowLeft, Star } from "lucide-react"

interface TestCase {
  name?: string
  input?: string
  expected_output?: string
}

interface TaskType {
  evaluation_run_id: string
  test_case_id: string
  test_cases?: TestCase
}

// Updated type for Next.js 15
type PageProps = {
  params: Promise<{ id: string }>  // Changed: params is now a Promise
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>  // Also a Promise
}

export default function Page({ params }: PageProps) {
  const router = useRouter()
  const [task, setTask] = useState<TaskType | null>(null)
  const [rating, setRating] = useState<number>(3)
  const [feedback, setFeedback] = useState("")
  const [labels, setLabels] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)  // New state for the unwrapped id

  // Unwrap params Promise
  useEffect(() => {
    params.then((resolvedParams) => {
      setTaskId(resolvedParams.id)
    })
  }, [params])

  useEffect(() => {
    if (!taskId) return  // Don't fetch until we have the id

    const fetchTask = async () => {
      try {
        const response = await fetch(`/api/annotations/tasks/${taskId}`)
        if (!response.ok) throw new Error("Failed to fetch task")
        const data = await response.json()
        setTask(data.task)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    fetchTask()
  }, [taskId])  // Changed dependency to taskId

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    if (!task) {
      setError("Task data is not available")
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluationRunId: task.evaluation_run_id,
          testCaseId: task.test_case_id,
          rating,
          feedback,
          labels,
        }),
      })

      if (!response.ok) throw new Error("Failed to submit annotation")

      router.push("/annotations")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-muted-foreground">Loading task...</div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-muted-foreground">Task not found</div>
      </div>
    )
  }

  const { test_cases: testCase = {} } = task

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="sm" asChild className="h-9">
          <Link href="/annotations">
            <ArrowLeft className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Back to Annotations</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Annotation Task</h1>
        <p className="text-sm sm:text-base text-muted-foreground">{testCase?.name || "Unnamed Test Case"}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Test Case Input */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Input</CardTitle>
            <CardDescription className="text-xs sm:text-sm">The input provided to the AI model</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <pre className="rounded-lg bg-muted p-3 sm:p-4 text-xs sm:text-sm overflow-x-auto">
              {JSON.stringify(task.test_cases?.input, null, 2)}
            </pre>
          </CardContent>
        </Card>

        {/* Expected Output (if available) */}
        {task.test_cases?.expected_output && (
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Expected Output</CardTitle>
              <CardDescription className="text-xs sm:text-sm">The expected response from the AI model</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <pre className="rounded-lg bg-muted p-3 sm:p-4 text-xs sm:text-sm overflow-x-auto">
                {JSON.stringify(task.test_cases.expected_output, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Rating */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Rating</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Rate the quality of the AI output (1-5 stars)</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                    value <= rating ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"
                  }`}
                >
                  <Star className="h-6 w-6 sm:h-8 sm:w-8" fill={value <= rating ? "currentColor" : "none"} />
                </button>
              ))}
              <span className="ml-2 sm:ml-4 text-base sm:text-lg font-semibold">{rating} / 5</span>
            </div>
          </CardContent>
        </Card>

        {/* Quality Labels */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Quality Assessment</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Evaluate specific aspects of the output</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
            <div className="space-y-3">
              <Label>Accuracy</Label>
              <RadioGroup
                value={labels.accuracy || ""}
                onValueChange={(value) => setLabels({ ...labels, accuracy: value })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="accurate" id="acc-accurate" />
                  <Label htmlFor="acc-accurate" className="font-normal cursor-pointer">
                    Accurate
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mostly_accurate" id="acc-mostly" />
                  <Label htmlFor="acc-mostly" className="font-normal cursor-pointer">
                    Mostly Accurate
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="inaccurate" id="acc-inaccurate" />
                  <Label htmlFor="acc-inaccurate" className="font-normal cursor-pointer">
                    Inaccurate
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>Helpfulness</Label>
              <RadioGroup
                value={labels.helpfulness || ""}
                onValueChange={(value) => setLabels({ ...labels, helpfulness: value })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="very_helpful" id="help-very" />
                  <Label htmlFor="help-very" className="font-normal cursor-pointer">
                    Very Helpful
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="somewhat_helpful" id="help-somewhat" />
                  <Label htmlFor="help-somewhat" className="font-normal cursor-pointer">
                    Somewhat Helpful
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="not_helpful" id="help-not" />
                  <Label htmlFor="help-not" className="font-normal cursor-pointer">
                    Not Helpful
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>Tone</Label>
              <RadioGroup value={labels.tone || ""} onValueChange={(value) => setLabels({ ...labels, tone: value })}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="appropriate" id="tone-appropriate" />
                  <Label htmlFor="tone-appropriate" className="font-normal cursor-pointer">
                    Appropriate
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="too_formal" id="tone-formal" />
                  <Label htmlFor="tone-formal" className="font-normal cursor-pointer">
                    Too Formal
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="too_casual" id="tone-casual" />
                  <Label htmlFor="tone-casual" className="font-normal cursor-pointer">
                    Too Casual
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Feedback */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Detailed Feedback</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Provide specific comments about the output</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <Textarea
              placeholder="What did you like or dislike about this output? Any specific issues or improvements?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={6}
              className="text-sm"
            />
          </CardContent>
        </Card>

        {error && <div className="rounded-md bg-destructive/10 p-3 text-xs sm:text-sm text-destructive">{error}</div>}

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Button type="submit" disabled={isSubmitting} className="flex-1" size="sm">
            {isSubmitting ? "Submitting..." : "Submit Annotation"}
          </Button>
          <Button type="button" variant="outline" asChild size="sm" className="flex-1 sm:flex-initial">
            <Link href="/annotations">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
