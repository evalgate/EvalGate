/**
 * Score Layer Breakdown — Three-layer scoring display (Phase 3).
 *
 * Shows reasoning, action, and outcome layer scores with weighted contribution
 * bars so users understand WHY a composite score landed where it did.
 */

import { Brain, Target, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface LayerScore {
	score: number;
	evidenceAvailable: boolean;
	notes?: string[];
}

export interface ScoreLayerBreakdownProps {
	reasoning: LayerScore;
	action: LayerScore;
	outcome: LayerScore;
	/** Composite weighted score 0-1 (optional — computed from layers if absent) */
	composite?: number;
	className?: string;
}

const LAYERS = [
	{
		key: "reasoning" as const,
		label: "Reasoning",
		icon: Brain,
		description: "Chain-of-thought quality, self-critique, confidence",
		color: "bg-violet-500",
		textColor: "text-violet-400",
	},
	{
		key: "action" as const,
		label: "Action",
		icon: Target,
		description: "Tool call efficiency, sequencing, error recovery",
		color: "bg-blue-500",
		textColor: "text-blue-400",
	},
	{
		key: "outcome" as const,
		label: "Outcome",
		icon: Trophy,
		description: "Assertion results, completion status, output quality",
		color: "bg-emerald-500",
		textColor: "text-emerald-400",
	},
] as const;

function scoreLabel(score: number): string {
	if (score >= 0.85) return "Excellent";
	if (score >= 0.7) return "Good";
	if (score >= 0.5) return "Fair";
	if (score >= 0.3) return "Poor";
	return "Critical";
}

function scoreBadgeVariant(score: number): string {
	if (score >= 0.7) return "bg-green-500/10 text-green-400 border-green-500/30";
	if (score >= 0.5)
		return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
	return "bg-red-500/10 text-red-400 border-red-500/30";
}

export function ScoreLayerBreakdown({
	reasoning,
	action,
	outcome,
	composite,
	className,
}: ScoreLayerBreakdownProps) {
	const layers = { reasoning, action, outcome };
	const compositeScore =
		composite ?? (reasoning.score + action.score + outcome.score) / 3;

	return (
		<Card className={`w-full ${className ?? ""}`}>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm font-medium text-zinc-200">
						Score Breakdown
					</CardTitle>
					<div className="flex items-center gap-2">
						<span className="text-2xl font-bold text-white">
							{Math.round(compositeScore * 100)}
						</span>
						<span className="text-zinc-400 text-sm">/100</span>
						<Badge
							className={`border text-xs ${scoreBadgeVariant(compositeScore)}`}
						>
							{scoreLabel(compositeScore)}
						</Badge>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{LAYERS.map(
					({ key, label, icon: Icon, description, color, textColor }) => {
						const layer = layers[key];
						const pct = Math.round(layer.score * 100);
						return (
							<div key={key} className="space-y-1.5">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-1.5">
										<Icon className={`h-3.5 w-3.5 ${textColor}`} />
										<span className="text-xs font-medium text-zinc-300">
											{label}
										</span>
										{!layer.evidenceAvailable && (
											<Badge
												variant="outline"
												className="text-[10px] py-0 h-4 text-zinc-500 border-zinc-700"
											>
												estimated
											</Badge>
										)}
									</div>
									<span className={`text-xs font-semibold ${textColor}`}>
										{pct}%
									</span>
								</div>
								<Progress
									value={pct}
									className="h-1.5 bg-zinc-800"
									aria-label={`${label} score ${pct}%`}
								/>
								<p className="text-[11px] text-zinc-500">{description}</p>
							</div>
						);
					},
				)}
			</CardContent>
		</Card>
	);
}
