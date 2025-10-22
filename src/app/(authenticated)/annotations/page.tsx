"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { Plus, Clipboard, Users, Sparkles, ThumbsUp, Star, CheckSquare, MessageCircle, Settings2, Shield, Target, Zap } from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useCustomer } from "autumn-js/react"

// Annotation task templates
const ANNOTATION_TEMPLATES = [
  {
    id: "thumbs",
    name: "Thumbs Up/Down",
    icon: ThumbsUp,
    description: "Simple binary feedback for response quality",
    taskType: "binary",
    instructions: `Please review each AI response and indicate whether it's good or bad.

Click 👍 if the response is:
- Accurate and helpful
- Professional and appropriate
- Answers the question

Click 👎 if the response is:
- Inaccurate or unhelpful
- Inappropriate or unprofessional
- Doesn't answer the question`,
    fields: [
      { name: "rating", label: "Quality", type: "binary", options: ["👍 Good", "👎 Bad"] }
    ]
  },
  {
    id: "quality-scale",
    name: "Quality Rating (1-5)",
    icon: Star,
    description: "Rate responses on a 5-point scale",
    taskType: "rating",
    instructions: `Rate each response on a scale of 1-5 stars:

⭐ - Poor: Incorrect, unhelpful, or inappropriate
⭐⭐ - Below Average: Some issues, partially helpful
⭐⭐⭐ - Average: Acceptable but could be better
⭐⭐⭐⭐ - Good: Helpful and accurate
⭐⭐⭐⭐⭐ - Excellent: Perfect response, very helpful`,
    fields: [
      { name: "quality", label: "Overall Quality", type: "rating", scale: 5 },
      { name: "accuracy", label: "Accuracy", type: "rating", scale: 5 },
      { name: "helpfulness", label: "Helpfulness", type: "rating", scale: 5 }
    ]
  },
  {
    id: "multi-criteria",
    name: "Multi-Criteria Evaluation",
    icon: CheckSquare,
    description: "Evaluate responses across multiple dimensions",
    taskType: "checklist",
    instructions: `Evaluate each response by checking all criteria that apply:

Quality Criteria:
- ✓ Factually accurate
- ✓ Answers the question
- ✓ Professional tone
- ✓ Well-structured
- ✓ Appropriate length

Flag any issues:
- ⚠️ Contains errors
- ⚠️ Inappropriate content
- ⚠️ Misses key information`,
    fields: [
      { name: "criteria", label: "Quality Checks", type: "checklist", options: [
        "Factually accurate",
        "Answers the question",
        "Professional tone",
        "Well-structured",
        "Appropriate length"
      ]},
      { name: "issues", label: "Flag Issues", type: "checklist", options: [
        "Contains errors",
        "Inappropriate content",
        "Misses key information"
      ]}
    ]
  },
  {
    id: "detailed-feedback",
    name: "Detailed Feedback",
    icon: MessageCircle,
    description: "Collect written feedback and improvement suggestions",
    taskType: "open-ended",
    instructions: `Please provide detailed feedback on each response:

1. What did the AI do well?
2. What could be improved?
3. Any specific errors or concerns?
4. Overall rating (1-5 stars)

Be specific and provide examples where possible.`,
    fields: [
      { name: "strengths", label: "Strengths", type: "text", placeholder: "What did this response do well?" },
      { name: "improvements", label: "Improvements", type: "text", placeholder: "What could be better?" },
      { name: "concerns", label: "Concerns", type: "text", placeholder: "Any errors or issues?" },
      { name: "rating", label: "Overall Rating", type: "rating", scale: 5 }
    ]
  }
]

// AnnotationTask interface
interface AnnotationTask {
  id: string
  name: string
  description: string
  status: "pending" | "completed"
  completed_items: number
  total_items: number
}

