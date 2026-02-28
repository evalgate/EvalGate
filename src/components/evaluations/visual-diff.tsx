// src/components/evaluations/visual-diff.tsx
"use client";

import {
	ArrowDownRight,
	ArrowUpRight,
	BarChart3,
	CheckCircle,
	Clock,
	Eye,
	GitCompare,
	Minus,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface DiffResult {
	traceId: string;
	originalScore: number | null;
	shadowScore: number;
	scoreDiff: number;
	passed: boolean;
	duration: number;
	originalOutput?: string;
	shadowOutput?: string;
	metadata: Record<string, unknown>;
}

interface VisualDiffProps {
	originalEvaluation: {
		id: number;
		name: string;
		averageScore: number;
		totalTraces: number;
	};
	shadowResults: DiffResult[];
	isLoading?: boolean;
}

export function VisualDiff({
	originalEvaluation: _originalEvaluation,
	shadowResults,
	isLoading,
}: VisualDiffProps) {
	const [selectedTrace, setSelectedTrace] = useState<DiffResult | null>(null);

	const stats = {
		averageScoreImprovement:
			shadowResults.length > 0
				? shadowResults.reduce((sum, r) => sum + r.scoreDiff, 0) /
					shadowResults.length
				: 0,
		passRate:
			shadowResults.length > 0
				? (shadowResults.filter((r) => r.passed).length /
						shadowResults.length) *
					100
				: 0,
		averageDuration:
			shadowResults.length > 0
				? shadowResults.reduce((sum, r) => sum + r.duration, 0) /
					shadowResults.length
				: 0,
		improvedTraces: shadowResults.filter((r) => r.scoreDiff > 0).length,
		degradedTraces: shadowResults.filter((r) => r.scoreDiff < 0).length,
		unchangedTraces: shadowResults.filter((r) => r.scoreDiff === 0).length,
	};

	const getScoreDiffIcon = (diff: number) => {
		if (diff > 0) return <ArrowUpRight className="h-4 w-4 text-green-500" />;
		if (diff < 0) return <ArrowDownRight className="h-4 w-4 text-red-500" />;
		return <Minus className="h-4 w-4 text-gray-500" />;
	};

	const getScoreDiffColor = (diff: number) => {
		if (diff > 0) return "text-green-600";
		if (diff < 0) return "text-red-600";
		return "text-gray-600";
	};

	const _getPassRateColor = (rate: number) => {
		if (rate >= 80) return "text-green-600";
		if (rate >= 60) return "text-yellow-600";
		return "text-red-600";
	};

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<GitCompare className="h-5 w-5" />
						Visual Comparison
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-8">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			{/* Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Score Improvement
						</CardTitle>
						<BarChart3 className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2">
							{getScoreDiffIcon(stats.averageScoreImprovement)}
							<div className="text-2xl font-bold">
								{stats.averageScoreImprovement > 0 ? "+" : ""}
								{stats.averageScoreImprovement.toFixed(1)}
							</div>
						</div>
						<p className="text-xs text-muted-foreground">
							Average score change
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
						<CheckCircle className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{stats.passRate.toFixed(1)}%
						</div>
						<Progress value={stats.passRate} className="mt-2" />
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
						<Clock className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{(stats.averageDuration / 1000).toFixed(1)}s
						</div>
						<p className="text-xs text-muted-foreground">Per trace</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Trace Changes</CardTitle>
						<GitCompare className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="space-y-1">
							<div className="flex items-center justify-between text-sm">
								<span className="text-green-600">+{stats.improvedTraces}</span>
								<span>Improved</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-red-600">-{stats.degradedTraces}</span>
								<span>Degraded</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-gray-600">{stats.unchangedTraces}</span>
								<span>Unchanged</span>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Detailed Comparison */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Eye className="h-5 w-5" />
						Detailed Trace Comparison
					</CardTitle>
					<CardDescription>
						Compare individual trace results between original and shadow
						evaluation
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Tabs defaultValue="overview" className="w-full">
						<TabsList className="grid w-full grid-cols-3">
							<TabsTrigger value="overview">Overview</TabsTrigger>
							<TabsTrigger value="details">Trace Details</TabsTrigger>
							<TabsTrigger value="comparison">Side-by-Side</TabsTrigger>
						</TabsList>

						<TabsContent value="overview" className="space-y-4">
							<div className="space-y-2">
								{shadowResults.map((result, _index) => (
									<button
										key={result.traceId}
										type="button"
										className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer w-full text-left"
										onClick={() => setSelectedTrace(result)}
									>
										<div className="flex items-center gap-3">
											<div className="flex items-center gap-2">
												{result.passed ? (
													<CheckCircle className="h-4 w-4 text-green-500" />
												) : (
													<XCircle className="h-4 w-4 text-red-500" />
												)}
												<span className="font-mono text-sm">
													{result.traceId}
												</span>
											</div>
											<div className="flex items-center gap-4 text-sm">
												<div className="flex items-center gap-1">
													<span className="text-muted-foreground">
														Original:
													</span>
													<span className="font-medium">
														{result.originalScore || "N/A"}
													</span>
												</div>
												<div className="flex items-center gap-1">
													<span className="text-muted-foreground">Shadow:</span>
													<span className="font-medium">
														{result.shadowScore}
													</span>
												</div>
												<div className="flex items-center gap-1">
													{getScoreDiffIcon(result.scoreDiff)}
													<span
														className={cn(
															"font-medium",
															getScoreDiffColor(result.scoreDiff),
														)}
													>
														{result.scoreDiff > 0 ? "+" : ""}
														{result.scoreDiff}
													</span>
												</div>
											</div>
										</div>
										<div className="text-xs text-muted-foreground">
											{result.duration}ms
										</div>
									</button>
								))}
							</div>
						</TabsContent>

						<TabsContent value="details" className="space-y-4">
							{selectedTrace ? (
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<h3 className="text-lg font-semibold">
											{selectedTrace.traceId}
										</h3>
										<Badge
											variant={selectedTrace.passed ? "default" : "destructive"}
										>
											{selectedTrace.passed ? "Passed" : "Failed"}
										</Badge>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<h4 className="font-medium">Original Evaluation</h4>
											<div className="p-4 border rounded-lg space-y-2">
												<div className="flex justify-between">
													<span className="text-sm text-muted-foreground">
														Score:
													</span>
													<span className="font-medium">
														{selectedTrace.originalScore || "N/A"}
													</span>
												</div>
												{selectedTrace.originalOutput && (
													<div>
														<span className="text-sm text-muted-foreground">
															Output:
														</span>
														<div className="mt-1 p-2 bg-muted rounded text-sm">
															{selectedTrace.originalOutput}
														</div>
													</div>
												)}
											</div>
										</div>

										<div className="space-y-2">
											<h4 className="font-medium">Shadow Evaluation</h4>
											<div className="p-4 border rounded-lg space-y-2">
												<div className="flex justify-between">
													<span className="text-sm text-muted-foreground">
														Score:
													</span>
													<span className="font-medium">
														{selectedTrace.shadowScore}
													</span>
												</div>
												<div className="flex justify-between">
													<span className="text-sm text-muted-foreground">
														Change:
													</span>
													<div className="flex items-center gap-1">
														{getScoreDiffIcon(selectedTrace.scoreDiff)}
														<span
															className={cn(
																"font-medium",
																getScoreDiffColor(selectedTrace.scoreDiff),
															)}
														>
															{selectedTrace.scoreDiff > 0 ? "+" : ""}
															{selectedTrace.scoreDiff}
														</span>
													</div>
												</div>
												{selectedTrace.shadowOutput && (
													<div>
														<span className="text-sm text-muted-foreground">
															Output:
														</span>
														<div className="mt-1 p-2 bg-muted rounded text-sm">
															{selectedTrace.shadowOutput}
														</div>
													</div>
												)}
											</div>
										</div>
									</div>

									<div className="space-y-2">
										<h4 className="font-medium">Metadata</h4>
										<div className="p-4 border rounded-lg">
											<pre className="text-xs overflow-x-auto">
												{JSON.stringify(selectedTrace.metadata, null, 2)}
											</pre>
										</div>
									</div>
								</div>
							) : (
								<div className="text-center py-8 text-muted-foreground">
									Select a trace from the overview tab to see details
								</div>
							)}
						</TabsContent>

						<TabsContent value="comparison" className="space-y-4">
							{selectedTrace?.originalOutput && selectedTrace.shadowOutput ? (
								<div className="space-y-4">
									<h3 className="text-lg font-semibold">Output Comparison</h3>

									<div className="grid grid-cols-2 gap-4">
										<div>
											<h4 className="font-medium mb-2">Original Output</h4>
											<div className="p-4 border rounded-lg">
												<div className="whitespace-pre-wrap text-sm">
													{selectedTrace.originalOutput}
												</div>
											</div>
										</div>

										<div>
											<h4 className="font-medium mb-2">Shadow Output</h4>
											<div className="p-4 border rounded-lg">
												<div className="whitespace-pre-wrap text-sm">
													{selectedTrace.shadowOutput}
												</div>
											</div>
										</div>
									</div>

									<div className="space-y-2">
										<h4 className="font-medium">Score Comparison</h4>
										<div className="p-4 border rounded-lg">
											<div className="space-y-2">
												<div className="flex justify-between items-center">
													<span>Original Score:</span>
													<span className="font-medium">
														{selectedTrace.originalScore || "N/A"}
													</span>
												</div>
												<div className="flex justify-between items-center">
													<span>Shadow Score:</span>
													<span className="font-medium">
														{selectedTrace.shadowScore}
													</span>
												</div>
												<div className="flex justify-between items-center pt-2 border-t">
													<span>Difference:</span>
													<div className="flex items-center gap-1">
														{getScoreDiffIcon(selectedTrace.scoreDiff)}
														<span
															className={cn(
																"font-bold",
																getScoreDiffColor(selectedTrace.scoreDiff),
															)}
														>
															{selectedTrace.scoreDiff > 0 ? "+" : ""}
															{selectedTrace.scoreDiff}
														</span>
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>
							) : (
								<div className="text-center py-8 text-muted-foreground">
									Select a trace with both outputs to see comparison
								</div>
							)}
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
		</div>
	);
}
