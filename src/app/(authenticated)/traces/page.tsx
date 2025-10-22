"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { Search, Activity, Clock, Tag, X, Code, Sparkles, Copy, Check } from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

// Integration examples
const INTEGRATION_EXAMPLES = {
  openai: {
    name: "OpenAI",
    code: `import OpenAI from "openai"
import { trace, span } from "@/lib/tracing"

const openai = new OpenAI()

export async function generateResponse(prompt: string) {
  return trace("chat-completion", { 
    tags: ["openai", "gpt-4"] 
  }, async () => {
    const response = await span("openai-call", async () => {
      return await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }]
      })
    })
    
    return response.choices[0].message.content
  })
}`
  },
  langchain: {
    name: "LangChain",
    code: `import { ChatOpenAI } from "langchain/chat_models/openai"
import { trace, span } from "@/lib/tracing"

export async function ragQuery(query: string) {
  return trace("rag-pipeline", { 
    tags: ["langchain", "rag"] 
  }, async () => {
    // Retrieve context
    const context = await span("retrieve-docs", async () => {
      return await vectorStore.similaritySearch(query, 3)
    })
    
    // Generate response
    const response = await span("llm-generation", async () => {
      const llm = new ChatOpenAI({ model: "gpt-4" })
      return await llm.call([
        { role: "system", content: context },
        { role: "user", content: query }
      ])
    })
    
    return response
  })
}`
  },
  custom: {
    name: "Custom API",
    code: `import { trace, span } from "@/lib/tracing"

export async function customWorkflow(input: string) {
  return trace("custom-workflow", {
    tags: ["production", "critical"],
    metadata: { userId: "user123" }
  }, async () => {
    // Step 1: Preprocess
    const processed = await span("preprocess", async () => {
      return input.toLowerCase().trim()
    })
    
    // Step 2: Call API
    const result = await span("api-call", async () => {
      return await fetch("/api/ml-model", {
        method: "POST",
        body: JSON.stringify({ input: processed })
      }).then(r => r.json())
    })
    
    // Step 3: Postprocess
    return span("postprocess", () => {
      return result.data.map(formatOutput)
    })
  })
}`
  }
}

