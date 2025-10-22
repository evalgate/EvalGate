"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Footer } from "@/components/footer"
import { useSession } from "@/lib/auth-client"

import Link from "next/link"
import { Code, FileText, Zap } from "lucide-react"

const apiSections = [
  {
    title: "Evaluations API",
    description: "Create, run, and manage evaluations programmatically",
    endpoints: [
      { method: "GET", path: "/api/evaluations", description: "List all evaluations" },
      { method: "POST", path: "/api/evaluations", description: "Create new evaluation" },
      { method: "GET", path: "/api/evaluations/{id}", description: "Get evaluation details" },
      { method: "POST", path: "/api/evaluations/{id}/runs", description: "Start evaluation run" }
    ]
  },
  {
    title: "Traces API",
    description: "Send trace data from your LLM applications",
    endpoints: [
      { method: "GET", path: "/api/traces", description: "List traces" },
      { method: "POST", path: "/api/traces", description: "Create trace" },
      { method: "GET", path: "/api/traces/{id}", description: "Get trace details" },
      { method: "POST", path: "/api/traces/{id}/spans", description: "Add span to trace" }
    ]
  },
  {
    title: "LLM Judge API",
    description: "Configure and run LLM-based evaluations",
    endpoints: [
      { method: "GET", path: "/api/llm-judge/configs", description: "List judge configs" },
      { method: "POST", path: "/api/llm-judge/evaluate", description: "Evaluate output" },
      { method: "GET", path: "/api/llm-judge/results", description: "Get evaluation results" },
      { method: "POST", path: "/api/llm-judge/alignment", description: "Check judge alignment" }
    ]
  },
  {
    title: "Annotations API",
    description: "Create and manage human annotation tasks",
    endpoints: [
      { method: "GET", path: "/api/annotations/tasks", description: "List annotation tasks" },
      { method: "POST", path: "/api/annotations/tasks", description: "Create annotation task" },
      { method: "GET", path: "/api/annotations/tasks/{id}", description: "Get task details" },
      { method: "POST", path: "/api/annotations/tasks/{id}/items", description: "Submit annotation" }
    ]
  }
]

const methodColors: Record<string, string> = {
  GET: "bg-green-500/10 text-green-500",
  POST: "bg-blue-500/10 text-blue-500",
  PUT: "bg-yellow-500/10 text-yellow-500",
  DELETE: "bg-red-500/10 text-red-500"
}

export default function APIReferencePage() {
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/">
              <h1 className="text-base sm:text-xl font-bold truncate">AI Evaluation Platform</h1>
            </Link>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <ThemeToggle />
              {session?.user ? (
                <Button asChild size="sm" className="h-9">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild size="sm" className="h-9 hidden sm:flex">
                    <Link href="/auth/login">Sign in</Link>
                  </Button>
                  <Button asChild size="sm" className="h-9">
                    <Link href="/auth/sign-up">Get started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
          <div className="mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4">API Reference</h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mb-6">
              Complete REST API documentation for programmatic access to the platform
            </p>

            {/* Quick Links */}
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <Button variant="outline" asChild size="sm">
                <a href="#authentication">
                  <Code className="mr-2 h-4 w-4" />
                  Authentication
                </a>
              </Button>
              <Button variant="outline" asChild size="sm">
                <a href="#rate-limits">
                  <Zap className="mr-2 h-4 w-4" />
                  Rate Limits
                </a>
              </Button>
              <Button variant="outline" asChild size="sm">
                <a href="#errors">
                  <FileText className="mr-2 h-4 w-4" />
                  Error Codes
                </a>
              </Button>
            </div>
          </div>

          {/* Authentication Section */}
          <section id="authentication" className="mb-8 sm:mb-12">
            <Card className="p-5 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Authentication</h2>
              <p className="text-sm sm:text-base text-muted-foreground mb-4">
                All API requests require authentication using a bearer token:
              </p>
              <div className="bg-muted p-4 rounded-lg font-mono text-xs sm:text-sm overflow-x-auto">
                <code>
                  curl https://api.example.com/api/evaluations \<br />
                  &nbsp;&nbsp;-H "Authorization: Bearer YOUR_API_KEY"
                </code>
              </div>
            </Card>
          </section>

          {/* API Endpoints */}
          <div className="space-y-8 sm:space-y-12">
            {apiSections.map((section) => (
              <section key={section.title}>
                <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">{section.title}</h2>
                <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">{section.description}</p>
                
                <div className="space-y-3 sm:space-y-4">
                  {section.endpoints.map((endpoint, index) => (
                    <Card key={index} className="p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        <span className={`text-xs px-2 py-1 rounded font-mono self-start ${methodColors[endpoint.method]}`}>
                          {endpoint.method}
                        </span>
                        <code className="text-sm sm:text-base font-mono flex-1 break-all">{endpoint.path}</code>
                      </div>
                      <p className="mt-2 sm:mt-3 text-sm sm:text-base text-muted-foreground">{endpoint.description}</p>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Rate Limits Section */}
          <section id="rate-limits" className="mt-8 sm:mt-12">
            <Card className="p-5 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Rate Limits</h2>
              <div className="space-y-2 text-sm sm:text-base text-muted-foreground">
                <p>• Free tier: 100 requests per hour</p>
                <p>• Pro tier: 1,000 requests per hour</p>
                <p>• Enterprise: Custom limits</p>
              </div>
            </Card>
          </section>

          {/* Errors Section */}
          <section id="errors" className="mt-8 sm:mt-12">
            <Card className="p-5 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Error Codes</h2>
              <div className="space-y-2 text-sm sm:text-base text-muted-foreground">
                <p>• <code className="font-mono bg-muted px-2 py-1 rounded">400</code> Bad Request - Invalid parameters</p>
                <p>• <code className="font-mono bg-muted px-2 py-1 rounded">401</code> Unauthorized - Invalid API key</p>
                <p>• <code className="font-mono bg-muted px-2 py-1 rounded">429</code> Too Many Requests - Rate limit exceeded</p>
                <p>• <code className="font-mono bg-muted px-2 py-1 rounded">500</code> Internal Server Error - Contact support</p>
              </div>
            </Card>
          </section>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}