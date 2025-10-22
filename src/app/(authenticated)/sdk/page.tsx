"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Copy, Check, Terminal, Sparkles, Zap, Shield } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import { useSession } from "@/lib/auth-client"

export default function SDKPage() {
  const { data: session } = useSession()
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const installCode = "npm install @evalai/sdk"
  
  const quickStartCode = `import { AIEvalClient } from '@evalai/sdk'

// Auto-loads from environment variables
const client = AIEvalClient.init()

// Or with explicit configuration
const client = new AIEvalClient({
  apiKey: process.env.EVALAI_API_KEY,
  organizationId: parseInt(process.env.EVALAI_ORGANIZATION_ID!)
})

// Create a trace
const trace = await client.traces.create({
  name: 'User Query',
  traceId: 'trace-' + Date.now(),
  metadata: { userId: 'user-123' }
})`

  const frameworkCode = `import { traceOpenAI } from '@evalai/sdk/integrations/openai'
import OpenAI from 'openai'

// Wrap OpenAI client for automatic tracing
const openai = traceOpenAI(new OpenAI(), client)

// All OpenAI calls are now automatically traced
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
})`

  const envCode = `# .env file in your project root
EVALAI_API_KEY=sk_test_your_api_key_here
EVALAI_ORGANIZATION_ID=your_org_id_here`

  const testSuiteCode = `import { createTestSuite } from '@evalai/sdk'

const suite = createTestSuite({
  name: 'Chatbot Evaluation',
  tests: [
    {
      name: 'Return Policy Question',
      input: 'What is your return policy?',
      expectedOutput: '30-day money-back guarantee'
    }
  ]
})

await suite.run(client)`

  return (
    <div className="space-y-6 sm:space-y-8 w-full">
      {/* Hero Section */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-blue-500/10 rounded-full">
          <Sparkles className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-blue-500">TypeScript SDK</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          Evaluate AI with <span className="text-blue-500">confidence</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-6">
          Production-ready SDK for tracing, testing, and monitoring your LLM applications.
          Built for developers who ship fast.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" asChild>
            <Link href="/developer">Get API Key</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/api-reference">View API docs</Link>
          </Button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="p-6">
          <Terminal className="h-12 w-12 text-blue-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Zero Config</h3>
          <p className="text-muted-foreground">
            Auto-detects environment variables. Works out of the box with sensible defaults.
          </p>
        </Card>

        <Card className="p-6">
          <Zap className="h-12 w-12 text-emerald-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Framework Integration</h3>
          <p className="text-muted-foreground">
            Drop-in wrappers for OpenAI, Anthropic, and LangChain. Automatic tracing enabled.
          </p>
        </Card>

        <Card className="p-6">
          <Shield className="h-12 w-12 text-purple-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Type Safe</h3>
          <p className="text-muted-foreground">
            Full TypeScript support with generics. Catch errors before runtime.
          </p>
        </Card>
      </div>

      {/* Installation */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">1. Installation</h2>
        <div className="bg-muted/50 rounded-lg p-4 relative group">
          <pre className="font-mono text-sm overflow-x-auto">
            <code>{installCode}</code>
          </pre>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => copyCode(installCode, "install")}
          >
            {copiedCode === "install" ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </Card>

      {/* Environment Setup */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">2. Configure Environment</h2>
        <p className="text-muted-foreground mb-4">
          Create a <code className="bg-muted px-2 py-1 rounded">.env</code> file in your project root:
        </p>
        <div className="bg-muted/50 rounded-lg p-4 relative group">
          <pre className="font-mono text-sm overflow-x-auto">
            <code>{envCode}</code>
          </pre>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => copyCode(envCode, "env")}
          >
            {copiedCode === "env" ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            <strong>Get your API key:</strong> Go to <Link href="/developer" className="underline">Developer Dashboard</Link> → Scroll to API Keys → Create API Key
          </p>
        </div>
      </Card>

      {/* Quick Start */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">3. Initialize Client</h2>
        <div className="bg-muted/50 rounded-lg p-4 relative group">
          <pre className="font-mono text-sm overflow-x-auto">
            <code>{quickStartCode}</code>
          </pre>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => copyCode(quickStartCode, "quickstart")}
          >
            {copiedCode === "quickstart" ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </Card>

      {/* Framework Integration */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Framework Integration</h2>
        <p className="text-muted-foreground mb-4">
          Automatically trace all LLM calls with zero-config wrappers:
        </p>
        <div className="bg-muted/50 rounded-lg p-4 relative group">
          <pre className="font-mono text-sm overflow-x-auto">
            <code>{frameworkCode}</code>
          </pre>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => copyCode(frameworkCode, "framework")}
          >
            {copiedCode === "framework" ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </Card>

      {/* Test Suite */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Test Suite Builder</h2>
        <p className="text-muted-foreground mb-4">
          Create comprehensive test suites with built-in assertions:
        </p>
        <div className="bg-muted/50 rounded-lg p-4 relative group">
          <pre className="font-mono text-sm overflow-x-auto">
            <code>{testSuiteCode}</code>
          </pre>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => copyCode(testSuiteCode, "testsuite")}
          >
            {copiedCode === "testsuite" ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </Card>

      {/* CTA */}
      <div className="text-center py-12 border-t">
        <h2 className="text-2xl font-bold mb-4">Ready to start evaluating?</h2>
        <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
          Join developers who ship AI products with confidence
        </p>
        <Button size="lg" asChild>
          <Link href="/developer">Get Your API Key</Link>
        </Button>
      </div>
    </div>
  )
}
