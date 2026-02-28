"use client";

import {
	AlertTriangle,
	Bug,
	ChevronRight,
	Lightbulb,
	Loader2,
	X,
} from "lucide-react";
// src/components/debug-panel.tsx
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { handleError } from "@/lib/utils/error-handling";

interface FailurePattern {
	pattern: string;
	occurrences: number;
	affectedTestIds: number[];
	category: string;
}

interface SuggestedFix {
	type: string;
	description: string;
	confidence: number;
	diff?: { before: string; after: string };
}

interface DebugAnalysis {
	runId: number;
	summary: string;
	failurePatterns: FailurePattern[];
	suggestedFixes: SuggestedFix[];
	rootCauses: string[];
	severity: string;
}

interface DebugPanelProps {
	evaluationId: number;
	runId: number;
	onClose?: () => void;
}

export function DebugPanel({ evaluationId, runId, onClose }: DebugPanelProps) {
	const [analysis, setAnalysis] = useState<DebugAnalysis | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const runAnalysis = async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(
				`/api/evaluations/${evaluationId}/runs/${runId}/debug`,
				{
					method: "POST",
				},
			);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error);
			setAnalysis(data);
		} catch (e: unknown) {
			setError(handleError(e));
		} finally {
			setLoading(false);
		}
	};

	const severityColor: Record<string, string> = {
		low: "text-blue-400 border-blue-400/30",
		medium: "text-yellow-400 border-yellow-400/30",
		high: "text-orange-400 border-orange-400/30",
		critical: "text-red-400 border-red-400/30",
	};

	const fixTypeIcon: Record<string, string> = {
		prompt_edit: "✏️",
		parameter_change: "⚙️",
		model_switch: "🔄",
		data_fix: "🗃️",
	};

	return (
		<div className="fixed right-0 top-0 h-full w-[420px] bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 flex flex-col overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b border-zinc-800">
				<div className="flex items-center gap-2">
					<Bug className="h-5 w-5 text-purple-500" />
					<span className="font-semibold text-sm">Debug Agent</span>
					<Badge variant="outline" className="text-xs">
						Run #{runId}
					</Badge>
				</div>
				{onClose && (
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				)}
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{!analysis && !loading && (
					<div className="text-center py-12">
						<Bug className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
						<p className="text-sm text-zinc-500 mb-4">
							Analyze this run to identify failure patterns and get AI-powered
							fix suggestions.
						</p>
						<Button
							onClick={runAnalysis}
							className="bg-purple-600 hover:bg-purple-700"
						>
							<Bug className="h-4 w-4 mr-2" /> Analyze Failures
						</Button>
					</div>
				)}

				{loading && (
					<div className="text-center py-12">
						<Loader2 className="h-8 w-8 text-purple-500 mx-auto mb-4 animate-spin" />
						<p className="text-sm text-zinc-400">Analyzing failures…</p>
					</div>
				)}

				{error && (
					<Card className="bg-red-500/10 border-red-500/30">
						<CardContent className="pt-4 text-red-400 text-sm">
							{error}
						</CardContent>
					</Card>
				)}

				{analysis && (
					<>
						{/* Summary */}
						<Card className="bg-zinc-900/50 border-zinc-800">
							<CardContent className="pt-4">
								<div className="flex items-start gap-2">
									<Badge
										variant="outline"
										className={`text-xs ${severityColor[analysis.severity] || ""}`}
									>
										{analysis.severity}
									</Badge>
								</div>
								<p className="text-sm text-zinc-300 mt-2">{analysis.summary}</p>
							</CardContent>
						</Card>

						{/* Failure Patterns */}
						{analysis.failurePatterns.length > 0 && (
							<Card className="bg-zinc-900/50 border-zinc-800">
								<CardHeader className="pb-2">
									<CardTitle className="text-sm flex items-center gap-2">
										<AlertTriangle className="h-4 w-4 text-orange-500" />{" "}
										Failure Patterns
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									{analysis.failurePatterns.map((fp, _i) => (
										<div
											key={`${fp.category}-${fp.pattern}`}
											className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0"
										>
											<div>
												<Badge variant="outline" className="text-xs mr-2">
													{fp.category}
												</Badge>
												<span className="text-xs text-zinc-400">
													{fp.pattern}
												</span>
											</div>
											<span className="text-xs text-zinc-500">
												{fp.occurrences}×
											</span>
										</div>
									))}
								</CardContent>
							</Card>
						)}

						{/* Root Causes */}
						{analysis.rootCauses.length > 0 && (
							<Card className="bg-zinc-900/50 border-zinc-800">
								<CardHeader className="pb-2">
									<CardTitle className="text-sm flex items-center gap-2">
										<ChevronRight className="h-4 w-4 text-blue-500" /> Root
										Causes
									</CardTitle>
								</CardHeader>
								<CardContent>
									<ul className="space-y-1">
										{analysis.rootCauses.map((cause, i) => (
											<li
												key={`cause-${i}`}
												className="text-xs text-zinc-400 flex items-start gap-2"
											>
												<span className="text-blue-500 mt-0.5">•</span> {cause}
											</li>
										))}
									</ul>
								</CardContent>
							</Card>
						)}

						{/* Suggested Fixes */}
						{analysis.suggestedFixes.length > 0 && (
							<Card className="bg-zinc-900/50 border-zinc-800">
								<CardHeader className="pb-2">
									<CardTitle className="text-sm flex items-center gap-2">
										<Lightbulb className="h-4 w-4 text-yellow-500" /> Suggested
										Fixes
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									{analysis.suggestedFixes.map((fix, i) => (
										<div
											key={`fix-${fix.type}-${i}`}
											className="p-3 bg-zinc-800/50 rounded-lg"
										>
											<div className="flex items-center justify-between mb-1">
												<span className="text-xs">
													{fixTypeIcon[fix.type] || "💡"}{" "}
													{fix.type.replace("_", " ")}
												</span>
												<Badge variant="outline" className="text-xs">
													{Math.round(fix.confidence * 100)}% confident
												</Badge>
											</div>
											<p className="text-xs text-zinc-300">{fix.description}</p>
											{fix.diff && (
												<div className="mt-2 text-xs font-mono">
													<div className="bg-red-500/10 text-red-400 p-1 rounded-t">
														- {fix.diff.before}
													</div>
													<div className="bg-green-500/10 text-green-400 p-1 rounded-b">
														+ {fix.diff.after}
													</div>
												</div>
											)}
										</div>
									))}
								</CardContent>
							</Card>
						)}

						{/* Re-run button */}
						<Button
							onClick={runAnalysis}
							variant="outline"
							className="w-full text-xs"
						>
							<Bug className="h-3 w-3 mr-1" /> Re-analyze
						</Button>
					</>
				)}
			</div>
		</div>
	);
}
