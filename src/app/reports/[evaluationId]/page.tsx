// src/app/reports/[evaluationId]/page.tsx
"use client";

import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  FileText,
  Minus,
  Share2,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ReportCardData {
  evaluationId: number;
  evaluationName: string;
  evaluationType: string;
  organizationId: number;
  organizationName: string;
  totalRuns: number;
  completedRuns: number;
  averageScore: number;
  passRate: number;
  averageDuration: number;
  totalCost: number;
  lastRunAt: string;
  createdAt: string;
  performance: {
    scoreDistribution: Record<string, number>;
    statusDistribution: Record<string, number>;
    durationStats: {
      min: number;
      max: number;
      avg: number;
      p95: number;
    };
    costStats: {
      min: number;
      max: number;
      avg: number;
      total: number;
    };
  };
  quality: {
    judgeResults: {
      totalJudged: number;
      averageJudgeScore: number;
      passedJudged: number;
      failedJudged: number;
    };
    consistency: {
      scoreVariance: number;
      scoreStdDev: number;
      coefficientOfVariation: number;
    };
  };
  trends: {
    recentPerformance: Array<{
      runId: number;
      score: number;
      completedAt: string;
    }>;
    scoreTrend: "improving" | "declining" | "stable";
    performanceChange: number;
  };
  metadata: Record<string, unknown>;
}

export default function PublicReportPage() {
  const params = useParams();
  const evaluationId = params.evaluationId as string;

  const [reportCard, setReportCard] = useState<ReportCardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReportCard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/report-cards/${evaluationId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch report card");
      }

      const data = await response.json();
      setReportCard(data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [evaluationId]);

  useEffect(() => {
    if (evaluationId) {
      fetchReportCard();
    }
  }, [evaluationId, fetchReportCard]);

  const getGrade = (score: number): string => {
    if (score >= 95) return "A+";
    if (score >= 90) return "A";
    if (score >= 85) return "B+";
    if (score >= 80) return "B";
    if (score >= 75) return "C+";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  };

  const getGradeColor = (grade: string): string => {
    if (grade.startsWith("A")) return "text-green-600";
    if (grade.startsWith("B")) return "text-blue-600";
    if (grade.startsWith("C")) return "text-yellow-600";
    if (grade === "D") return "text-orange-600";
    return "text-red-600";
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "improving") return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === "declining") return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getStatusIcon = (status: string) => {
    if (status === "passed") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "failed") return <XCircle className="h-4 w-4 text-red-500" />;
    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !reportCard) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-16">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Report Not Found</h1>
            <p className="text-gray-600">
              {error || "This report could not be found or is not publicly accessible."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const overallScore = Math.round(reportCard.averageScore);
  const grade = getGrade(overallScore);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{reportCard.evaluationName}</h1>
              <p className="text-gray-600 mt-1">
                {reportCard.organizationName} • {reportCard.evaluationType} Evaluation
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Overall Score Card */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <div className="text-center">
                    <div className="text-6xl font-bold text-gray-900">{overallScore}</div>
                    <div className="text-sm text-gray-500">Score</div>
                  </div>
                  <div className="text-center">
                    <div className={cn("text-4xl font-bold", getGradeColor(grade))}>{grade}</div>
                    <div className="text-sm text-gray-500">Grade</div>
                  </div>
                </div>
                <p className="text-gray-600">
                  Generated on{" "}
                  {new Date(
                    (reportCard.metadata.generatedAt as string) ?? Date.now(),
                  ).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 mb-2">
                  {getTrendIcon(reportCard.trends.scoreTrend)}
                  <span className="text-sm font-medium">
                    {reportCard.trends.scoreTrend === "improving"
                      ? "Improving"
                      : reportCard.trends.scoreTrend === "declining"
                        ? "Declining"
                        : "Stable"}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {Math.abs(reportCard.trends.performanceChange).toFixed(1)}% change
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pass Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportCard.passRate.toFixed(1)}%</div>
              <Progress value={reportCard.passRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Runs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportCard.totalRuns}</div>
              <p className="text-xs text-gray-500 mt-1">{reportCard.completedRuns} completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Duration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(reportCard.averageDuration / 1000).toFixed(1)}s
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                <Clock className="h-3 w-3" />
                P95: {(reportCard.performance.durationStats.p95 / 1000).toFixed(1)}s
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${reportCard.totalCost.toFixed(2)}</div>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                <DollarSign className="h-3 w-3" />
                Avg: ${reportCard.performance.costStats.avg.toFixed(4)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Score Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(reportCard.performance.scoreDistribution).map(([range, count]) => (
                  <div key={range} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{range}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(count / reportCard.totalRuns) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-8">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(reportCard.performance.statusDistribution).map(
                  ([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(status)}
                        <span className="text-sm font-medium capitalize">{status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className={cn(
                              "h-2 rounded-full",
                              status === "passed"
                                ? "bg-green-600"
                                : status === "failed"
                                  ? "bg-red-600"
                                  : "bg-yellow-600",
                            )}
                            style={{ width: `${(count / reportCard.totalRuns) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 w-8">{count}</span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quality Metrics */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Quality Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium mb-3">Judge Results</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Judged:</span>
                    <span className="font-medium">
                      {reportCard.quality.judgeResults.totalJudged}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Judge Score:</span>
                    <span className="font-medium">
                      {reportCard.quality.judgeResults.averageJudgeScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Passed:</span>
                    <span className="font-medium text-green-600">
                      {reportCard.quality.judgeResults.passedJudged}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Failed:</span>
                    <span className="font-medium text-red-600">
                      {reportCard.quality.judgeResults.failedJudged}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Consistency</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Std Deviation:</span>
                    <span className="font-medium">
                      {reportCard.quality.consistency.scoreStdDev.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Variance:</span>
                    <span className="font-medium">
                      {reportCard.quality.consistency.scoreVariance.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Coefficient of Variation:</span>
                    <span className="font-medium">
                      {(reportCard.quality.consistency.coefficientOfVariation * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Performance Trends</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Trend:</span>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(reportCard.trends.scoreTrend)}
                      <span className="font-medium capitalize">{reportCard.trends.scoreTrend}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Change:</span>
                    <span
                      className={cn(
                        "font-medium",
                        reportCard.trends.performanceChange > 0
                          ? "text-green-600"
                          : reportCard.trends.performanceChange < 0
                            ? "text-red-600"
                            : "text-gray-600",
                      )}
                    >
                      {reportCard.trends.performanceChange > 0 ? "+" : ""}
                      {reportCard.trends.performanceChange.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Recent Runs:</span>
                    <span className="font-medium">
                      {reportCard.trends.recentPerformance.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 mt-12">
          <p>Report generated by AI Evaluation Platform</p>
          <p className="mt-1">
            Last updated:{" "}
            {new Date((reportCard.metadata.generatedAt as string) || Date.now()).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
