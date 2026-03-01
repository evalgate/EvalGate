// src/components/streaming/live-progress.tsx
"use client";

import {
	Activity,
	CheckCircle,
	Clock,
	Eye,
	EyeOff,
	Minus,
	Pause,
	Play,
	RotateCcw,
	TrendingDown,
	TrendingUp,
	XCircle,
	Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

interface LiveProgressProps {
	evaluationId: number;
	organizationId: number;
	height?: number;
	showDetails?: boolean;
	compact?: boolean;
	className?: string;
}

interface TestCaseProgress {
	id: number;
	name: string;
	status: "pending" | "running" | "completed" | "failed";
	score?: number;
	duration?: number;
	error?: string;
	startedAt?: string;
	completedAt?: string;
}

interface EvaluationProgress {
	evaluationId: number;
	status: "pending" | "running" | "completed" | "failed";
	progress: number;
	totalTests: number;
	completedTests: number;
	passedTests: number;
	failedTests: number;
	currentTest?: string;
	startedAt?: string;
	completedAt?: string;
	testCases: TestCaseProgress[];
	metadata?: Record<string, unknown>;
}

export function LiveProgress({
	evaluationId,
	organizationId,
	height: _height = 200,
	showDetails = true,
	compact = false,
	className,
}: LiveProgressProps) {
	const [progress, setProgress] = useState<EvaluationProgress | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [isVisible, setIsVisible] = useState(true);
	const [isPaused, setIsPaused] = useState(false);

	const eventSourceRef = useRef<EventSource | null>(null);
	const progressHistoryRef = useRef<number[]>([]);

	// Connect to SSE stream for progress updates
	useEffect(() => {
		if (!organizationId || !evaluationId) return;

		const clientId = `progress_${evaluationId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		const eventSource = new EventSource(
			`/api/stream?clientId=${clientId}&channels=evaluation`,
		);

		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			setIsConnected(true);
		};

		eventSource.onmessage = (event) => {
			if (isPaused) return;

			try {
				const data = JSON.parse(event.data);

				// Handle different message types
				if (
					event.type === "evaluation_progress" &&
					data.evaluationId === evaluationId
				) {
					setProgress((prev) => ({
						...prev,
						...data,
						testCases: prev?.testCases || [],
					}));

					// Track progress history for trend calculation
					progressHistoryRef.current.push(data.progress);
					if (progressHistoryRef.current.length > 100) {
						progressHistoryRef.current = progressHistoryRef.current.slice(-50);
					}
				} else if (
					event.type === "evaluation_started" &&
					data.evaluationId === evaluationId
				) {
					setProgress({
						evaluationId: data.evaluationId,
						status: "running",
						progress: 0,
						totalTests: 0,
						completedTests: 0,
						passedTests: 0,
						failedTests: 0,
						testCases: [],
						startedAt: new Date().toISOString(),
					});
				} else if (
					event.type === "evaluation_completed" &&
					data.evaluationId === evaluationId
				) {
					setProgress((prev) => ({
						...prev,
						status: "completed",
						progress: 100,
						completedAt: new Date().toISOString(),
						...data.results,
					}));
				} else if (
					event.type === "test_case_started" &&
					data.evaluationId === evaluationId
				) {
					setProgress((prev) => {
						if (!prev) return prev;

						const updatedTestCases = prev.testCases.map((tc) =>
							tc.id === data.testCaseId
								? {
										...tc,
										status: "running" as const,
										startedAt: new Date().toISOString(),
									}
								: tc,
						);

						return {
							...prev,
							currentTest: data.testCaseId,
							testCases: updatedTestCases,
							// biome-ignore lint/suspicious/noExplicitAny: type assertion for state update
						} as any;
					});
				} else if (
					event.type === "test_case_completed" &&
					data.evaluationId === evaluationId
				) {
					setProgress((prev) => {
						if (!prev) return prev;

						const updatedTestCases = prev.testCases.map((tc) =>
							tc.id === data.testCaseId
								? {
										...tc,
										status: "completed" as const,
										score: data.score,
										completedAt: new Date().toISOString(),
									}
								: tc,
						);

						return {
							...prev,
							completedTests: prev.completedTests + 1,
							passedTests: prev.passedTests + (data.passed ? 1 : 0),
							testCases: updatedTestCases,
							// biome-ignore lint/suspicious/noExplicitAny: type assertion for state update
						} as any;
					});
				} else if (
					event.type === "test_case_failed" &&
					data.evaluationId === evaluationId
				) {
					setProgress((prev) => {
						if (!prev) return prev;

						const updatedTestCases = prev.testCases.map((tc) =>
							tc.id === data.testCaseId
								? {
										...tc,
										status: "failed" as const,
										error: data.error,
										completedAt: new Date().toISOString(),
									}
								: tc,
						);

						return {
							...prev,
							completedTests: prev.completedTests + 1,
							failedTests: prev.failedTests + 1,
							testCases: updatedTestCases,
							// biome-ignore lint/suspicious/noExplicitAny: type assertion for state update
						} as any;
					});
				}
			} catch (error) {
				logger.warn("Failed to parse progress message", { error });
			}
		};

		eventSource.onerror = () => {
			setIsConnected(false);
		};

		return () => {
			eventSource.close();
			setIsConnected(false);
		};
	}, [organizationId, evaluationId, isPaused]);

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "running":
				return <Activity className="h-4 w-4 animate-pulse" />;
			case "completed":
				return <CheckCircle className="h-4 w-4 text-green-500" />;
			case "failed":
				return <XCircle className="h-4 w-4 text-red-500" />;
			default:
				return <Clock className="h-4 w-4 text-gray-500" />;
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "running":
				return "text-blue-600";
			case "completed":
				return "text-green-600";
			case "failed":
				return "text-red-600";
			default:
				return "text-gray-600";
		}
	};

	const getTestCaseIcon = (status: string) => {
		switch (status) {
			case "running":
				return <Activity className="h-3 w-3 animate-pulse text-blue-500" />;
			case "completed":
				return <CheckCircle className="h-3 w-3 text-green-500" />;
			case "failed":
				return <XCircle className="h-3 w-3 text-red-500" />;
			default:
				return <Clock className="h-3 w-3 text-gray-400" />;
		}
	};

	const getProgressTrend = () => {
		const history = progressHistoryRef.current;
		if (history.length < 2) return "stable";

		const recent = history.slice(-5);
		const earlier = history.slice(-10, -5);

		if (earlier.length === 0) return "stable";

		const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
		const earlierAvg =
			earlier.reduce((sum, val) => sum + val, 0) / earlier.length;

		if (recentAvg > earlierAvg + 5) return "improving";
		if (recentAvg < earlierAvg - 5) return "declining";
		return "stable";
	};

	const getTrendIcon = (trend: string) => {
		switch (trend) {
			case "improving":
				return <TrendingUp className="h-3 w-3 text-green-500" />;
			case "declining":
				return <TrendingDown className="h-3 w-3 text-red-500" />;
			default:
				return <Minus className="h-3 w-3 text-gray-500" />;
		}
	};

	const formatDuration = (startedAt?: string, completedAt?: string) => {
		if (!startedAt) return "-";

		const start = new Date(startedAt).getTime();
		const end = completedAt ? new Date(completedAt).getTime() : Date.now();
		const duration = end - start;

		return `${(duration / 1000).toFixed(1)}s`;
	};

	if (!isVisible) {
		return (
			<Button
				variant="outline"
				size="sm"
				onClick={() => setIsVisible(true)}
				className={className}
			>
				<Eye className="h-4 w-4 mr-2" />
				Show Progress
			</Button>
		);
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader className={cn("pb-3", compact && "pb-2")}>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						{getStatusIcon(progress?.status || "pending")}
						<div>
							<CardTitle className={cn("text-lg", compact && "text-base")}>
								Live Progress
							</CardTitle>
							{!compact && (
								<CardDescription>
									Real-time evaluation progress tracking
								</CardDescription>
							)}
						</div>
					</div>

					<div className="flex items-center gap-2">
						<div
							className={cn(
								"w-2 h-2 rounded-full",
								isConnected ? "bg-green-500" : "bg-red-500",
							)}
						/>

						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsPaused(!isPaused)}
						>
							{isPaused ? (
								<Play className="h-4 w-4" />
							) : (
								<Pause className="h-4 w-4" />
							)}
						</Button>

						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsVisible(false)}
						>
							<EyeOff className="h-4 w-4" />
						</Button>

						{showDetails && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									// Refresh progress
									if (progress) {
										setProgress({ ...progress });
									}
								}}
							>
								<RotateCcw className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>
			</CardHeader>

			<CardContent className={cn("space-y-4", compact && "space-y-2")}>
				{/* Progress Bar */}
				<div className="space-y-2">
					<div className="flex items-center justify-between text-sm">
						<span className="font-medium">Overall Progress</span>
						<div className="flex items-center gap-2">
							<span className={getStatusColor(progress?.status || "pending")}>
								{progress?.progress || 0}%
							</span>
							{getTrendIcon(getProgressTrend())}
						</div>
					</div>
					<Progress value={progress?.progress || 0} className="h-2" />
					<div className="flex items-center justify-between text-xs text-gray-500">
						<span>
							{progress?.completedTests || 0} / {progress?.totalTests || 0}{" "}
							tests
						</span>
						<span>
							{formatDuration(progress?.startedAt, progress?.completedAt)}
						</span>
					</div>
				</div>

				{/* Status Badges */}
				<div className="flex items-center gap-2">
					<Badge
						variant={
							progress?.passedTests === progress?.completedTests
								? "default"
								: "secondary"
						}
					>
						<CheckCircle className="h-3 w-3 mr-1" />
						{progress?.passedTests || 0} Passed
					</Badge>

					{progress?.failedTests && progress.failedTests > 0 && (
						<Badge variant="destructive">
							<XCircle className="h-3 w-3 mr-1" />
							{progress.failedTests} Failed
						</Badge>
					)}

					<Badge variant="outline">
						<Zap className="h-3 w-3 mr-1" />
						{progress?.totalTests || 0} Total
					</Badge>
				</div>

				{showDetails && progress?.currentTest && (
					<>
						<Separator />
						<div className="space-y-2">
							<div className="flex items-center gap-2 text-sm">
								<Activity className="h-4 w-4 animate-pulse text-blue-500" />
								<span className="font-medium">
									Current: {progress.currentTest}
								</span>
							</div>

							{/* Test Case List */}
							<div className="space-y-1 max-h-32 overflow-y-auto">
								{progress.testCases.slice(-5).map((testCase) => (
									<div
										key={testCase.id}
										className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
									>
										<div className="flex items-center gap-2">
											{getTestCaseIcon(testCase.status)}
											<span className="truncate max-w-[200px]">
												{testCase.name}
											</span>
										</div>
										<div className="flex items-center gap-2">
											{testCase.score !== undefined && (
												<span className="font-medium">{testCase.score}</span>
											)}
											<span className="text-gray-500">
												{formatDuration(
													testCase.startedAt,
													testCase.completedAt,
												)}
											</span>
										</div>
									</div>
								))}
							</div>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
