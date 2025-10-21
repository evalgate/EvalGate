import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Footer } from "@/components/footer"
import Link from "next/link"
import { ArrowRight, Copy, CheckCircle2, Terminal, Key, Code2, Rocket } from "lucide-react"

export const dynamic = 'force-static'
export const revalidate = 3600

export default function QuickStartPage() {
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
              <Button variant="ghost" asChild size="sm" className="h-9 hidden sm:flex">
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="h-9">
                <Link href="/auth/sign-up">Get started</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
          {/* Hero */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-4">Quick Start Guide</h1>
            <p className="text-xl text-muted-foreground">
              Get started with the EvalAI SDK in under 5 minutes
            </p>
          </div>

          {/* Prerequisites */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Prerequisites</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Node.js 16.0.0 or higher
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  npm, yarn, or pnpm package manager
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  An EvalAI account (sign up above)
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Step 1: Create API Key */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                1
              </div>
              <h2 className="text-2xl font-bold">Create an API Key</h2>
            </div>
            <Card>
              <CardContent className="pt-6">
                <ol className="space-y-3 text-muted-foreground">
                  <li>1. Navigate to the <Link href="/developer" className="text-primary hover:underline">Developer Dashboard</Link></li>
                  <li>2. Scroll down to the "API Keys" section</li>
                  <li>3. Click "Create API Key"</li>
                  <li>4. Enter a name (e.g., "Development Key")</li>
                  <li>5. Select the scopes you need (start with all for testing)</li>
                  <li>6. Click "Create Key"</li>
                  <li>7. <strong>Copy and save your API key immediately</strong> - you won't see it again!</li>
                </ol>
                <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm text-yellow-600 dark:text-yellow-500">
                    <strong>Important:</strong> Your API key is shown only once. Store it securely!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Step 2: Install SDK */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                2
              </div>
              <h2 className="text-2xl font-bold">Install the SDK</h2>
            </div>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground mb-4">
                  Install the EvalAI SDK in your project using your preferred package manager:
                </p>
                <div className="space-y-3">
                  <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                    <div className="flex items-center justify-between">
                      <span>npm install @evalai/sdk</span>
                      <Button size="sm" variant="ghost">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                    <div className="flex items-center justify-between">
                      <span>yarn add @evalai/sdk</span>
                      <Button size="sm" variant="ghost">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                    <div className="flex items-center justify-between">
                      <span>pnpm add @evalai/sdk</span>
                      <Button size="sm" variant="ghost">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Step 3: Configure Environment */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                3
              </div>
              <h2 className="text-2xl font-bold">Configure Environment Variables</h2>
            </div>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground mb-4">
                  Create a <code className="bg-muted px-2 py-1 rounded">.env</code> file in your project root:
                </p>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm mb-4">
                  <pre>{`EVALAI_API_KEY=sk_test_your_api_key_here
EVALAI_ORGANIZATION_ID=your_org_id_here`}</pre>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p><strong>Where to find these values:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><code className="bg-muted px-1 rounded">EVALAI_API_KEY</code> - From the API key creation dialog</li>
                    <li><code className="bg-muted px-1 rounded">EVALAI_ORGANIZATION_ID</code> - Shown in the API key creation dialog</li>
                  </ul>
                </div>
                <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    <strong>Security Tip:</strong> Add <code className="bg-muted px-1 rounded">.env</code> to your <code className="bg-muted px-1 rounded">.gitignore</code> file to prevent committing secrets!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Step 4: Initialize Client */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                4
              </div>
              <h2 className="text-2xl font-bold">Initialize the Client</h2>
            </div>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground mb-4">
                  Import and initialize the SDK in your code:
                </p>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm mb-4">
                  <pre>{`import { AIEvalClient } from '@evalai/sdk'

// Auto-loads from environment variables
const client = AIEvalClient.init()

// Or with explicit configuration
const client = new AIEvalClient({
  apiKey: process.env.EVALAI_API_KEY,
  organizationId: parseInt(process.env.EVALAI_ORGANIZATION_ID!),
  debug: true // Enable debug logging
})`}</pre>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Step 5: Create Your First Trace */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                5
              </div>
              <h2 className="text-2xl font-bold">Create Your First Trace</h2>
            </div>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground mb-4">
                  Track your first LLM call:
                </p>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                  <pre>{`// Create a trace
const trace = await client.traces.create({
  name: 'Chat Completion',
  traceId: 'trace-' + Date.now(),
  metadata: {
    userId: 'user-123',
    model: 'gpt-4'
  }
})

console.log('Trace created:', trace.id)

// Add a span to track the LLM call
const span = await client.traces.createSpan(trace.id, {
  name: 'OpenAI API Call',
  spanId: 'span-' + Date.now(),
  type: 'llm',
  startTime: new Date().toISOString(),
  input: 'What is AI?',
  output: 'AI is artificial intelligence...',
  metadata: {
    model: 'gpt-4',
    tokens: 150,
    latency: 1200
  }
})

console.log('Span created:', span.id)`}</pre>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Next Steps */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Next Steps
              </CardTitle>
              <CardDescription>
                Now that you're set up, explore these features:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <Link href="/guides/openai-integration" className="block">
                  <Card className="h-full hover:bg-accent transition-colors cursor-pointer">
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-2">OpenAI Integration</h3>
                      <p className="text-sm text-muted-foreground">
                        Automatically trace OpenAI calls
                      </p>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/guides/evaluation-types" className="block">
                  <Card className="h-full hover:bg-accent transition-colors cursor-pointer">
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-2">Create Evaluations</h3>
                      <p className="text-sm text-muted-foreground">
                        Set up automated testing
                      </p>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/guides/llm-judge" className="block">
                  <Card className="h-full hover:bg-accent transition-colors cursor-pointer">
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-2">LLM Judge</h3>
                      <p className="text-sm text-muted-foreground">
                        Use AI to evaluate AI outputs
                      </p>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/api-reference" className="block">
                  <Card className="h-full hover:bg-accent transition-colors cursor-pointer">
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-2">API Reference</h3>
                      <p className="text-sm text-muted-foreground">
                        Complete API documentation
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Help Section */}
          <div className="mt-12 text-center">
            <h3 className="text-xl font-semibold mb-4">Need Help?</h3>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" asChild>
                <Link href="/documentation">
                  View Documentation
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/contact">
                  Contact Support
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}