// Helper functions
const fetchTasks = async (session: any) => {
  try {
    const response = await fetch("/api/annotations/tasks", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("bearer_token")}`
      }
    })
    const data = await response.json()
    return data.tasks || []
  } catch (error) {
    console.error("Error fetching tasks:", error)
    return []
  }
}

export default function AnnotationsPage() {
  const { data: session, isPending } = useSession()
  const { customer, check, track, refetch, isLoading: customerLoading } = useCustomer()
  const router = useRouter()
  const [tasks, setTasks] = useState<AnnotationTask[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [taskName, setTaskName] = useState("")
  const [taskDescription, setTaskDescription] = useState("")
  const [taskInstructions, setTaskInstructions] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  // Advanced settings
  const [requireMultipleAnnotators, setRequireMultipleAnnotators] = useState(false)
  const [minAnnotators, setMinAnnotators] = useState(2)
  const [requireConsensus, setRequireConsensus] = useState(false)
  const [consensusThreshold, setConsensusThreshold] = useState(0.8)
  const [enableQualityControl, setEnableQualityControl] = useState(false)
  const [goldStandardPercentage, setGoldStandardPercentage] = useState(10)
  const [minAccuracyThreshold, setMinAccuracyThreshold] = useState(0.7)
  const [annotatorAssignment, setAnnotatorAssignment] = useState("open")
  const [enableReview, setEnableReview] = useState(false)

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/auth/login")
      return
    }

    if (session?.user) {
      fetchTasks(session)
        .then(tasks => {
          setTasks(tasks)
          setLoading(false)
        })
        .catch(() => {
          setLoading(false)
        })
    }
  }, [session, isPending, router])

  const handleTemplateSelect = (templateId: string) => {
    const template = ANNOTATION_TEMPLATES.find(t => t.id === templateId)
    if (template) {
      setSelectedTemplate(templateId)
      setTaskName(template.name)
      setTaskDescription(template.description)
      setTaskInstructions(template.instructions)
    }
  }

  const handleCreateTask = async () => {
    if (!taskName || !taskInstructions) {
      toast.error("Please fill in all required fields")
      return
    }

    // Check annotation quota before creating
    const { data: checkResult } = await check({ featureId: "annotations", requiredBalance: 1 })
    if (!checkResult?.allowed) {
      toast.error("You've reached your annotation task limit. Please upgrade your plan.")
      setShowCreateDialog(false)
      // TODO: Show upgrade modal
      return
    }

    setIsCreating(true)
    try {
      const token = localStorage.getItem("bearer_token")
      const template = selectedTemplate ? ANNOTATION_TEMPLATES.find(t => t.id === selectedTemplate) : null
      
      const response = await fetch("/api/annotations/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: taskName,
          description: taskDescription,
          instructions: taskInstructions,
          template: selectedTemplate,
          config: template ? {
            taskType: template.taskType,
            fields: template.fields
          } : null,
          annotationSettings: {
            multipleAnnotators: requireMultipleAnnotators ? {
              enabled: true,
              minAnnotators,
              requireConsensus,
              consensusThreshold
            } : null,
            qualityControl: enableQualityControl ? {
              enabled: true,
              goldStandardPercentage,
              minAccuracyThreshold
            } : null,
            assignment: annotatorAssignment,
            enableReview
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 402) {
          toast.error("Annotation task limit reached. Please upgrade your plan.")
        } else {
          toast.error(errorData.error || "Failed to create annotation task")
        }
        return
      }

      const data = await response.json()
      toast.success(template ? "Task created from template!" : "Annotation task created!")
      
      // Refresh customer data to update usage
      await refetch()
      
      // Refresh tasks list
      const updatedTasks = await fetchTasks(session)
      setTasks(updatedTasks)
      
      setShowCreateDialog(false)
      // Reset form
      setSelectedTemplate(null)
      setTaskName("")
      setTaskDescription("")
      setTaskInstructions("")
      setRequireMultipleAnnotators(false)
      setMinAnnotators(2)
      setRequireConsensus(false)
      setConsensusThreshold(0.8)
      setEnableQualityControl(false)
    } catch (error) {
      toast.error("Failed to create annotation task")
    } finally {
      setIsCreating(false)
    }
  }

  if (isPending || loading || customerLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 sm:h-8 sm:w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  // Get annotation feature usage
  const annotationFeature = customer?.features?.["annotations"]
  const annotationsUsed = annotationFeature?.usage || 0
  const annotationsLimit = annotationFeature?.included_usage
  const hasLimit = typeof annotationsLimit === "number"
  const percentage = hasLimit ? Math.min(100, (annotationsUsed / annotationsLimit) * 100) : 0
  const isNearLimit = hasLimit && percentage >= 80

  return (
    <div className="flex-1 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Human Annotations</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Collect human feedback on model outputs</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Usage indicator */}
          {hasLimit && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono">
                {annotationsUsed}/{annotationsLimit}
              </span>
              {isNearLimit && <Zap className="h-3 w-3 text-yellow-500" />}
            </div>
          )}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Create task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Annotation Task</DialogTitle>
                <DialogDescription>
                  Set up a task for human annotators to review and rate model outputs with advanced quality controls
                </DialogDescription>
              </DialogHeader>

              {!selectedTemplate && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Choose a template to get started quickly
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ANNOTATION_TEMPLATES.map((template) => {
                      const Icon = template.icon
                      return (
                        <Card
                          key={template.id}
                          className="cursor-pointer hover:border-primary transition-colors"
                          onClick={() => handleTemplateSelect(template.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="rounded-lg bg-primary/10 p-2 flex-shrink-0">
                                <Icon className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm mb-1">{template.name}</h3>
                                <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setSelectedTemplate("custom")}
                  >
                    Start from scratch
                  </Button>
                </div>
              )}

              {selectedTemplate && (
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">Basic</TabsTrigger>
                    <TabsTrigger value="annotators">
                      <Users className="h-3 w-3 mr-2" />
                      Annotators
                    </TabsTrigger>
                    <TabsTrigger value="quality">
                      <Shield className="h-3 w-3 mr-2" />
                      Quality
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4 mt-4">
                    {selectedTemplate !== "custom" && (
                      <div className="rounded-lg bg-primary/10 p-3 text-sm">
                        <div className="flex items-center gap-2 text-primary font-medium mb-1">
                          <Sparkles className="h-4 w-4" />
                          Using {ANNOTATION_TEMPLATES.find(t => t.id === selectedTemplate)?.name} template
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTemplate(null)
                            setTaskName("")
                            setTaskDescription("")
                            setTaskInstructions("")
                          }}
                          className="mt-2 h-7 text-xs"
                        >
                          Change template
                        </Button>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="task-name">Task Name *</Label>
                      <Input
                        id="task-name"
                        placeholder="e.g., Rate Customer Support Responses"
                        value={taskName}
                        onChange={(e) => setTaskName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="task-description">Description</Label>
                      <Input
                        id="task-description"
                        placeholder="Brief description of what annotators will do"
                        value={taskDescription}
                        onChange={(e) => setTaskDescription(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="task-instructions">Instructions for Annotators *</Label>
                      <Textarea
                        id="task-instructions"
                        placeholder="Provide clear instructions on how to evaluate each item..."
                        value={taskInstructions}
                        onChange={(e) => setTaskInstructions(e.target.value)}
                        rows={8}
                      />
                      <p className="text-xs text-muted-foreground">
                        Clear instructions help annotators provide consistent, quality feedback
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="annotators" className="space-y-6 mt-4">
                    {/* Multiple Annotators */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          <Label htmlFor="multiple-annotators" className="text-sm font-semibold">Multiple Annotators per Item</Label>
                        </div>
                        <Switch
                          id="multiple-annotators"
                          checked={requireMultipleAnnotators}
                          onCheckedChange={setRequireMultipleAnnotators}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Have multiple annotators review each item for more reliable results
                      </p>

                      {requireMultipleAnnotators && (
                        <div className="space-y-3 pl-6 border-l-2 border-primary/20">
                          <div className="space-y-2">
                            <Label htmlFor="min-annotators">Minimum Annotators: {minAnnotators}</Label>
                            <Slider
                              id="min-annotators"
                              min={2}
                              max={10}
                              step={1}
                              value={[minAnnotators]}
                              onValueChange={([value]) => setMinAnnotators(value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Required number of annotators per item
                            </p>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <Label htmlFor="require-consensus" className="text-sm">Require Consensus</Label>
                              <p className="text-xs text-muted-foreground">Item marked complete only when annotators agree</p>
                            </div>
                            <Switch
                              id="require-consensus"
                              checked={requireConsensus}
                              onCheckedChange={setRequireConsensus}
                            />
                          </div>

                          {requireConsensus && (
                            <div className="space-y-2 pl-6">
                              <Label htmlFor="consensus-threshold">Consensus Threshold: {(consensusThreshold * 100).toFixed(0)}%</Label>
                              <Slider
                                id="consensus-threshold"
                                min={0.5}
                                max={1}
                                step={0.05}
                                value={[consensusThreshold]}
                                onValueChange={([value]) => setConsensusThreshold(value)}
                              />
                              <p className="text-xs text-muted-foreground">
                                Percentage of annotators that must agree
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Annotator Assignment */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-semibold">Assignment Method</Label>
                      </div>

                      <div className="space-y-2">
                        <Select value={annotatorAssignment} onValueChange={setAnnotatorAssignment}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open - Any team member can annotate</SelectItem>
                            <SelectItem value="assigned">Assigned - Specific annotators only</SelectItem>
                            <SelectItem value="round-robin">Round Robin - Distribute evenly</SelectItem>
                            <SelectItem value="expertise">Expertise-based - Match to skills</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {annotatorAssignment === "open" && "All team members can annotate any item"}
                          {annotatorAssignment === "assigned" && "Only assigned annotators can work on specific items"}
                          {annotatorAssignment === "round-robin" && "Items distributed evenly among annotators"}
                          {annotatorAssignment === "expertise" && "Items matched to annotators based on expertise"}
                        </p>
                      </div>
                    </div>

                    {/* Review Process */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Settings2 className="h-4 w-4 text-primary" />
                          <Label htmlFor="enable-review" className="text-sm font-semibold">Review Process</Label>
                        </div>
                        <Switch
                          id="enable-review"
                          checked={enableReview}
                          onCheckedChange={setEnableReview}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Enable review and approval workflow for annotations before finalizing
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="quality" className="space-y-6 mt-4">
                    {/* Quality Control */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          <Label htmlFor="quality-control" className="text-sm font-semibold">Quality Control</Label>
                        </div>
                        <Switch
                          id="quality-control"
                          checked={enableQualityControl}
                          onCheckedChange={setEnableQualityControl}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use gold standard items and accuracy tracking to ensure annotation quality
                      </p>

                      {enableQualityControl && (
                        <div className="space-y-3 pl-6 border-l-2 border-primary/20">
                          <div className="space-y-2">
                            <Label htmlFor="gold-standard">Gold Standard Items: {goldStandardPercentage}%</Label>
                            <Slider
                              id="gold-standard"
                              min={5}
                              max={30}
                              step={5}
                              value={[goldStandardPercentage]}
                              onValueChange={([value]) => setGoldStandardPercentage(value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Percentage of items with known correct answers for quality checks
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="accuracy-threshold">Minimum Accuracy: {(minAccuracyThreshold * 100).toFixed(0)}%</Label>
                            <Slider
                              id="accuracy-threshold"
                              min={0.5}
                              max={1}
                              step={0.05}
                              value={[minAccuracyThreshold]}
                              onValueChange={([value]) => setMinAccuracyThreshold(value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Required accuracy on gold standard items to continue annotating
                            </p>
                          </div>

                          <div className="rounded-lg bg-yellow-500/10 p-3 text-sm">
                            <p className="text-yellow-700 dark:text-yellow-400 text-xs">
                              <strong>Note:</strong> Annotators below the accuracy threshold will be notified and may need retraining
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Data Quality Metrics */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-semibold">Tracked Metrics</Label>
                      </div>

                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-3 w-3" />
                          <span>Inter-annotator agreement (when multiple annotators enabled)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-3 w-3" />
                          <span>Time per annotation (to identify anomalies)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-3 w-3" />
                          <span>Accuracy on gold standard items</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-3 w-3" />
                          <span>Completion rate and progress tracking</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <div className="flex gap-3 mt-6">
                    <Button onClick={handleCreateTask} disabled={isCreating} className="flex-1">
                      {isCreating ? "Creating..." : "Create Task"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateDialog(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </Tabs>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Show warning if near limit */}
      {isNearLimit && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="p-4 flex items-start gap-3">
            <Zap className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-900 dark:text-yellow-100">
                Approaching annotation task limit
              </h4>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                You've used {annotationsUsed} of {annotationsLimit} annotation tasks this month. Upgrade your plan for more tasks.
              </p>
              <Button size="sm" variant="outline" className="mt-2" asChild>
                <Link href="/pricing">Upgrade Plan</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:gap-6">
        {tasks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
              <div className="rounded-full bg-primary/10 p-3 sm:p-4 mb-4">
                <Clipboard className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">No annotation tasks yet</h3>
              <p className="text-xs sm:text-sm text-muted-foreground text-center mb-4 sm:mb-6 max-w-sm">
                Create your first annotation task to start collecting human feedback with quality controls
              </p>
              <Button className="w-full sm:w-auto" onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Task
              </Button>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card key={task.id} className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1 space-y-1">
                  <h3 className="text-base sm:text-lg font-semibold">{task.name}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{task.description}</p>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2 text-xs sm:text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                      {task.completed_items}/{task.total_items} completed
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span className="capitalize">{task.status}</span>
                  </div>
                </div>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href={`/annotations/tasks/${task.id}`}>View task</Link>
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}