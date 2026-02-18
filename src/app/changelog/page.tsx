"use client";

import { ArrowLeft, ExternalLink, Package } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const versions = [
  {
    version: "1.3.0",
    date: "2025-10-21",
    highlights: [
      "Client-side request caching with smart TTL and automatic invalidation",
      "Cursor-based pagination with PaginatedIterator and autoPaginate()",
      "Request batching — 50-80% reduction in network requests",
      "Connection pooling for HTTP keep-alive",
      "Enhanced retry logic with exponential, linear, and fixed backoff strategies",
      "Comprehensive examples for performance optimization and complete workflows",
    ],
    type: "feature" as const,
  },
  {
    version: "1.2.2",
    date: "2025-10-20",
    highlights: [
      "Browser compatibility: safe getEnvVar() helper for process.env access",
      "Renamed TestCase → TestSuiteCase to avoid type collision with API types",
      "Fixed AsyncLocalStorage TypeScript compilation error in strict mode",
      "Legacy type aliases maintained for backward compatibility",
    ],
    type: "fix" as const,
  },
  {
    version: "1.2.1",
    date: "2025-01-20",
    highlights: [
      "Fixed CLI import paths for compiled output",
      "Fixed duplicate trace creation in OpenAI/Anthropic integrations",
      "Fixed Commander.js nested command syntax",
      "Browser-safe context system with environment detection",
      "Path traversal security hardening for snapshot system",
      "Updated commander to v14, added OpenAI/Anthropic peer dependencies",
    ],
    type: "fix" as const,
  },
  {
    version: "1.2.0",
    date: "2025-10-15",
    highlights: [
      "100% API Coverage — all backend endpoints supported",
      "Annotations API for human-in-the-loop evaluation",
      "Developer API for API key and webhook management",
      "LLM Judge Extended with enhanced judge capabilities",
      "Organizations API for org details access",
      "40+ new TypeScript interfaces",
    ],
    type: "feature" as const,
  },
  {
    version: "1.1.0",
    date: "2025-01-10",
    highlights: [
      "Comprehensive evaluation template types",
      "Organization resource limits tracking",
      "getOrganizationLimits() method",
    ],
    type: "feature" as const,
  },
  {
    version: "1.0.0",
    date: "2025-01-01",
    highlights: [
      "Initial release with Traces, Evaluations, LLM Judge APIs",
      "Framework integrations for OpenAI and Anthropic",
      "Test suite builder with 20+ assertion functions",
      "Context propagation system",
      "Error handling with retry logic",
    ],
    type: "feature" as const,
  },
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 sm:px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            EvalAI
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/documentation">Docs</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-8">
            <Button variant="ghost" size="sm" asChild className="mb-4">
              <Link href="/documentation">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Documentation
              </Link>
            </Button>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">Changelog</h1>
            <p className="text-muted-foreground text-lg">
              All notable changes to the{" "}
              <a
                href="https://www.npmjs.com/package/@pauly4010/evalai-sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                @pauly4010/evalai-sdk
                <ExternalLink className="h-3.5 w-3.5" />
              </a>{" "}
              package.
            </p>
          </div>

          <div className="space-y-6">
            {versions.map((release) => (
              <Card key={release.version}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-xl">v{release.version}</CardTitle>
                    <Badge
                      variant="outline"
                      className={
                        release.type === "feature"
                          ? "bg-green-500/10 text-green-500 border-green-500/20"
                          : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      }
                    >
                      {release.type === "feature" ? "Feature" : "Bugfix"}
                    </Badge>
                    <span className="text-sm text-muted-foreground ml-auto">
                      {new Date(release.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {release.highlights.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-muted-foreground text-sm">
              Full changelog available on{" "}
              <a
                href="https://github.com/pauly7610/ai-evaluation-platform"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub
              </a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
