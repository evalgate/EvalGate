// src/app/report/[slug]/page.tsx

import { eq } from "drizzle-orm";
import { BarChart3, CheckCircle, Clock, Shield, XCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { reportCards } from "@/db/schema";

export default async function ReportPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;

	const [report] = await db
		.select()
		.from(reportCards)
		.where(eq(reportCards.slug, slug))
		.limit(1);

	if (!report || !report.isPublic) return notFound();

	// Increment view count
	await db
		.update(reportCards)
		.set({ viewCount: (report.viewCount || 0) + 1 })
		.where(eq(reportCards.id, report.id));

	const data =
		typeof report.reportData === "string"
			? JSON.parse(report.reportData)
			: report.reportData;

	return (
		<div className="min-h-screen bg-gradient-to-br from-zinc-950 to-zinc-900 text-white">
			<div className="max-w-3xl mx-auto py-16 px-6">
				{/* Header */}
				<div className="text-center mb-12">
					<div className="flex items-center justify-center gap-2 mb-4">
						<Shield className="h-8 w-8 text-blue-500" />
						<span className="text-sm font-mono text-zinc-400 uppercase tracking-wider">
							Evaluation Report Card
						</span>
					</div>
					<h1 className="text-3xl font-bold mb-2">{report.title}</h1>
					<p className="text-zinc-400">{report.description}</p>
					<p className="text-xs text-zinc-600 mt-2">
						<Clock className="inline h-3 w-3 mr-1" />
						Generated {new Date(report.createdAt).toLocaleDateString()}
					</p>
				</div>

				{/* Score Hero */}
				<Card className="bg-zinc-900/50 border-zinc-800 mb-8">
					<CardContent className="pt-8 pb-8">
						<div className="flex items-center justify-center gap-12">
							<div className="text-center">
								<div className="text-6xl font-bold text-green-400">
									{data.passRate ?? 0}%
								</div>
								<div className="text-sm text-zinc-500 mt-1">Pass Rate</div>
							</div>
							<div className="h-20 w-px bg-zinc-800" />
							<div className="text-center">
								<div className="text-4xl font-bold">
									{data.averageScore ?? 0}
								</div>
								<div className="text-sm text-zinc-500 mt-1">Avg Score</div>
							</div>
							<div className="h-20 w-px bg-zinc-800" />
							<div className="text-center">
								<div className="text-4xl font-bold">{data.totalRuns ?? 0}</div>
								<div className="text-sm text-zinc-500 mt-1">Total Runs</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Results Grid */}
				<div className="grid grid-cols-2 gap-4 mb-8">
					<Card className="bg-green-500/10 border-green-500/20">
						<CardContent className="pt-6 flex items-center gap-3">
							<CheckCircle className="h-8 w-8 text-green-500" />
							<div>
								<div className="text-2xl font-bold text-green-400">
									{data.completedRuns ?? 0}
								</div>
								<div className="text-xs text-zinc-500">Completed</div>
							</div>
						</CardContent>
					</Card>
					<Card className="bg-red-500/10 border-red-500/20">
						<CardContent className="pt-6 flex items-center gap-3">
							<XCircle className="h-8 w-8 text-red-500" />
							<div>
								<div className="text-2xl font-bold text-red-400">
									{(data.totalRuns ?? 0) - (data.completedRuns ?? 0)}
								</div>
								<div className="text-xs text-zinc-500">Failed</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Performance Details */}
				{data.performance && (
					<Card className="bg-zinc-900/50 border-zinc-800 mb-8">
						<CardHeader>
							<CardTitle className="text-base flex items-center gap-2">
								<BarChart3 className="h-4 w-4" /> Performance Breakdown
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<span className="text-zinc-500">Avg Duration</span>
									<div className="font-mono">
										{Math.round(data.averageDuration ?? 0)}ms
									</div>
								</div>
								<div>
									<span className="text-zinc-500">Total Cost</span>
									<div className="font-mono">
										${(data.totalCost ?? 0).toFixed(4)}
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Footer */}
				<div className="text-center text-xs text-zinc-600 mt-12">
					<p>
						Verified by <span className="text-blue-400">EvalGate Platform</span>
					</p>
					<p className="mt-1">
						{data.evaluationType ?? "evaluation"} · {report.viewCount || 0}{" "}
						views
					</p>
				</div>
			</div>
		</div>
	);
}
