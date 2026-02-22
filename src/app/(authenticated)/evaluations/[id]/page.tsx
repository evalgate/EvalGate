"use client";

import { ArrowLeft, ChevronRight, Copy, Download, FileText, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { AIQualityScoreCard } from "@/components/ai-quality-score-card";
import { ExportModal, type ExportOptions } from "@/components/export-modal";
import { RunDiffView } from "@/components/run-diff-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateQualityScore,
  type EvaluationStats,
  type QualityScore,
} from "@/lib/ai-quality-score";
import { useSession } from "@/lib/auth-client";

interface EvaluationRun {
  id: number;
  totalCases?: number;
  total_cases?: number;
  total_tests?: number;
  passedCases?: number;
  passed_cases?: number;
  passed_tests?: number;
  runId?: number;
  variant_id?: string;
  variant_name?: string;
  average_latency?: number;
  average_cost?: number;
  quality_score?: number;
  status?: string;
  createdAt?: string;
  completedAt?: string;
  startedAt?: string;
  started_at?: string;
  traceLog?: any;
}

interface Evaluation {
  id: number;
  name: string;
  type: EvaluationType;
  description?: string;
  category?: string;
  created_at?: string;
  human_eval_criteria?: Array<{
    name: string;
    description: string;
    scale: string;
  }>;
  judge_prompt?: string;
  judge_model?: string;
  variants?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

interface TestCase {
  id: number;
  input: string;
  expected?: string;
  expectedOutput?: string;
  actualOutput?: string;
  passed?: boolean;
  executionTimeMs?: number;
  errorMessage?: string;
  name?: string;
}

import {
  type EvaluationType,
  formatExportData,
  generateExportFilename,
  validateExportData,
} from "@/lib/export-templates";

// Update type
type PageProps = {
  params: Promise<{ id: string }>;
};

export default function EvaluationDetailPage({ params }: PageProps) {
  const { id } = use(params); // Unwrap Promise with use()
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [openDiffRunId, setOpenDiffRunId] = useState<number | null>(null);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/auth/login");
      return;
    }