export default function TracesPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [traces, setTraces] = useState<any[]>([])
  const [filteredTraces, setFilteredTraces] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showIntegrationGuide, setShowIntegrationGuide] = useState(false)
  const [copiedExample, setCopiedExample] = useState<string | null>(null)

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/auth/login")
      return
    }

    if (session?.user) {
      // Add pagination limit
      fetch("/api/traces?limit=20&offset=0", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("bearer_token")}`
        }
      })
        .then(res => res.json())
        .then(data => {
          setTraces(data.traces || [])
          setFilteredTraces(data.traces || [])
          setIsLoading(false)
        })
        .catch(() => {
          setIsLoading(false)
        })
    }
  }, [session, isPending, router])

  // Get all unique tags from traces
  const allTags = Array.from(
    new Set(traces.flatMap((trace: any) => trace.tags || []))
  )

  // Filter traces based on search and tags
  useEffect(() => {
    let filtered = traces

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((trace: any) =>
        trace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trace.session_id?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter((trace: any) =>
        selectedTags.every((tag) => trace.tags?.includes(tag))
      )
    }

    setFilteredTraces(filtered)
  }, [searchQuery, selectedTags, traces])

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const copyToClipboard = (code: string, exampleName: string) => {
    navigator.clipboard.writeText(code)
    setCopiedExample(exampleName)
    toast.success("Code copied to clipboard!")
    setTimeout(() => setCopiedExample(null), 2000)
  }

  if (isPending || !session?.user) {
    return null
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Traces</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Monitor and debug your LLM calls</p>
        </div>
        <Dialog open={showIntegrationGuide} onOpenChange={setShowIntegrationGuide}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Code className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Integration Guide</span>
              <span className="sm:hidden">Guide</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Quick Start: Integrate Tracing
              </DialogTitle>
              <DialogDescription>
                Add tracing to your application in minutes with these examples
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="openai" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="openai">OpenAI</TabsTrigger>
                <TabsTrigger value="langchain">LangChain</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>

              {Object.entries(INTEGRATION_EXAMPLES).map(([key, example]) => (
                <TabsContent key={key} value={key} className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{example.name} Integration</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(example.code, key)}
                        >
                          {copiedExample === key ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <pre className="rounded-lg bg-muted p-4 overflow-x-auto">
                        <code className="text-xs font-mono">{example.code}</code>
                      </pre>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/50 bg-primary/5">
                    <CardHeader>
                      <CardTitle className="text-sm">Best Practices</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="rounded-full bg-primary/20 p-1 mt-0.5 flex-shrink-0">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <p><strong>Use descriptive names:</strong> "chat-completion" instead of "call1"</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="rounded-full bg-primary/20 p-1 mt-0.5 flex-shrink-0">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <p><strong>Add relevant tags:</strong> Environment, model, feature area</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="rounded-full bg-primary/20 p-1 mt-0.5 flex-shrink-0">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <p><strong>Track important metadata:</strong> User ID, session, input length</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="rounded-full bg-primary/20 p-1 mt-0.5 flex-shrink-0">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <p><strong>Use spans for sub-operations:</strong> Break complex flows into steps</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <p>Need more help?</p>
              <Button variant="link" size="sm" asChild className="h-auto p-0">
                <Link href="/guides/tracing-setup">View full documentation</Link>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      {!isLoading && traces.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search traces by name or session..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm text-muted-foreground">Filter by tags:</span>
              {allTags.map((tag) => (
                <Button
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleTag(tag)}
                  className="h-7 text-xs"
                >
                  <Tag className="mr-1 h-3 w-3" />
                  {tag}
                  {selectedTags.includes(tag) && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Button>
              ))}
              {selectedTags.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTags([])}
                  className="h-7 text-xs"
                >
                  Clear all
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Traces List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-5 w-32 sm:w-48" />
                      <Skeleton className="h-4 w-20 sm:w-32" />
                    </div>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-4 w-32 sm:w-40" />
                      <Skeleton className="h-5 w-16 sm:w-20" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTraces.length > 0 ? (
        <div className="space-y-3">
          {filteredTraces.map((trace: any) => (
            <Link key={trace.id} href={`/traces/${trace.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                        <Activity className="h-4 w-4 text-primary flex-shrink-0" />
                        <h3 className="font-semibold text-sm sm:text-base truncate">{trace.name}</h3>
                        {trace.session_id && (
                          <span className="text-xs text-muted-foreground font-mono truncate">
                            Session: {trace.session_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span className="hidden sm:inline">{new Date(trace.created_at).toLocaleString()}</span>
                          <span className="sm:hidden">{new Date(trace.created_at).toLocaleDateString()}</span>
                        </div>
                        {trace.tags && trace.tags.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <Tag className="h-3 w-3" />
                            {trace.tags.slice(0, 3).map((tag: string) => (
                              <span
                                key={tag}
                                className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : traces.length > 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 sm:py-12 px-4">
            <Search className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-sm sm:text-base font-semibold mb-1">No results found</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4 text-center">
              Try adjusting your search or tag filters
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("")
                setSelectedTags([])
              }}
            >
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
            <div className="rounded-full bg-primary/10 p-3 sm:p-4 mb-4">
              <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold mb-2">No traces yet</h3>
            <p className="text-xs sm:text-sm text-muted-foreground text-center mb-4 sm:mb-6 max-w-sm">
              Start capturing traces from your LLM applications to monitor performance, debug issues, and analyze behavior.
            </p>
            <Button onClick={() => setShowIntegrationGuide(true)} className="mb-4">
              <Code className="mr-2 h-4 w-4" />
              View Integration Guide
            </Button>
            <div className="text-xs sm:text-sm text-muted-foreground bg-muted px-3 sm:px-4 py-2 sm:py-3 rounded-lg w-full max-w-md">
              <p className="font-medium mb-1">Quick Start:</p>
              <p>Add our tracing SDK to automatically capture LLM calls, track performance, and debug issues in real-time.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}