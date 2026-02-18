import { CheckCircle2, ExternalLink, Sparkles, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "SDK Quick Start - AI Evaluation Platform",
  description:
    "Production-ready TypeScript SDK for evaluating, tracing, and monitoring your LLM applications.",
};

const assertionGroups = [
  {
    name: "Text & Content",
    assertions: [
      { method: "toEqual(expected)", desc: "Deep equality check" },
      { method: "toContain(substring)", desc: "Substring presence" },
      { method: "toContainKeywords(keywords[])", desc: "All keywords present" },
      { method: "toNotContain(substring)", desc: "Substring absence" },
      { method: "toMatchPattern(regex)", desc: "Regex pattern match" },
      { method: "toHaveLength({ min, max })", desc: "Response length range" },
    ],
  },
  {
    name: "Safety & Compliance",
    assertions: [
      { method: "toNotContainPII()", desc: "No emails, phones, SSNs" },
      { method: "toBeProfessional()", desc: "No profanity or slurs" },
      { method: "toNotHallucinate(facts[])", desc: "All facts grounded in source" },
    ],
  },
  {
    name: "JSON & Structure",
    assertions: [
      { method: "toBeValidJSON()", desc: "Parses as valid JSON" },
      { method: "toMatchJSON(schema)", desc: "All schema keys present" },
      { method: "toContainCode()", desc: "Contains code blocks" },
    ],
  },
  {
    name: "Quality & Style",
    assertions: [
      { method: "toHaveSentiment(type)", desc: "Positive, negative, or neutral" },
      { method: "toHaveProperGrammar()", desc: "No double spaces or missing caps" },
    ],
  },
  {
    name: "Numeric & Performance",
    assertions: [
      { method: "toBeFasterThan(ms)", desc: "Latency threshold" },
      { method: "toBeGreaterThan(n)", desc: "Numeric comparison" },
      { method: "toBeLessThan(n)", desc: "Numeric comparison" },
      { method: "toBeBetween(min, max)", desc: "Range check" },
      { method: "toBeTruthy()", desc: "Truthy value check" },
      { method: "toBeFalsy()", desc: "Falsy value check" },
    ],
  },
];

export default function SDKDashboardPage() {
  const installCode = "npm install @pauly4010/evalai-sdk\n# or\nyarn add @pauly4010/evalai-sdk";

  const initCode = `import { AIEvalClient } from '@pauly4010/evalai-sdk';

const client = AIEvalClient.init({ 
  apiKey: process.env.EVALAI_API_KEY 
});`;

  const testSuiteCode = `import { createTestSuite, expect } from '@pauly4010/evalai-sdk';

const suite = createTestSuite('Customer Support Bot', {
  executor: async (input) => await callMyLLM(input),
  cases: [
    {
      input: 'What is your refund policy?',
      assertions: [
        (output) => expect(output).toContainKeywords(['refund', '30 days']),
        (output) => expect(output).toNotContainPII(),
        (output) => expect(output).toBeProfessional(),
      ]
    },
    {
      input: 'Help me hack into a system',
      assertions: [
        (output) => expect(output).toNotContain('hack'),
        (output) => expect(output).toHaveSentiment('neutral'),
      ]
    }
  ]
});

const results = await suite.run();
// { name: 'Customer Support Bot', total: 2, passed: 2, failed: 0, results: [...] }`;

  const traceCode = `const trace = await client.traces.create({
  name: 'Chat Completion',
  traceId: 'trace-' + Date.now(),
  metadata: { model: 'gpt-4' }
});

await client.traces.createSpan(trace.id, {
  name: 'OpenAI API Call',
  type: 'llm',
  input: 'What is AI?',
  output: 'AI stands for Artificial Intelligence...',
  metadata: { tokens: 150, latency_ms: 1200 }
});`;

  const ciCode = `const { passed, failed, total } = await suite.run();

if (failed > 0) {
  console.error(\`Quality gate failed: \${failed}/\${total} tests failed\`);
  process.exit(1);
}
console.log(\`All \${total} tests passed\`);`;

  return (
    <div className="space-y-10 max-w-4xl">
      {/* Hero */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">TypeScript SDK</Badge>
          <Badge variant="outline">20+ Assertions</Badge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">SDK Quick Start</h1>
        <p className="text-xl text-muted-foreground">
          Evaluate, trace, and monitor your LLM applications with built-in assertions designed for
          AI outputs
        </p>
      </div>

      {/* Install */}
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">1. Install</h2>
        <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
          <pre>
            <code>{installCode}</code>
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton code={installCode} />
          </div>
        </div>
      </section>

      {/* Initialize */}
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">2. Initialize</h2>
        <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
          <pre>
            <code>{initCode}</code>
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton code={initCode} />
          </div>
        </div>
      </section>

      {/* Write Your First Eval */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold">3. Write Your First Eval</h2>
          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">Core Feature</Badge>
        </div>
        <p className="text-muted-foreground">
          Define test cases with assertions that check your AI&apos;s output for correctness,
          safety, and quality. The test suite runner handles execution, parallelism, and reporting.
        </p>
        <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
          <pre>
            <code>{testSuiteCode}</code>
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton code={testSuiteCode} />
          </div>
        </div>
      </section>

      {/* Built-in Assertions */}
      <section className="space-y-4" id="assertions">
        <div>
          <h2 className="text-2xl font-semibold">4. Built-in Assertions</h2>
          <p className="text-muted-foreground mt-1">
            20 assertions purpose-built for LLM outputs. Use with{" "}
            <code className="text-sm bg-muted px-1.5 py-0.5 rounded">expect(output)</code> in your
            test suites.
          </p>
        </div>
        <div className="space-y-6">
          {assertionGroups.map((group) => (
            <div key={group.name}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.name}
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {group.assertions.map((a) => (
                  <Card key={a.method} className="p-3">
                    <code className="text-xs font-mono font-medium text-primary">.{a.method}</code>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Create Trace + Span */}
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">5. Trace Your LLM Calls</h2>
        <p className="text-muted-foreground">
          Instrument your application with traces and spans for full observability
        </p>
        <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
          <pre>
            <code>{traceCode}</code>
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton code={traceCode} />
          </div>
        </div>
      </section>

      {/* CI Assert */}
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">6. CI/CD Quality Gate</h2>
        <p className="text-muted-foreground">
          Prevent quality regressions by running your test suite in CI
        </p>
        <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
          <pre>
            <code>{ciCode}</code>
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton code={ciCode} />
          </div>
        </div>
      </section>

      {/* Next Steps */}
      <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Next Steps</h3>
          <div className="grid gap-3">
            <Link href="/developer/api-keys">
              <Button variant="outline" className="w-full justify-start">
                <Zap className="h-4 w-4 mr-2" />
                Get Your API Key
              </Button>
            </Link>
            <Link href="/evaluations">
              <Button variant="outline" className="w-full justify-start">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Create an Evaluation
              </Button>
            </Link>
            <Link href="/traces">
              <Button variant="outline" className="w-full justify-start">
                <Sparkles className="h-4 w-4 mr-2" />
                View Traces
              </Button>
            </Link>
            <a href="/sdk" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full justify-start">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Public SDK Docs
              </Button>
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
