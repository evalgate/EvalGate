/**
 * Coverage Gap List — Dataset coverage gap display (Phase 2A).
 *
 * Renders the untested behavior gaps identified by the coverage model
 * so users can prioritize which new test cases to write.
 */

import { Layers, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CoverageGap, CoverageModel } from "@/lib/dataset/coverage-model";

export interface CoverageGapListProps {
	model: CoverageModel;
	/** Max gaps to display (default: 5) */
	maxVisible?: number;
	className?: string;
}

function importanceLabel(importance: number): string {
	if (importance >= 0.8) return "Critical";
	if (importance >= 0.6) return "High";
	if (importance >= 0.4) return "Medium";
	return "Low";
}

function importanceBadgeClass(importance: number): string {
	if (importance >= 0.8) return "bg-red-500/10 text-red-400 border-red-500/30";
	if (importance >= 0.6)
		return "bg-orange-500/10 text-orange-400 border-orange-500/30";
	if (importance >= 0.4)
		return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
	return "bg-zinc-700/50 text-zinc-400 border-zinc-600";
}

function coverageRatioColor(ratio: number): string {
	if (ratio >= 0.7) return "text-green-400";
	if (ratio >= 0.4) return "text-yellow-400";
	return "text-red-400";
}

export function CoverageGapList({
	model,
	maxVisible = 5,
	className,
}: CoverageGapListProps) {
	const visibleGaps = model.gaps.slice(0, maxVisible);
	const coveragePct = Math.round(model.coverageRatio * 100);

	return (
		<Card className={`w-full ${className ?? ""}`}>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-1.5">
						<Layers className="h-4 w-4 text-zinc-400" />
						<CardTitle className="text-sm font-medium text-zinc-200">
							Coverage Gaps
						</CardTitle>
					</div>
					<div className="flex items-center gap-2">
						<span
							className={`text-sm font-semibold ${coverageRatioColor(model.coverageRatio)}`}
						>
							{coveragePct}% covered
						</span>
						<Badge
							variant="outline"
							className="text-[11px] text-zinc-400 border-zinc-700"
						>
							{model.totalTestCases} test{model.totalTestCases !== 1 ? "s" : ""}
						</Badge>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{visibleGaps.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-6 gap-2 text-zinc-500">
						<SearchX className="h-8 w-8 opacity-40" />
						<p className="text-sm">No coverage gaps detected</p>
					</div>
				) : (
					<div className="space-y-3">
						{visibleGaps.map((gap: CoverageGap) => (
							<div key={gap.id} className="space-y-1">
								<div className="flex items-start justify-between gap-2">
									<p className="text-xs text-zinc-300 leading-relaxed flex-1">
										{gap.description}
									</p>
									<Badge
										className={`shrink-0 border text-[10px] ${importanceBadgeClass(gap.importance)}`}
									>
										{importanceLabel(gap.importance)}
									</Badge>
								</div>
								<Progress
									value={Math.round(gap.importance * 100)}
									className="h-1 bg-zinc-800"
									aria-label={`Gap importance ${Math.round(gap.importance * 100)}%`}
								/>
							</div>
						))}
						{model.gaps.length > maxVisible && (
							<p className="text-[11px] text-zinc-500 pt-1">
								+{model.gaps.length - maxVisible} more gap
								{model.gaps.length - maxVisible > 1 ? "s" : ""} — run full
								report to see all
							</p>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
