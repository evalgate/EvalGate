"use client";

import {
	AlertTriangle,
	Bot,
	Check,
	ChevronDown,
	ChevronRight,
	Clock,
	GitBranch,
	Lightbulb,
	Target,
	X,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface DecisionAlternative {
	action: string;
	confidence: number;
	reasoning?: string;
	rejectedReason?: string;
}

export interface Decision {
	id: number;
	agentName: string;
	decisionType: "action" | "tool" | "delegate" | "respond" | "route";
	chosen: string;
	alternatives: DecisionAlternative[];
	reasoning?: string;
	confidence?: number;
	inputContext?: Record<string, unknown>;
	timestamp?: string;
	spanName?: string;
}

export interface DecisionTreeProps {
	decisions: Decision[];
	className?: string;
	onDecisionClick?: (decision: Decision) => void;
	selectedDecisionId?: number;
	showAlternatives?: boolean;
	expandAll?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

function getConfidenceColor(confidence: number): string {
	if (confidence >= 80) return "text-green-500";
	if (confidence >= 50) return "text-amber-500";
	return "text-red-500";
}

function getConfidenceBgColor(confidence: number): string {
	if (confidence >= 80) return "bg-green-500/10";
	if (confidence >= 50) return "bg-amber-500/10";
	return "bg-red-500/10";
}

function getDecisionTypeIcon(type: Decision["decisionType"]) {
	switch (type) {
		case "tool":
			return <Target className="h-4 w-4" />;
		case "delegate":
			return <Bot className="h-4 w-4" />;
		case "route":
			return <GitBranch className="h-4 w-4" />;
		case "respond":
			return <Lightbulb className="h-4 w-4" />;
		default:
			return <Check className="h-4 w-4" />;
	}
}

// ============================================================================
// COMPONENTS
// ============================================================================

function DecisionNode({
	decision,
	isSelected,
	onClick,
	showAlternatives = true,
	defaultExpanded = false,
}: {
	decision: Decision;
	isSelected?: boolean;
	onClick?: () => void;
	showAlternatives?: boolean;
	defaultExpanded?: boolean;
}) {
	const [isOpen, setIsOpen] = React.useState(defaultExpanded);
	const hasAlternatives =
		decision.alternatives && decision.alternatives.length > 0;

	return (
		<div
			className={cn(
				"border rounded-lg transition-all",
				isSelected && "border-primary ring-2 ring-primary/20",
				onClick && "cursor-pointer hover:border-primary/50",
			)}
			onClick={onClick}
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
			onKeyDown={
				onClick
					? (e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								onClick();
							}
						}
					: undefined
			}
		>
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<div className="p-4">
					{/* Header */}
					<div className="flex items-start justify-between">
						<div className="flex items-center gap-3">
							<div
								className={cn(
									"p-2 rounded-lg",
									getConfidenceBgColor(decision.confidence || 0),
								)}
							>
								{getDecisionTypeIcon(decision.decisionType)}
							</div>
							<div>
								<div className="flex items-center gap-2">
									<span className="font-medium">{decision.agentName}</span>
									<Badge variant="outline" className="text-xs">
										{decision.decisionType}
									</Badge>
								</div>
								<div className="flex items-center gap-2 mt-1">
									<span className="text-sm">chose</span>
									<Badge className="bg-primary/10 text-primary hover:bg-primary/20">
										{decision.chosen}
									</Badge>
								</div>
							</div>
						</div>

						<div className="flex items-center gap-3">
							{decision.confidence !== undefined && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<div
												className={cn(
													"flex items-center gap-1 text-sm font-medium",
													getConfidenceColor(decision.confidence),
												)}
											>
												{decision.confidence}%
											</div>
										</TooltipTrigger>
										<TooltipContent>
											<p>Confidence score</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}

							{hasAlternatives && showAlternatives && (
								<CollapsibleTrigger asChild>
									<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
										{isOpen ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
									</Button>
								</CollapsibleTrigger>
							)}
						</div>
					</div>

					{/* Reasoning */}
					{decision.reasoning && (
						<div className="mt-3 p-3 bg-muted rounded-lg">
							<p className="text-sm text-muted-foreground">
								<span className="font-medium">Reasoning:</span>{" "}
								{decision.reasoning}
							</p>
						</div>
					)}

					{/* Timestamp */}
					{decision.timestamp && (
						<div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
							<Clock className="h-3 w-3" />
							{new Date(decision.timestamp).toLocaleString()}
						</div>
					)}
				</div>

				{/* Alternatives */}
				{hasAlternatives && showAlternatives && (
					<CollapsibleContent>
						<div className="border-t px-4 py-3 bg-muted/30">
							<p className="text-xs font-medium text-muted-foreground mb-2">
								Alternatives Considered ({decision.alternatives.length})
							</p>
							<div className="space-y-2">
								{decision.alternatives.map((alt) => (
									<div
										key={`${alt.action}-${alt.confidence}`}
										className="flex items-center justify-between p-2 bg-background rounded-lg border"
									>
										<div className="flex items-center gap-2">
											<X className="h-4 w-4 text-muted-foreground" />
											<span className="text-sm">{alt.action}</span>
										</div>
										<div className="flex items-center gap-3">
											{alt.rejectedReason && (
												<TooltipProvider>
													<Tooltip>
														<TooltipTrigger asChild>
															<AlertTriangle className="h-4 w-4 text-amber-500" />
														</TooltipTrigger>
														<TooltipContent className="max-w-xs">
															<p>{alt.rejectedReason}</p>
														</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											)}
											<span
												className={cn(
													"text-sm font-medium",
													getConfidenceColor(alt.confidence),
												)}
											>
												{alt.confidence}%
											</span>
										</div>
									</div>
								))}
							</div>
						</div>
					</CollapsibleContent>
				)}
			</Collapsible>
		</div>
	);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DecisionTree({
	decisions,
	className,
	onDecisionClick,
	selectedDecisionId,
	showAlternatives = true,
	expandAll = false,
}: DecisionTreeProps) {
	if (!decisions || decisions.length === 0) {
		return (
			<div
				className={cn(
					"flex flex-col items-center justify-center p-8 text-muted-foreground",
					className,
				)}
			>
				<GitBranch className="h-8 w-8 mb-3" />
				<p>No decisions recorded</p>
			</div>
		);
	}

	return (
		<div className={cn("space-y-3", className)}>
			{decisions.map((decision, index) => (
				<div key={decision.id} className="relative">
					{/* Connector line */}
					{index < decisions.length - 1 && (
						<div className="absolute left-6 top-full h-3 w-px bg-border" />
					)}

					<DecisionNode
						decision={decision}
						isSelected={selectedDecisionId === decision.id}
						onClick={
							onDecisionClick ? () => onDecisionClick(decision) : undefined
						}
						showAlternatives={showAlternatives}
						defaultExpanded={expandAll}
					/>
				</div>
			))}
		</div>
	);
}

// ============================================================================
// DECISION COMPARISON COMPONENT
// ============================================================================

export interface DecisionComparisonProps {
	decision: Decision;
	className?: string;
}

export function DecisionComparison({
	decision,
	className,
}: DecisionComparisonProps) {
	const allOptions = [
		{
			action: decision.chosen,
			confidence: decision.confidence || 0,
			reasoning: decision.reasoning,
			isChosen: true,
		},
		...(decision.alternatives || []).map((alt) => ({
			...alt,
			isChosen: false,
		})),
	].sort((a, b) => b.confidence - a.confidence);

	const _maxConfidence = Math.max(...allOptions.map((o) => o.confidence));

	return (
		<div className={cn("space-y-4", className)}>
			<div className="flex items-center gap-2 mb-4">
				<Bot className="h-5 w-5 text-primary" />
				<span className="font-medium">{decision.agentName}</span>
				<Badge variant="outline">{decision.decisionType}</Badge>
			</div>

			<div className="space-y-3">
				{allOptions.map((option, _i) => (
					<div
						key={`${option.action}-${option.confidence}-${option.isChosen}`}
						className={cn(
							"p-4 rounded-lg border transition-all",
							option.isChosen && "border-primary bg-primary/5",
						)}
					>
						<div className="flex items-center justify-between mb-2">
							<div className="flex items-center gap-2">
								{option.isChosen ? (
									<Check className="h-4 w-4 text-green-500" />
								) : (
									<X className="h-4 w-4 text-muted-foreground" />
								)}
								<span
									className={cn(
										"font-medium",
										option.isChosen && "text-primary",
									)}
								>
									{option.action}
								</span>
								{option.isChosen && (
									<Badge variant="secondary" className="text-xs">
										Chosen
									</Badge>
								)}
							</div>
							<span
								className={cn(
									"font-medium",
									getConfidenceColor(option.confidence),
								)}
							>
								{option.confidence}%
							</span>
						</div>

						<Progress
							value={option.confidence}
							className={cn("h-2", option.isChosen && "[&>div]:bg-primary")}
						/>

						{option.reasoning && (
							<p className="mt-2 text-sm text-muted-foreground">
								{option.reasoning}
							</p>
						)}

						{"rejectedReason" in option && option.rejectedReason && (
							<p className="mt-2 text-sm text-amber-600">
								Rejected: {option.rejectedReason}
							</p>
						)}
					</div>
				))}
			</div>

			{/* Summary */}
			<div className="p-4 bg-muted rounded-lg">
				<p className="text-sm">
					<span className="font-medium">Decision Summary: </span>
					{decision.agentName} chose <strong>{decision.chosen}</strong> with{" "}
					<span className={getConfidenceColor(decision.confidence || 0)}>
						{decision.confidence}% confidence
					</span>
					{decision.alternatives && decision.alternatives.length > 0 && (
						<>, considering {decision.alternatives.length} alternative(s)</>
					)}
					.
				</p>
			</div>
		</div>
	);
}

// ============================================================================
// DECISION STATS SUMMARY
// ============================================================================

export interface DecisionStatsProps {
	stats: {
		totalDecisions: number;
		byAgent: Record<string, number>;
		byType: Record<string, number>;
		avgConfidence: number;
		lowConfidenceDecisions: number;
	};
	className?: string;
}

export function DecisionStats({ stats, className }: DecisionStatsProps) {
	return (
		<div className={cn("grid gap-4 md:grid-cols-4", className)}>
			<div className="p-4 bg-muted rounded-lg">
				<p className="text-sm text-muted-foreground">Total Decisions</p>
				<p className="text-2xl font-bold">{stats.totalDecisions}</p>
			</div>

			<div className="p-4 bg-muted rounded-lg">
				<p className="text-sm text-muted-foreground">Avg Confidence</p>
				<p
					className={cn(
						"text-2xl font-bold",
						getConfidenceColor(stats.avgConfidence),
					)}
				>
					{stats.avgConfidence}%
				</p>
			</div>

			<div className="p-4 bg-muted rounded-lg">
				<p className="text-sm text-muted-foreground">Low Confidence</p>
				<p className="text-2xl font-bold text-amber-500">
					{stats.lowConfidenceDecisions}
				</p>
			</div>

			<div className="p-4 bg-muted rounded-lg">
				<p className="text-sm text-muted-foreground">Agents Involved</p>
				<p className="text-2xl font-bold">
					{Object.keys(stats.byAgent).length}
				</p>
			</div>
		</div>
	);
}

export default DecisionTree;
