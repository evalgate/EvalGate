/**
 * Failure Confidence Badge — Failure classification display (Phase 1.2).
 *
 * Shows the detected failure category and the detector's confidence level
 * so users understand how certain the automated classification is.
 */

import { AlertCircle, ShieldAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AggregatedConfidence } from "@/lib/failures/confidence";
import type { FailureCategory } from "@/lib/failures/taxonomy";

export interface FailureConfidenceBadgeProps {
	result: AggregatedConfidence;
	/** Show agreement details (detector count) */
	showAgreement?: boolean;
	className?: string;
}

const CATEGORY_LABELS: Record<FailureCategory, string> = {
	hallucination: "Hallucination",
	refusal: "Refusal",
	format_error: "Format Error",
	reasoning_failure: "Reasoning Failure",
	tool_misuse: "Tool Misuse",
	compliance_violation: "Compliance",
	latency_spike: "Latency Spike",
	cost_overrun: "Cost Overrun",
	unknown: "Unknown",
};

function confidenceColor(confidence: number): string {
	if (confidence >= 0.8) return "bg-red-500/15 text-red-400 border-red-500/30";
	if (confidence >= 0.55)
		return "bg-orange-500/15 text-orange-400 border-orange-500/30";
	return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
}

function confidenceLabel(confidence: number): string {
	if (confidence >= 0.8) return "High confidence";
	if (confidence >= 0.55) return "Medium confidence";
	return "Low confidence";
}

export function FailureConfidenceBadge({
	result,
	showAgreement = false,
	className,
}: FailureConfidenceBadgeProps) {
	const pct = Math.round(result.confidence * 100);
	const categoryLabel =
		CATEGORY_LABELS[result.category as FailureCategory] ?? result.category;

	return (
		<div
			className={`inline-flex flex-wrap items-center gap-1.5 ${className ?? ""}`}
		>
			<Badge
				className={`gap-1 border text-xs ${confidenceColor(result.confidence)}`}
			>
				<AlertCircle className="h-3 w-3" />
				{categoryLabel}
			</Badge>

			<Badge
				variant="outline"
				className="text-[11px] text-zinc-400 border-zinc-700 gap-1"
				title={confidenceLabel(result.confidence)}
			>
				<ShieldAlert className="h-3 w-3" />
				{pct}%
			</Badge>

			{showAgreement && (
				<Badge
					variant="outline"
					className="text-[11px] text-zinc-500 border-zinc-800 gap-1"
				>
					<Users className="h-3 w-3" />
					{result.agreementCount}/{result.totalDetectors} detectors
				</Badge>
			)}
		</div>
	);
}
