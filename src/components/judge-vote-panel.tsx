/**
 * Judge Vote Panel — Multi-judge aggregation display (Phase 4).
 *
 * Shows each judge's individual vote, the aggregation strategy, agreement
 * statistics, and the final score so users can audit judge consensus.
 */

import { CheckCircle2, MinusCircle, Scale, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
	AggregatedJudgeResult,
	AggregationStrategy,
	JudgeVote,
} from "@/lib/judges/aggregation";

export interface JudgeVotePanelProps {
	result: AggregatedJudgeResult;
	className?: string;
}

function voteIcon(score: number) {
	if (score >= 0.7)
		return (
			<CheckCircle2 className="h-3.5 w-3.5 text-green-400" aria-label="pass" />
		);
	if (score >= 0.4)
		return (
			<MinusCircle
				className="h-3.5 w-3.5 text-yellow-400"
				aria-label="partial"
			/>
		);
	return <XCircle className="h-3.5 w-3.5 text-red-400" aria-label="fail" />;
}

function voteBucket(score: number): string {
	if (score >= 0.7) return "Pass";
	if (score >= 0.4) return "Partial";
	return "Fail";
}

function strategyLabel(s: AggregationStrategy): string {
	const map: Record<AggregationStrategy, string> = {
		median: "Median",
		mean: "Mean",
		weighted_mean: "Weighted Mean",
		majority_vote: "Majority Vote",
		min: "Min",
		max: "Max",
	};
	return map[s];
}

function agreementColor(ratio: number): string {
	if (ratio >= 0.8) return "text-green-400";
	if (ratio >= 0.5) return "text-yellow-400";
	return "text-red-400";
}

export function JudgeVotePanel({ result, className }: JudgeVotePanelProps) {
	const finalPct = Math.round(result.finalScore * 100);
	const agreementPct = Math.round(result.agreementStats.agreementRatio * 100);

	return (
		<Card className={`w-full ${className ?? ""}`}>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-1.5">
						<Scale className="h-4 w-4 text-zinc-400" />
						<CardTitle className="text-sm font-medium text-zinc-200">
							Judge Panel
						</CardTitle>
					</div>
					<div className="flex items-center gap-2">
						<Badge
							variant="outline"
							className="text-[11px] text-zinc-400 border-zinc-700"
						>
							{strategyLabel(result.strategy)}
						</Badge>
						{result.highConfidence ? (
							<Badge className="bg-green-500/10 text-green-400 border border-green-500/30 text-[11px]">
								High confidence
							</Badge>
						) : (
							<Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 text-[11px]">
								Low confidence
							</Badge>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				{/* Per-judge votes */}
				<div className="space-y-1.5">
					{result.votes.map((vote: JudgeVote) => (
						<div
							key={vote.judgeId}
							className="flex items-center justify-between rounded-md bg-zinc-900 px-3 py-1.5"
						>
							<div className="flex items-center gap-2">
								{voteIcon(vote.score)}
								<span className="text-xs text-zinc-300 font-mono">
									{vote.judgeId}
								</span>
								{vote.weight !== undefined && vote.weight !== 1 && (
									<span className="text-[11px] text-zinc-500">
										×{vote.weight}
									</span>
								)}
							</div>
							<div className="flex items-center gap-2">
								<span className="text-xs text-zinc-400">
									{voteBucket(vote.score)}
								</span>
								<span className="text-xs font-semibold text-zinc-200 w-10 text-right">
									{Math.round(vote.score * 100)}%
								</span>
							</div>
						</div>
					))}
				</div>

				{/* Footer: agreement + final */}
				<div className="flex items-center justify-between border-t border-zinc-800 pt-2">
					<span
						className={`text-xs ${agreementColor(result.agreementStats.agreementRatio)}`}
					>
						{agreementPct}% agreement
					</span>
					<div className="flex items-center gap-1">
						<span className="text-xs text-zinc-400">Final:</span>
						<span className="text-sm font-bold text-white">{finalPct}%</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
