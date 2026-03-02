/**
 * Drift Severity Badge — Behavioral drift indicator (Phase 7).
 *
 * Renders a color-coded badge with optional signal breakdown tooltip
 * so users can spot behavioral regressions at a glance.
 */

import { Activity, AlertTriangle, CheckCircle2, XOctagon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
	BehavioralDriftResult,
	BehavioralDriftSignal,
} from "@/lib/drift/behavioral-drift";

export interface DriftSeverityBadgeProps {
	result: BehavioralDriftResult;
	/** Show top signal descriptions below the badge */
	showSignals?: boolean;
	className?: string;
}

type Severity = "none" | "low" | "medium" | "high" | "critical";

function computeOverallSeverity(result: BehavioralDriftResult): Severity {
	if (!result.driftDetected) return "none";
	const levels: Severity[] = result.signals.map(
		(s: BehavioralDriftSignal) => s.severity as Severity,
	);
	if (levels.includes("critical")) return "critical";
	if (levels.includes("high")) return "high";
	if (levels.includes("medium")) return "medium";
	return "low";
}

const SEVERITY_CONFIG: Record<
	Severity,
	{ label: string; className: string; icon: React.ReactNode }
> = {
	none: {
		label: "No drift",
		className: "bg-green-500/10 text-green-400 border border-green-500/30",
		icon: <CheckCircle2 className="h-3 w-3" />,
	},
	low: {
		label: "Minor drift",
		className: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30",
		icon: <Activity className="h-3 w-3" />,
	},
	medium: {
		label: "Moderate drift",
		className: "bg-orange-500/10 text-orange-400 border border-orange-500/30",
		icon: <AlertTriangle className="h-3 w-3" />,
	},
	high: {
		label: "High drift",
		className: "bg-red-500/10 text-red-400 border border-red-500/30",
		icon: <AlertTriangle className="h-3 w-3" />,
	},
	critical: {
		label: "Critical drift",
		className: "bg-red-700/20 text-red-300 border border-red-600/40",
		icon: <XOctagon className="h-3 w-3" />,
	},
};

export function DriftSeverityBadge({
	result,
	showSignals = false,
	className,
}: DriftSeverityBadgeProps) {
	const severity = computeOverallSeverity(result);
	const { label, className: severityClass, icon } = SEVERITY_CONFIG[severity];

	return (
		<div className={`inline-flex flex-col gap-1.5 ${className ?? ""}`}>
			<Badge className={`gap-1 text-xs ${severityClass}`}>
				{icon}
				{label}
				{result.signals.length > 0 && (
					<span className="ml-1 opacity-70">({result.signals.length})</span>
				)}
			</Badge>

			{showSignals && result.signals.length > 0 && (
				<ul className="space-y-1 pl-1">
					{result.signals.slice(0, 3).map((signal: BehavioralDriftSignal) => (
						<li
							key={`${signal.type}-${signal.description}`}
							className="text-[11px] text-zinc-400 flex items-start gap-1"
						>
							<span
								className={
									signal.severity === "critical" || signal.severity === "high"
										? "text-red-400"
										: "text-yellow-400"
								}
							>
								·
							</span>
							{signal.description}
						</li>
					))}
					{result.signals.length > 3 && (
						<li className="text-[11px] text-zinc-500">
							+{result.signals.length - 3} more signal
							{result.signals.length - 3 > 1 ? "s" : ""}
						</li>
					)}
				</ul>
			)}
		</div>
	);
}