    if (session?.user) {
      // Fetch evaluation
      fetch(`/api/evaluations/${id}`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            router.push("/evaluations");
          } else {
            setEvaluation(data.evaluation);
          }
        });

      // Fetch test cases
      fetch(`/api/evaluations/${id}/test-cases`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => setTestCases(data.testCases || []));

      // Fetch runs
      fetch(`/api/evaluations/${id}/runs`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          const fetchedRuns = data.runs || [];
          setRuns(fetchedRuns);

          // Calculate quality score from runs
          if (fetchedRuns.length > 0) {
            const latestRun = fetchedRuns[0];
            // Use correct Drizzle camelCase field names from schema
            const totalCases = latestRun.totalCases || latestRun.total_cases || 0;
            const passedCases = latestRun.passedCases || latestRun.passed_cases || 0;
            const failedCases = latestRun.failedCases || latestRun.failed_cases || 0;
            const stats: EvaluationStats = {
              totalEvaluations: totalCases,
              passedEvaluations: passedCases,
              failedEvaluations: failedCases,
              averageLatency: 500, // Default — computed from testResults if available
              averageCost: 0.01, // Default — computed from cost records if available
              averageScore: totalCases > 0 ? (passedCases / totalCases) * 100 : 0,
              consistencyScore: 85, // Default — computed from multiple runs if available
            };
            const score = calculateQualityScore(stats);
            setQualityScore(score);
          }

          setIsLoading(false);
        });
    }
  }, [session, isPending, router, id]); // Changed from params.id to id

  const handleCopyResults = () => {
    if (!qualityScore || !evaluation) return;

    const latestRun = runs[0];
    const runTotal = latestRun?.totalCases || latestRun?.total_cases || 0;
    const runPassed = latestRun?.passedCases || latestRun?.passed_cases || 0;
    const summary = `
Evaluation Results: ${evaluation.name}
Grade: ${qualityScore.grade} (${qualityScore.overall}/100)

Summary:
- Total Tests: ${runTotal}
- Passed: ${runPassed}
- Failed: ${runTotal - runPassed}
- Pass Rate: ${runTotal ? Math.round((runPassed / runTotal) * 100) : 0}%

Quality Metrics:
- Accuracy: ${qualityScore.metrics.accuracy}/100
- Safety: ${qualityScore.metrics.safety}/100
- Latency: ${qualityScore.metrics.latency}/100
- Cost: ${qualityScore.metrics.cost}/100
- Consistency: ${qualityScore.metrics.consistency}/100

Key Insights:
${qualityScore.insights.map((i: string) => `- ${i}`).join("\n")}

Recommendations:
${qualityScore.recommendations.map((r: string) => `- ${r}`).join("\n")}
    `.trim();

    navigator.clipboard.writeText(summary);
    toast.success("Results copied to clipboard!");
  };

  const handleExportWithOptions = async (options: ExportOptions): Promise<string | null> => {
    if (!qualityScore || !evaluation) return null;

    const latestRun = runs[0];
    const runId = latestRun?.id ?? latestRun?.runId;

    // Prefer server-side export when we have a run (includes IAA for human_eval)
    if (runId) {
      try {
        const res = await fetch(`/api/evaluations/${id}/runs/${runId}/export`, {
          credentials: "include",
        });
        if (res.ok) {
          const exportData = await res.json();
          if (options.publishAsDemo) {
            const publishRes = await fetch(`/api/evaluations/${id}/publish`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                exportData,
                customShareId: options.customShareId,
                shareScope: options.shareScope ?? "evaluation",
                evaluationRunId: runId,
              }),
            });
            if (!publishRes.ok) {
              const err = (await publishRes.json()) as { error?: string };
              throw new Error(err.error || "Failed to publish");
            }
            const result = await publishRes.json();
            downloadExportFile(exportData, evaluation);
            return result.shareId;
          }
          downloadExportFile(exportData, evaluation);
          return null;
        }
      } catch (e: unknown) {
        console.warn("Server export failed, falling back to client:", e);
      }
    }

    // Fallback: client-side export
    const baseData = {
      evaluation: {
        id: String(evaluation.id),
        name: evaluation.name,
        description: evaluation.description || "",
        type: evaluation.type as EvaluationType,
        category: evaluation.category,
        created_at: evaluation.created_at || new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: latestRun?.totalCases || latestRun?.total_cases || 0,
        passed: latestRun?.passedCases || latestRun?.passed_cases || 0,
        failed:
          (latestRun?.totalCases || latestRun?.total_cases || 0) -
          (latestRun?.passedCases || latestRun?.passed_cases || 0),
        passRate:
          latestRun?.totalCases || latestRun?.total_cases
            ? `${Math.round(((latestRun?.passedCases || latestRun?.passed_cases || 0) / (latestRun?.totalCases || latestRun?.total_cases || 1)) * 100)}%`
            : "0%",
      },
      qualityScore: qualityScore || undefined,
    };

    // Type-specific additional data
    const additionalData = getAdditionalExportData(evaluation.type, testCases, runs, latestRun);

    // Format based on template type
    const exportData = formatExportData(baseData, additionalData);

    // Validate export data
    const validation = validateExportData(exportData);
    if (!validation.valid) {
      console.warn("Export data incomplete:", validation.missingFields);
    }

    // If publishing as demo, call API
    if (options.publishAsDemo) {
      try {
        const response = await fetch(`/api/evaluations/${id}/publish`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            exportData,
            customShareId: options.customShareId,
            shareScope: options.shareScope ?? "evaluation",
            evaluationRunId: latestRun?.id ?? latestRun?.runId,
          }),
        });

        if (!response.ok) {
          const error = (await response.json()) as { error?: string };
          throw new Error(error.error || "Failed to publish");
        }

        const result = await response.json();

        // Also download the file
        downloadExportFile(exportData, evaluation);

        return result.shareId;
      } catch (error) {
        console.error("Publish error:", error);
        throw error;
      }
    } else {
      // Just download the file
      downloadExportFile(exportData, evaluation);
      return null;
    }
  };

  const downloadExportFile = (
    exportData: unknown,
    evaluation: { name?: string; type?: string; category?: string },
  ) => {
    const filename = generateExportFilename(
      evaluation.name || "evaluation",
      evaluation.type as EvaluationType,
      evaluation.category || "",
    );

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper function to get type-specific export data
  const getAdditionalExportData = (
    type: string,
    testCases: TestCase[],
    runs: EvaluationRun[],
    latestRun: EvaluationRun | undefined,
  ) => {
    switch (type) {
      case "unit_test":
        return {
          testResults: testCases.map((tc: TestCase) => ({
            id: tc.id,
            name: tc.name || "",
            input: tc.input,
            expected_output: tc.expectedOutput || tc.expected,
            actual_output: tc.actualOutput,
            passed: tc.passed ?? false,
            execution_time_ms: tc.executionTimeMs,
            error_message: tc.errorMessage,
          })),
          codeValidation: (latestRun as any)?.code_validation,
        };

      case "human_eval":
        return {
          evaluations: (latestRun as any)?.human_evaluations || [],
          criteria: evaluation?.human_eval_criteria || [],
          interRaterReliability: (latestRun as any)?.inter_rater_reliability,
        };

      case "model_eval":
        return {
          judgeEvaluations: (latestRun as any)?.judge_evaluations || [],
          judgePrompt: evaluation?.judge_prompt || "",
          judgeModel: evaluation?.judge_model || "gpt-4",
          aggregateMetrics: (latestRun as any)?.aggregate_metrics,
        };

      case "ab_test":
        return {
          variants: evaluation?.variants || [],
          results: runs.map((run: EvaluationRun) => ({
            variant_id: run.variant_id,
            variant_name: run.variant_name,
            test_count: run.total_tests,
            success_rate: (run.passed_tests || 0) / (run.total_tests || 1),
            average_latency: run.average_latency,
            average_cost: run.average_cost,
            quality_score: run.quality_score,
          })),
          statisticalSignificance: (latestRun as any)?.statistical_significance,
          comparison: (latestRun as any)?.comparison,
        };

      default:
        return {
          testResults: testCases,
          recentRuns: runs.slice(0, 5),
        };
    }
  };

  if (isPending || !session?.user || isLoading || !evaluation) {
    return null;
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

      {/* Evaluation Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold">{evaluation.name}</h1>
              <Badge
                variant="outline"
                className={`${
                  evaluation.type === "unit_test"
                    ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                    : evaluation.type === "human_eval"
                      ? "bg-green-500/10 text-green-500 border-green-500/20"
                      : evaluation.type === "model_eval"
                        ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                        : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                }`}
              >
                {evaluation.type.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">
              {evaluation.description || "No description provided"}
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {qualityScore && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyResults}
                  className="flex-1 sm:flex-none"
                >
                  <Copy className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExportModalOpen(true)}
                  className="flex-1 sm:flex-none"
                >
                  <Download className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Export
                </Button>
              </>
            )}
            <Button size="sm" className="flex-1 sm:flex-none">
              <Play className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Run
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-3">
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium">Test Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{testCases.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{runs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium">Last Run</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs sm:text-sm">
              {runs.length > 0
                ? new Date(
                    runs[0].startedAt || runs[0].started_at || runs[0].createdAt || "",
                  ).toLocaleDateString()
                : "Never"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quality Score Card */}
      {qualityScore && <AIQualityScoreCard score={qualityScore} />}

      {/* Test Cases */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-semibold">Test Cases</h2>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <Plus className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Add Test Case
          </Button>
        </div>

        {testCases.length > 0 ? (
          <div className="space-y-2 sm:space-y-3">
            {testCases.map((testCase: TestCase) => (
              <Card key={testCase.id}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm sm:text-base font-semibold mb-2">
                        {testCase.name || `Test Case ${testCase.id}`}
                      </h3>
                      <div className="grid gap-2 sm:gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Input</p>
                          <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-24">
                            {JSON.stringify(testCase.input, null, 2)}
                          </pre>
                        </div>
                        {testCase.expectedOutput && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Expected Output</p>
                            <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-24">
                              {JSON.stringify(testCase.expectedOutput, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No test cases yet</h3>
              <p className="text-muted-foreground mb-4">
                Add test cases to start evaluating your AI models
              </p>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Test Case
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Runs */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Recent Runs</h2>
        {runs.length > 0 ? (
          <div className="space-y-3">
            {runs.map((run: EvaluationRun) => (
              <Card key={run.id} id={`run-${run.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <Badge
                          variant="outline"
                          className={`${
                            run.status === "completed"
                              ? "bg-green-500/10 text-green-500 border-green-500/20"
                              : run.status === "running"
                                ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                : run.status === "failed"
                                  ? "bg-red-500/10 text-red-500 border-red-500/20"
                                  : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                          }`}
                        >
                          {run.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(
                            run.startedAt || run.started_at || run.createdAt || "",
                          ).toLocaleString()}
                        </span>
                      </div>
                      {run.status === "completed" && (
                        <p className="text-sm">
                          {run.passedCases || run.passed_cases || 0} /{" "}
                          {run.totalCases || run.total_cases || 0} tests passed
                        </p>
                      )}
                      {(() => {
                        const tl =
                          typeof run.traceLog === "string"
                            ? (() => {
                                try {
                                  return JSON.parse(run.traceLog);
                                } catch {
                                  return {};
                                }
                              })()
                            : (run.traceLog ?? {});
                        const checkReport = tl?.import?.checkReport;
                        if (!checkReport) return null;
                        return (
                          <details className="group mt-2 text-xs">
                            <summary className="cursor-pointer flex items-center gap-1 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                              CI Check Report
                            </summary>
                            <div className="mt-1 space-y-1">
                              {checkReport.baselineRunId && (
                                <p className="text-muted-foreground">
                                  Compares to baseline{" "}
                                  <Link
                                    href={`/evaluations/${id}#run-${checkReport.baselineRunId}`}
                                    className="text-primary hover:underline"
                                  >
                                    run #{checkReport.baselineRunId}
                                  </Link>
                                </p>
                              )}
                              {checkReport.ciRunUrl && (
                                <p className="text-muted-foreground">
                                  <a
                                    href={checkReport.ciRunUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    CI run
                                  </a>
                                </p>
                              )}
                              {checkReport.baselineRunId && (
                                <details
                                  className="group/diff mt-1"
                                  onToggle={(e) =>
                                    setOpenDiffRunId(
                                      (e.target as HTMLDetailsElement).open ? run.id : null,
                                    )
                                  }
                                >
                                  <summary className="cursor-pointer flex items-center gap-1 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                                    <ChevronRight className="h-3 w-3 transition-transform group-open/diff:rotate-90" />
                                    View diff (baseline vs current)
                                  </summary>
                                  {openDiffRunId === run.id && (
                                    <div className="mt-1">
                                      <RunDiffView
                                        evaluationId={id}
                                        runId={run.id}
                                        compareRunId={checkReport.baselineRunId}
                                      />
                                    </div>
                                  )}
                                </details>
                              )}
                              <pre className="p-2 rounded bg-muted overflow-x-auto max-h-32 overflow-y-auto">
                                {JSON.stringify(
                                  {
                                    verdict: checkReport.verdict,
                                    reasonCode: checkReport.reasonCode,
                                    reasonMessage: checkReport.reasonMessage,
                                    score: checkReport.score,
                                    baselineScore: checkReport.baselineScore,
                                    delta: checkReport.delta,
                                  },
                                  null,
                                  2,
                                )}
                              </pre>
                            </div>
                          </details>
                        );
                      })()}
                    </div>
                    <Button variant="outline" size="sm">
                      View Results
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No runs yet</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        evaluationName={evaluation?.name || "Evaluation"}
        onExport={handleExportWithOptions}
      />
    </div>
  );
}
