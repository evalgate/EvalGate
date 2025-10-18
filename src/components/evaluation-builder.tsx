"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  TEMPLATE_CATEGORIES, 
  COMPREHENSIVE_TEMPLATES, 
  getTemplatesByCategory,
  type EvaluationTemplate 
} from "@/lib/evaluation-templates"
import { 
  GripVertical, 
  Plus, 
  Trash2, 
  Search, 
  Sparkles, 
  Settings,
  Rocket,
  X,
  ChevronRight,
  Code,
  Info,
  AlertCircle,
  CheckCircle2,
  FileCode2,
  MessageSquareText,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectedTemplate {
  id: string
  template: EvaluationTemplate
  config: {
    name?: string
    description?: string
    customPrompt?: string
    customTestCases?: Array<{
      input: string
      expectedOutput: string
      rubric: string
    }>
    customCriteria?: Array<{
      name: string
      description: string
      scale: string
    }>
    thresholds?: {
      passingScore?: number
      warningThreshold?: number
    }
  }
}

interface EvaluationBuilderProps {
  onDeploy: (data: {
    name: string
    description: string
    type: string
    templates: SelectedTemplate[]
  }) => void
}

export function EvaluationBuilder({ onDeploy }: EvaluationBuilderProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("unit_tests")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTemplates, setSelectedTemplates] = useState<SelectedTemplate[]>([])
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("overview")
  const [evaluationName, setEvaluationName] = useState("")
  const [evaluationDescription, setEvaluationDescription] = useState("")
  const [draggedTemplate, setDraggedTemplate] = useState<EvaluationTemplate | null>(null)

  const filteredTemplates = getTemplatesByCategory(selectedCategory).filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAddTemplate = (template: EvaluationTemplate) => {
    const newTemplate: SelectedTemplate = {
      id: `${template.id}-${Date.now()}`,
      template,
      config: {}
    }
    setSelectedTemplates([...selectedTemplates, newTemplate])
    setActiveTemplate(newTemplate.id)
  }

  const handleRemoveTemplate = (id: string) => {
    setSelectedTemplates(selectedTemplates.filter(t => t.id !== id))
    if (activeTemplate === id) {
      setActiveTemplate(null)
    }
  }

  const handleUpdateTemplateConfig = (id: string, config: Partial<SelectedTemplate['config']>) => {
    setSelectedTemplates(selectedTemplates.map(t => 
      t.id === id ? { ...t, config: { ...t.config, ...config } } : t
    ))
  }

  const handleOpenSettings = (id: string) => {
    console.log('Opening settings for template:', id, 'Active templates:', selectedTemplates.map(t => t.id))
    setActiveTemplate(id)
    setActiveTab("overview")
  }

  const handleDeploy = () => {
    if (!evaluationName || selectedTemplates.length === 0) {
      return
    }

    // Determine evaluation type based on templates
    const types = selectedTemplates.map(t => t.template.type)
    const primaryType = types[0] // Use first template's type as primary

    onDeploy({
      name: evaluationName,
      description: evaluationDescription,
      type: primaryType,
      templates: selectedTemplates
    })
  }

  const activeTemplateData = selectedTemplates.find(t => t.id === activeTemplate)

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Left Panel - Template Library */}
      <Card className="w-80 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Template Library
          </CardTitle>
          <CardDescription className="text-xs">
            Drag templates to the canvas or click to add
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3 p-4 pt-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>

          {/* Categories */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-2 h-auto gap-1 p-1">
              {TEMPLATE_CATEGORIES.slice(0, 4).map(cat => (
                <TabsTrigger key={cat.id} value={cat.id} className="text-xs py-1.5">
                  {cat.name}
                </TabsTrigger>
              ))}
            </TabsList>

            <ScrollArea className="flex-1 mt-3">
              <div className="space-y-2 pr-4">
                {filteredTemplates.map(template => {
                  const Icon = template.icon
                  return (
                    <Card
                      key={template.id}
                      className="cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
                      draggable
                      onDragStart={() => setDraggedTemplate(template)}
                      onDragEnd={() => setDraggedTemplate(null)}
                      onClick={() => handleAddTemplate(template)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <div className="rounded-md bg-primary/10 p-1.5 flex-shrink-0">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium text-xs leading-tight">{template.name}</h4>
                              <Plus className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {template.description}
                            </p>
                            <div className="flex items-center gap-1 mt-2">
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                {template.complexity}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>

      {/* Center Panel - Canvas */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Evaluation Canvas</CardTitle>
              <CardDescription className="text-xs">
                {selectedTemplates.length} template{selectedTemplates.length !== 1 ? 's' : ''} selected
              </CardDescription>
            </div>
            <Button
              onClick={handleDeploy}
              disabled={!evaluationName || selectedTemplates.length === 0}
              size="sm"
              className="gap-2"
            >
              <Rocket className="h-3.5 w-3.5" />
              Deploy Evaluation
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-4 pt-0">
          {/* Evaluation Name & Description */}
          <div className="space-y-3 mb-4">
            <div className="space-y-1.5">
              <Label htmlFor="eval-name" className="text-xs">Evaluation Name *</Label>
              <Input
                id="eval-name"
                placeholder="e.g., Production Chatbot Safety Evaluation"
                value={evaluationName}
                onChange={(e) => setEvaluationName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eval-desc" className="text-xs">Description (optional)</Label>
              <Textarea
                id="eval-desc"
                placeholder="Describe what this evaluation tests..."
                value={evaluationDescription}
                onChange={(e) => setEvaluationDescription(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
          </div>

          {/* Canvas Area */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-4 min-h-[400px]",
              draggedTemplate ? "border-primary bg-primary/5" : "border-muted",
              selectedTemplates.length === 0 && "flex items-center justify-center"
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (draggedTemplate) {
                handleAddTemplate(draggedTemplate)
                setDraggedTemplate(null)
              }
            }}
          >
            {selectedTemplates.length === 0 ? (
              <div className="text-center max-w-sm">
                <div className="rounded-full bg-muted w-16 h-16 flex items-center justify-center mx-auto mb-3">
                  <GripVertical className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">No templates added yet</h3>
                <p className="text-sm text-muted-foreground">
                  Drag templates from the library or click to add them to your evaluation
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedTemplates.map((selected, index) => {
                  const Icon = selected.template.icon
                  const isActive = activeTemplate === selected.id
                  return (
                    <Card
                      key={selected.id}
                      className={cn(
                        "cursor-pointer transition-all",
                        isActive && "ring-2 ring-primary border-primary"
                      )}
                      onClick={() => setActiveTemplate(selected.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                            <div className="rounded-md bg-primary/10 p-2">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-sm">
                                    {selected.config.name || selected.template.name}
                                  </h4>
                                  <Badge variant="secondary" className="text-xs">
                                    {selected.template.type.replace('_', ' ')}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {selected.config.description || selected.template.description}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenSettings(selected.id)
                                  }}
                                  className="h-7 w-7 p-0"
                                >
                                  <Settings className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemoveTemplate(selected.id)
                                  }}
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Dialog - Full Screen */}
      <Dialog open={!!activeTemplateData} onOpenChange={(open) => !open && setActiveTemplate(null)}>
        <DialogContent className="max-w-5xl h-[95vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configure Template
            </DialogTitle>
          </DialogHeader>
          
          {activeTemplateData && (
            <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
              {/* Template Info Header */}
              <Card className="border-primary/20 bg-primary/5 mt-4 mb-4 flex-shrink-0">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {(() => {
                      const Icon = activeTemplateData.template.icon
                      return <Icon className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
                    })()}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-base leading-tight">{activeTemplateData.template.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {activeTemplateData.template.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {activeTemplateData.template.type.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {activeTemplateData.template.complexity}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-3 mb-4 flex-shrink-0">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="criteria">Criteria</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="flex-1 min-h-0 mt-0">
                  <ScrollArea className="h-full">
                    <div className="space-y-4 pr-4 pb-4">
                      {/* How This Evaluation Works */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-1.5">
                          <Zap className="h-4 w-4 text-primary" />
                          How This Evaluation Works
                        </Label>
                        <Card className="bg-muted/30">
                          <CardContent className="p-3 space-y-3">
                            {/* Test Cases Summary */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                <span className="text-xs font-medium">Test Cases ({activeTemplateData.template.testCases.length})</span>
                              </div>
                              {activeTemplateData.template.testCases.map((testCase, i) => (
                                <Card key={i} className="border-l-2 border-l-primary/50">
                                  <CardContent className="p-2 space-y-1.5">
                                    <div className="flex items-start gap-1.5">
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-0.5 flex-shrink-0">
                                        Test {i + 1}
                                      </Badge>
                                      <p className="text-xs font-medium flex-1">{testCase.rubric}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[11px] text-muted-foreground">
                                        <span className="font-medium">Input:</span> {testCase.input}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground">
                                        <span className="font-medium">Expected:</span> {testCase.expectedOutput}
                                      </p>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>

                            {/* Human Eval Criteria */}
                            {activeTemplateData.template.humanEvalCriteria && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <MessageSquareText className="h-3.5 w-3.5 text-blue-600" />
                                  <span className="text-xs font-medium">Human Evaluation Criteria</span>
                                </div>
                                {activeTemplateData.template.humanEvalCriteria.map((criteria, i) => (
                                  <Card key={i} className="border-l-2 border-l-blue-500/50">
                                    <CardContent className="p-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium">{criteria.name}</p>
                                          <p className="text-[11px] text-muted-foreground">{criteria.description}</p>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                                          {criteria.scale}
                                        </Badge>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Criteria Tab - Shows detailed evaluation logic */}
                <TabsContent value="criteria" className="flex-1 min-h-0 mt-0">
                  <ScrollArea className="h-full">
                    <div className="space-y-4 pr-4 pb-4">
                      {/* Unit Test Code - Shows exact validation logic */}
                      {activeTemplateData.template.code && (
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold flex items-center gap-1.5">
                            <FileCode2 className="h-4 w-4 text-purple-600" />
                            Validation Code
                          </Label>
                          <Card className="bg-slate-950 border-slate-800">
                            <CardContent className="p-4">
                              <pre className="text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap break-words">
{activeTemplateData.template.code}
                              </pre>
                            </CardContent>
                          </Card>
                          
                          {/* Explain what patterns are checked */}
                          {activeTemplateData.template.id === 'unit-content-safety' && (
                            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
                              <CardContent className="p-3 space-y-2">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="text-xs font-semibold text-orange-900 dark:text-orange-100">
                                      PII Detection Patterns
                                    </p>
                                    <ul className="text-xs text-orange-800 dark:text-orange-200 mt-1.5 space-y-1 list-disc list-inside">
                                      <li><span className="font-medium">SSN:</span> Format XXX-XX-XXXX</li>
                                      <li><span className="font-medium">Credit Cards:</span> 16-digit card numbers with or without separators</li>
                                      <li><span className="font-medium">Email Addresses:</span> Standard email format validation</li>
                                    </ul>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {activeTemplateData.template.id === 'unit-business-rules' && (
                            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
                              <CardContent className="p-3 space-y-2">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="text-xs font-semibold text-orange-900 dark:text-orange-100">
                                      Forbidden Phrases
                                    </p>
                                    <ul className="text-xs text-orange-800 dark:text-orange-200 mt-1.5 space-y-1 list-disc list-inside">
                                      <li>"guaranteed returns"</li>
                                      <li>"risk-free investment"</li>
                                      <li>"get rich quick"</li>
                                      <li>"can't lose"</li>
                                    </ul>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}

                      {/* Judge Prompt - Shows LLM evaluation criteria */}
                      {activeTemplateData.template.judgePrompt && (
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold flex items-center gap-1.5">
                            <MessageSquareText className="h-4 w-4 text-blue-600" />
                            LLM Judge Prompt
                          </Label>
                          <Card className="bg-slate-950 border-slate-800">
                            <CardContent className="p-4">
                              <pre className="text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap break-words">
{activeTemplateData.template.judgePrompt}
                              </pre>
                            </CardContent>
                          </Card>

                          {/* Extract and highlight key criteria */}
                          {(activeTemplateData.template.id === 'judge-safety') && (
                            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
                              <CardContent className="p-3 space-y-2">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="text-xs font-semibold text-red-900 dark:text-red-100">
                                      Safety Checks
                                    </p>
                                    <ul className="text-xs text-red-800 dark:text-red-200 mt-1.5 space-y-1 list-disc list-inside">
                                      <li>Potential harm (physical, psychological, financial)</li>
                                      <li>Bias or discrimination</li>
                                      <li>Inappropriate content</li>
                                      <li>Privacy violations</li>
                                      <li>Dangerous advice or misinformation</li>
                                    </ul>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}

                      {/* Human Criteria - Detailed view */}
                      {activeTemplateData.template.humanEvalCriteria && (
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold flex items-center gap-1.5">
                            <MessageSquareText className="h-4 w-4 text-blue-600" />
                            Evaluation Criteria
                          </Label>
                          <div className="space-y-2">
                            {activeTemplateData.template.humanEvalCriteria.map((criteria, i) => (
                              <Card key={i} className="border-l-4 border-l-blue-500">
                                <CardContent className="p-3 space-y-1.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <h5 className="text-sm font-semibold">{criteria.name}</h5>
                                    <Badge className="text-[10px] px-2 py-0.5 flex-shrink-0">{criteria.scale}</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{criteria.description}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Settings Tab - Custom configuration */}
                <TabsContent value="settings" className="flex-1 min-h-0 mt-0">
                  <ScrollArea className="h-full">
                    <div className="space-y-6 pr-4 pb-4">
                      {/* Custom Name */}
                      <div className="space-y-1.5">
                        <Label htmlFor="template-name" className="text-xs">Custom Name (optional)</Label>
                        <Input
                          id="template-name"
                          placeholder={activeTemplateData.template.name}
                          value={activeTemplateData.config.name || ""}
                          onChange={(e) => handleUpdateTemplateConfig(activeTemplateData.id, { name: e.target.value })}
                          className="h-9"
                        />
                      </div>

                      {/* Custom Description */}
                      <div className="space-y-1.5">
                        <Label htmlFor="template-desc" className="text-xs">Custom Description (optional)</Label>
                        <Textarea
                          id="template-desc"
                          placeholder={activeTemplateData.template.description}
                          value={activeTemplateData.config.description || ""}
                          onChange={(e) => handleUpdateTemplateConfig(activeTemplateData.id, { description: e.target.value })}
                          rows={3}
                          className="text-sm"
                        />
                      </div>

                      {/* Evaluation Thresholds */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold flex items-center gap-1.5">
                          <Zap className="h-4 w-4 text-primary" />
                          Scoring Thresholds
                        </Label>
                        <Card>
                          <CardContent className="p-4 space-y-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="passing-score" className="text-xs">Passing Score (%)</Label>
                              <Input
                                id="passing-score"
                                type="number"
                                min="0"
                                max="100"
                                placeholder="80"
                                value={activeTemplateData.config.thresholds?.passingScore || ""}
                                onChange={(e) => handleUpdateTemplateConfig(activeTemplateData.id, { 
                                  thresholds: { 
                                    ...activeTemplateData.config.thresholds,
                                    passingScore: parseInt(e.target.value) || undefined 
                                  } 
                                })}
                                className="h-9"
                              />
                              <p className="text-[11px] text-muted-foreground">
                                Minimum score required to pass this evaluation
                              </p>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="warning-threshold" className="text-xs">Warning Threshold (%)</Label>
                              <Input
                                id="warning-threshold"
                                type="number"
                                min="0"
                                max="100"
                                placeholder="90"
                                value={activeTemplateData.config.thresholds?.warningThreshold || ""}
                                onChange={(e) => handleUpdateTemplateConfig(activeTemplateData.id, { 
                                  thresholds: { 
                                    ...activeTemplateData.config.thresholds,
                                    warningThreshold: parseInt(e.target.value) || undefined 
                                  } 
                                })}
                                className="h-9"
                              />
                              <p className="text-[11px] text-muted-foreground">
                                Score below this triggers a warning flag
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Custom Test Cases */}
                      {activeTemplateData.template.testCases && activeTemplateData.template.testCases.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              Custom Test Cases
                            </Label>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const currentCases = activeTemplateData.config.customTestCases || activeTemplateData.template.testCases
                                handleUpdateTemplateConfig(activeTemplateData.id, {
                                  customTestCases: [
                                    ...currentCases,
                                    { input: "", expectedOutput: "", rubric: "" }
                                  ]
                                })
                              }}
                              className="h-7 gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              Add Test
                            </Button>
                          </div>
                          <div className="space-y-3">
                            {(activeTemplateData.config.customTestCases || activeTemplateData.template.testCases).map((testCase, i) => (
                              <Card key={i} className="border-l-2 border-l-primary/50">
                                <CardContent className="p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      Test {i + 1}
                                    </Badge>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        const currentCases = activeTemplateData.config.customTestCases || activeTemplateData.template.testCases
                                        handleUpdateTemplateConfig(activeTemplateData.id, {
                                          customTestCases: currentCases.filter((_, idx) => idx !== i)
                                        })
                                      }}
                                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Rubric/Criteria</Label>
                                      <Input
                                        placeholder="What should this test validate?"
                                        value={testCase.rubric}
                                        onChange={(e) => {
                                          const currentCases = activeTemplateData.config.customTestCases || [...activeTemplateData.template.testCases]
                                          currentCases[i] = { ...currentCases[i], rubric: e.target.value }
                                          handleUpdateTemplateConfig(activeTemplateData.id, { customTestCases: currentCases })
                                        }}
                                        className="h-8 text-xs"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Test Input</Label>
                                      <Textarea
                                        placeholder="Input to test..."
                                        value={testCase.input}
                                        onChange={(e) => {
                                          const currentCases = activeTemplateData.config.customTestCases || [...activeTemplateData.template.testCases]
                                          currentCases[i] = { ...currentCases[i], input: e.target.value }
                                          handleUpdateTemplateConfig(activeTemplateData.id, { customTestCases: currentCases })
                                        }}
                                        rows={2}
                                        className="text-xs"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Expected Output</Label>
                                      <Textarea
                                        placeholder="Expected result..."
                                        value={testCase.expectedOutput}
                                        onChange={(e) => {
                                          const currentCases = activeTemplateData.config.customTestCases || [...activeTemplateData.template.testCases]
                                          currentCases[i] = { ...currentCases[i], expectedOutput: e.target.value }
                                          handleUpdateTemplateConfig(activeTemplateData.id, { customTestCases: currentCases })
                                        }}
                                        rows={2}
                                        className="text-xs"
                                      />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Custom Evaluation Criteria */}
                      {activeTemplateData.template.humanEvalCriteria && activeTemplateData.template.humanEvalCriteria.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold flex items-center gap-1.5">
                              <MessageSquareText className="h-4 w-4 text-blue-600" />
                              Evaluation Criteria
                            </Label>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const currentCriteria: Array<{ name: string; description: string; scale: string }> = 
                                  activeTemplateData.config.customCriteria || activeTemplateData.template.humanEvalCriteria || [];
                                handleUpdateTemplateConfig(activeTemplateData.id, {
                                  customCriteria: [
                                    ...currentCriteria,
                                    { name: "", description: "", scale: "1-5" }
                                  ]
                                });
                              }}
                              className="h-7 gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              Add Criteria
                            </Button>
                          </div>
                          <div className="space-y-3">
                            {(activeTemplateData.config.customCriteria || activeTemplateData.template.humanEvalCriteria || []).map((criteria: { name: string; description: string; scale: string }, i: number) => (
                              <Card key={i} className="border-l-2 border-l-blue-500/50">
                                <CardContent className="p-3 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      Criteria {i + 1}
                                    </Badge>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        const currentCriteria: Array<{ name: string; description: string; scale: string }> = 
                                            activeTemplateData.config.customCriteria || activeTemplateData.template.humanEvalCriteria || [];
                                        handleUpdateTemplateConfig(activeTemplateData.id, {
                                          customCriteria: currentCriteria.filter((_, idx) => idx !== i)
                                        });
                                      }}
                                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Criteria Name</Label>
                                      <Input
                                        placeholder="e.g., Tone & Voice"
                                        value={criteria.name}
                                        onChange={(e) => {
                                          const currentCriteria = activeTemplateData.config.customCriteria || 
                                            (activeTemplateData.template.humanEvalCriteria ? [...activeTemplateData.template.humanEvalCriteria] : [])
                                          currentCriteria[i] = { ...currentCriteria[i], name: e.target.value }
                                          handleUpdateTemplateConfig(activeTemplateData.id, { customCriteria: currentCriteria })
                                        }}
                                        className="h-8 text-xs"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Description</Label>
                                      <Textarea
                                        placeholder="What aspect should evaluators assess?"
                                        value={criteria.description}
                                        onChange={(e) => {
                                          const currentCriteria = activeTemplateData.config.customCriteria || 
                                            (activeTemplateData.template.humanEvalCriteria ? [...activeTemplateData.template.humanEvalCriteria] : [])
                                          currentCriteria[i] = { ...currentCriteria[i], description: e.target.value }
                                          handleUpdateTemplateConfig(activeTemplateData.id, { customCriteria: currentCriteria })
                                        }}
                                        rows={2}
                                        className="text-xs"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Rating Scale</Label>
                                      <Input
                                        placeholder="e.g., 1-5, Pass/Fail, Poor/Good/Excellent"
                                        value={criteria.scale}
                                        onChange={(e) => {
                                          const currentCriteria = activeTemplateData.config.customCriteria || 
                                            (activeTemplateData.template.humanEvalCriteria ? [...activeTemplateData.template.humanEvalCriteria] : [])
                                          currentCriteria[i] = { ...currentCriteria[i], scale: e.target.value }
                                          handleUpdateTemplateConfig(activeTemplateData.id, { customCriteria: currentCriteria })
                                        }}
                                        className="h-8 text-xs"
                                      />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Custom Judge Prompt */}
                      {activeTemplateData.template.judgePrompt && (
                        <div className="space-y-1.5">
                          <Label htmlFor="custom-prompt" className="text-sm font-semibold flex items-center gap-1.5">
                            <Code className="h-4 w-4 text-purple-600" />
                            Custom Judge Prompt
                          </Label>
                          <Textarea
                            id="custom-prompt"
                            placeholder="Leave empty to use default prompt, or customize the LLM evaluation instructions..."
                            value={activeTemplateData.config.customPrompt || ""}
                            onChange={(e) => handleUpdateTemplateConfig(activeTemplateData.id, { customPrompt: e.target.value })}
                            rows={12}
                            className="text-xs font-mono"
                          />
                          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            <span>Customize how the LLM judge evaluates responses. Include specific tone preferences, domain knowledge requirements, or style guidelines.</span>
                          </p>
                        </div>
                      )}

                      {/* Reset to Defaults */}
                      <Card className="border-muted-foreground/20">
                        <CardContent className="p-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              handleUpdateTemplateConfig(activeTemplateData.id, {
                                customTestCases: undefined,
                                customCriteria: undefined,
                                customPrompt: undefined,
                                thresholds: undefined
                              })
                            }}
                            className="w-full gap-2"
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            Reset All Customizations to Default
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}