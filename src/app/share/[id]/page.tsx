"use client";

import { Copy, Download, ExternalLink, Lock } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { AIQualityScoreCard } from "@/components/ai-quality-score-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type DemoEvaluation,
  getPublicDemo,
  type TestResult,
  validateDemoData,
} from "@/lib/demo-loader";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function SharePage({ params }: PageProps) {
  const { id } = use(params);
  const [demo, setDemo] = useState<DemoEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDemo() {
      try {
        const result = await getPublicDemo(id);

        if (!result.data) {
          setError(
            result.error === "expired"
              ? "This share link has expired"
              : result.error === "revoked"
                ? "This share link has been revoked"
                : "Share not found or not publicly available",
          );
          return;
        }

        if (!validateDemoData(result.data)) {
          setError("Invalid demo data format");
          return;
        }

        setDemo(result.data);
      } catch (err) {
        setError("Failed to load demo");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadDemo();
  }, [id]);

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard!");
  };

  const handleCopyResults = () => {
    if (!demo) return;

    const summary = `
Evaluation Results: ${demo.name}
Grade: ${(demo.qualityScore as any)?.grade} (${(demo.qualityScore as any)?.overall}/100)

Summary:
- Total Tests: ${demo.summary.totalTests}
- Passed: ${demo.summary.passed}
- Failed: ${demo.summary.failed}
- Pass Rate: ${demo.summary.passRate}

Quality Metrics:
- Accuracy: ${(demo.qualityScore as any)?.metrics?.accuracy}/100
- Safety: ${(demo.qualityScore as any)?.metrics?.safety}/100
- Latency: ${(demo.qualityScore as any)?.metrics?.latency}/100
- Cost: ${(demo.qualityScore as any)?.metrics?.cost}/100
- Consistency: ${(demo.qualityScore as any)?.metrics?.consistency}/100

Key Insights:
${(demo.qualityScore as any)?.insights?.map((i: string) => `- ${i}`).join("\n")}

Recommendations:
${(demo.qualityScore as any)?.recommendations?.map((r: string) => `- ${r}`).join("\n")}

View full results: ${window.location.href}
    `.trim();

    navigator.clipboard.writeText(summary);
    toast.success("Results copied to clipboard!");
  };

  const handleDownload = () => {
    if (!demo) return;

    const blob = new Blob([JSON.stringify(demo, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${demo.name.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Share data downloaded!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading shared evaluation...</p>
        </div>
      </div>
    );
  }

  if (error || !demo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Share Not Available
            </CardTitle>
            <CardDescription>
              {error || "This evaluation is not publicly shared or does not exist."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/">Go to Homepage</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Banner for share viewers */}
      <div className="bg-primary/10 border-b border-primary/20 py-3">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-center sm:text-left">
              📊 <strong>You're viewing a shared evaluation</strong> exported from our platform.{" "}
              <Link href="/auth/login" className="underline font-medium">
                Sign in
              </Link>{" "}
              to run your own tests.
            </p>
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Copy Link
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{demo.name}</h1>
                <Badge
                  variant="outline"
                  className={`${
                    demo.type === "unit_test"
                      ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      : demo.type === "human_eval"
                        ? "bg-green-500/10 text-green-500 border-green-500/20"
                        : demo.type === "model_eval"
                          ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                          : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                  }`}
                >
                  {demo.type.replace("_", " ")}
                </Badge>
                {demo.category && <Badge variant="secondary">{demo.category}</Badge>}
              </div>
              {demo.description && <p className="text-muted-foreground">{demo.description}</p>}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span>
                  Shared on {new Date(demo.timestamp ?? demo.createdAt).toLocaleDateString()}
                </span>
                {(demo as { shareScope?: string }).shareScope === "run" && (
                  <Badge variant="secondary" className="font-normal">
                    Immutable snapshot
                  </Badge>
                )}
                {(demo as { shareScope?: string }).shareScope === "evaluation" && (
                  <Badge variant="outline" className="font-normal">
                    Updates when republished
                  </Badge>
                )}
                {(demo as { exportHash?: string }).exportHash && (
                  <span
                    className="flex items-center gap-1"
                    title="Hash provided for integrity check"
                  >
                    ✓ Integrity hash provided
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyResults}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{demo.summary.totalTests}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Passed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{demo.summary.passed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{demo.summary.failed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{demo.summary.passRate}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quality Score Card */}
        {demo.qualityScore && (
          <div className="mb-6">
            <AIQualityScoreCard score={demo.qualityScore} />
          </div>
        )}

        {/* Test Results */}
        {demo.testResults && demo.testResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>Detailed results for each test case</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {((demo.testResults as TestResult[]) || [])
                  .slice(0, 10)
                  .map((test: TestResult, idx: number) => (
                    <div
                      key={test.id || idx}
                      className="flex items-start justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={test.passed ? "default" : "destructive"}>
                            {test.passed ? "PASS" : "FAIL"}
                          </Badge>
                          <span className="font-medium">{test.name || `Test ${idx + 1}`}</span>
                        </div>
                        {test.input != null && (
                          <p className="text-sm text-muted-foreground">
                            Input:{" "}
                            {typeof test.input === "string"
                              ? test.input
                              : JSON.stringify(test.input as any).slice(0, 100)}
                          </p>
                        )}
                      </div>
                      {test.score !== undefined && (
                        <div className="text-right">
                          <div className="text-lg font-bold">{test.score}</div>
                          <div className="text-xs text-muted-foreground">score</div>
                        </div>
                      )}
                    </div>
                  ))}
                {demo.testResults.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    Showing 10 of {demo.testResults.length} results. Download full data for more.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <Card className="mt-6 bg-primary/5 border-primary/20">
          <CardContent className="pt-6 text-center">
            <h3 className="text-xl font-bold mb-2">Want to create your own evaluations?</h3>
            <p className="text-muted-foreground mb-4">
              Sign up to run comprehensive AI evaluations with custom test cases, automated scoring,
              and detailed analytics.
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild>
                <Link href="/auth/signup">Get Started Free</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Learn More</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
