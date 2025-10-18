"use client"

import type React from "react"
import { use, useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { ArrowLeft, AlertCircle, Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { useCustomer } from "autumn-js/react"
import { useSession } from "@/lib/auth-client"
import { toast } from "sonner"
import { EvaluationBuilder } from "@/components/evaluation-builder"

type DeploymentStep = {
  id: string
  label: string
  status: "pending" | "in-progress" | "completed" | "error"
  errorMessage?: string
}

export default function NewEvaluationPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { customer, isLoading: isLoadingCustomer, check, refetch } = useCustomer()
  const [isLoading, setIsLoading] = useState(false)
  const [canCreateProject, setCanCreateProject] = useState(true)
  const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStep[]>([])
  const [showDeploymentProgress, setShowDeploymentProgress] = useState(false)

  // Check if user can create more projects
  useEffect(() => {
    if (!isLoadingCustomer && customer) {
      const projectsFeature = customer.features?.projects
      if (projectsFeature && !projectsFeature.unlimited && typeof projectsFeature.balance === 'number') {
        const canCreate = projectsFeature.balance > 0
        setCanCreateProject(canCreate)
      }
    }
  }, [customer, isLoadingCustomer])

  const updateStepStatus = (stepId: string, status: DeploymentStep["status"], errorMessage?: string) => {
    setDeploymentSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, errorMessage } : step
    ))
  }

  const handleDeploy = async (data: {
    name: string
    description: string
    type: string
    templates: Array<{
      id: string
      template: any
      config: any
    }>
  }) => {
    if (!session?.user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    // Initialize deployment steps
    const steps: DeploymentStep[] = [
      { id: "auth", label: "Verifying authentication", status: "pending" },
      { id: "limits", label: "Checking project limits", status: "pending" },
      { id: "org", label: "Loading organization", status: "pending" },
      { id: "create", label: "Creating evaluation", status: "pending" },
      { id: "redirect", label: "Redirecting to evaluation", status: "pending" }
    ]
    
    setDeploymentSteps(steps)
    setShowDeploymentProgress(true)
    setIsLoading(true)

    try {
      // Step 1: Authentication check
      updateStepStatus("auth", "in-progress")
      const token = localStorage.getItem("bearer_token")
      if (!token) {
        throw new Error("Authentication token not found. Please log in again.")
      }
      updateStepStatus("auth", "completed")

      // Step 2: Check feature allowance
      updateStepStatus("limits", "in-progress")
      if (!isLoadingCustomer && customer) {
        const result = await check({ featureId: "projects", requiredBalance: 1 })
        if (result && 'success' in result && !result.success) {
          updateStepStatus("limits", "error", "Project limit reached. Please upgrade your plan.")
          toast.error("Project limit reached. Please upgrade your plan to create more projects.")
          return
        }
      }
      updateStepStatus("limits", "completed")

      // Step 3: Get organization
      updateStepStatus("org", "in-progress")
      const orgResponse = await fetch("/api/organizations/current", {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (!orgResponse.ok) {
        throw new Error("Failed to load organization. Please try again.")
      }
      
      const { organization } = await orgResponse.json()
      updateStepStatus("org", "completed")

      // Step 4: Create evaluation
      updateStepStatus("create", "in-progress")

      // Build combined config from all selected templates
      const combinedConfig = {
        templates: data.templates.map(t => ({
          id: t.template.id,
          name: t.config.name || t.template.name,
          description: t.config.description || t.template.description,
          type: t.template.type,
          judgePrompt: t.config.customPrompt || t.template.judgePrompt,
          testCases: t.template.testCases,
          code: t.template.code,
          humanEvalCriteria: t.template.humanEvalCriteria
        }))
      }
      
      const response = await fetch("/api/evaluations", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          organizationId: organization.id,
          createdBy: session.user.id,
          name: data.name,
          description: data.description,
          type: data.type,
          config: combinedConfig,
          // Execution settings with timeout in SECONDS (not milliseconds)
          executionSettings: {
            batchSize: 10,
            parallelRuns: 5,
            timeout: 30, // 30 seconds (API expects seconds, not ms)
            retry: {
              maxRetries: 3,
              retryDelay: 1000
            },
            stopOnFailure: false
          },
          modelSettings: {
            model: "gpt-4o",
            temperature: 0.7,
            maxTokens: 1000,
            topP: 1.0
          },
          customMetrics: []
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        let errorMessage = responseData.error || "Failed to create evaluation"
        
        // Provide helpful context for common errors
        if (errorMessage.includes("timeout")) {
          errorMessage += "\n\nTip: Timeout must be between 1-3600 seconds."
        } else if (errorMessage.includes("batch")) {
          errorMessage += "\n\nTip: Batch size must be between 1-1000."
        } else if (errorMessage.includes("parallel")) {
          errorMessage += "\n\nTip: Parallel runs must be between 1-100."
        }
        
        updateStepStatus("create", "error", errorMessage)
        
        if (responseData.code === "FEATURE_LIMIT_REACHED") {
          toast.error(responseData.error)
        } else {
          toast.error(errorMessage)
        }
        return
      }

      updateStepStatus("create", "completed")

      // Step 5: Redirect
      updateStepStatus("redirect", "in-progress")
      await refetch()
      updateStepStatus("redirect", "completed")
      
      toast.success("Evaluation created successfully!")
      
      // Small delay to show completion state
      setTimeout(() => {
        router.push(`/evaluations/${responseData.id}`)
      }, 500)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred"
      
      // Update the current step with error
      const currentStep = deploymentSteps.find(s => s.status === "in-progress")
      if (currentStep) {
        updateStepStatus(currentStep.id, "error", errorMessage)
      }
      
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const getStepIcon = (status: DeploymentStep["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "in-progress":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
    }
  }

  const completedSteps = deploymentSteps.filter(s => s.status === "completed").length
  const progressPercentage = (completedSteps / deploymentSteps.length) * 100
  const hasError = deploymentSteps.some(s => s.status === "error")
  const errorStep = deploymentSteps.find(s => s.status === "error")

  // Show upgrade prompt if limit reached
  if (!isLoadingCustomer && !canCreateProject) {
    const projectsFeature = customer?.features?.projects
    const limit = projectsFeature?.included_usage || 0
    const usage = projectsFeature?.usage || 0

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

        <Card className="border-yellow-500/50">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-start gap-2 sm:gap-3">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <CardTitle className="text-base sm:text-lg">Project Limit Reached</CardTitle>
                <CardDescription className="mt-1 sm:mt-2 text-xs sm:text-sm">
                  You've used {usage} of {limit} projects in your current plan.
                  Upgrade to create more projects and unlock additional features.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-4 sm:p-6 pt-0">
            <Button asChild size="sm" className="w-full sm:w-auto">
              <Link href="/pricing">
                Upgrade Plan
              </Link>
            </Button>
            <Button variant="outline" asChild size="sm" className="w-full sm:w-auto">
              <Link href="/evaluations">
                View Existing Projects
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
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

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold">Create New Evaluation</h1>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground">
          Build comprehensive AI evaluations with drag-and-drop templates inspired by industry leaders
        </p>
      </div>

      {/* Deployment Progress Card */}
      {showDeploymentProgress && (
        <Card className={hasError ? "border-destructive/50" : "border-primary/50"}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {hasError ? "Deployment Failed" : isLoading ? "Deploying Evaluation..." : "Deployment Complete"}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeploymentProgress(false)}
                className="h-7 w-7 p-0"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
            <Progress value={progressPercentage} className="h-2 mt-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Deployment Steps */}
            <div className="space-y-2">
              {deploymentSteps.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-start gap-3 p-2 rounded-lg transition-colors",
                    step.status === "in-progress" && "bg-primary/5",
                    step.status === "error" && "bg-destructive/5"
                  )}
                >
                  {getStepIcon(step.status)}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      step.status === "completed" && "text-green-600",
                      step.status === "error" && "text-destructive"
                    )}>
                      {step.label}
                    </p>
                    {step.errorMessage && (
                      <p className="text-xs text-destructive mt-1 whitespace-pre-line">
                        {step.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Error Next Steps */}
            {hasError && errorStep && (
              <Alert className="border-destructive/50 bg-destructive/5">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm space-y-2">
                  <p className="font-semibold">What to do next:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    {errorStep.id === "auth" && (
                      <>
                        <li>Try refreshing the page</li>
                        <li>Log out and log back in</li>
                        <li>Clear your browser cache</li>
                      </>
                    )}
                    {errorStep.id === "limits" && (
                      <>
                        <li>Upgrade your plan to increase project limits</li>
                        <li>Delete unused evaluations to free up space</li>
                        <li>Contact support if you believe this is an error</li>
                      </>
                    )}
                    {errorStep.id === "org" && (
                      <>
                        <li>Check your internet connection</li>
                        <li>Refresh the page and try again</li>
                        <li>Contact support if the issue persists</li>
                      </>
                    )}
                    {errorStep.id === "create" && (
                      <>
                        <li>Review your evaluation settings</li>
                        <li>Ensure all required fields are filled</li>
                        <li>Try again with different configuration values</li>
                        <li>Contact support if you need help</li>
                      </>
                    )}
                  </ul>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowDeploymentProgress(false)
                        setDeploymentSteps([])
                      }}
                    >
                      Dismiss
                    </Button>
                    {errorStep.id === "limits" && (
                      <Button size="sm" asChild>
                        <Link href="/pricing">Upgrade Plan</Link>
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <EvaluationBuilder onDeploy={handleDeploy} />
    </div>
  )
}