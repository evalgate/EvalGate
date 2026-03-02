/**
 * Catalog Template Card Component
 * Displays a template from the comprehensive evaluation-templates.ts library
 * Uses the EvaluationTemplate interface with type, complexity, icon, and optional judgePrompt/humanEvalCriteria
 */

"use client";

import { BarChart3, CheckCircle2, Copy, FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

import type { EvaluationTemplate } from "@/lib/evaluation-templates/types";

/** Serializable template data (icon stripped since functions can't cross server/client boundary) */
export type CatalogTemplateData = Omit<EvaluationTemplate, "icon">;

const typeConfig: Record<string, { label: string; className: string }> = {
	unit_test: {
		label: "Unit Test",
		className: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
	},
	human_eval: {
		label: "Human Eval",
		className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
	},
	model_eval: {
		label: "LLM Judge",
		className: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
	},
	ab_test: {
		label: "A/B Test",
		className: "bg-green-500/10 text-green-700 dark:text-green-400",
	},
};

const complexityConfig: Record<string, { className: string }> = {
	beginner: { className: "bg-green-500/10 text-green-700 dark:text-green-400" },
	intermediate: {
		className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
	},
	advanced: { className: "bg-red-500/10 text-red-700 dark:text-red-400" },
};

export function CatalogTemplateCard({
	template,
}: {
	template: CatalogTemplateData;
}) {
	const [copied, setCopied] = useState(false);
	const typeInfo =
		typeConfig[template.type ?? "unit_test"] || typeConfig.unit_test;
	const complexityInfo =
		complexityConfig[template.complexity] || complexityConfig.beginner;

	const handleCopyCode = async () => {
		if (template.code) {
			await navigator.clipboard.writeText(template.code);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Card className="cursor-pointer hover:shadow-lg transition-all group">
					<CardHeader>
						<div className="flex items-start justify-between mb-2">
							<div className="p-2 bg-muted rounded-lg">
								<FileText className="h-5 w-5" />
							</div>
							<div className="flex flex-col items-end gap-1">
								<Badge className={typeInfo.className}>{typeInfo.label}</Badge>
								<Badge variant="outline" className={complexityInfo.className}>
									{template.complexity}
								</Badge>
							</div>
						</div>
						<CardTitle className="text-base group-hover:text-primary transition-colors">
							{template.name}
						</CardTitle>
						<CardDescription className="line-clamp-2 text-sm">
							{template.description}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-1 text-sm text-muted-foreground">
							<BarChart3 className="h-4 w-4" />
							{template.testCases.length} test case
							{template.testCases.length !== 1 ? "s" : ""}
						</div>
					</CardContent>
				</Card>
			</DialogTrigger>

			<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<div className="flex items-start justify-between">
						<div>
							<DialogTitle className="text-2xl">{template.name}</DialogTitle>
							<DialogDescription className="mt-2">
								{template.description}
							</DialogDescription>
						</div>
						<div className="flex gap-2">
							<Badge className={typeInfo.className}>{typeInfo.label}</Badge>
							<Badge variant="outline" className={complexityInfo.className}>
								{template.complexity}
							</Badge>
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-6">
					{/* Test Cases */}
					{template.testCases.length > 0 && (
						<div>
							<h3 className="font-semibold mb-3">
								Test Cases ({template.testCases.length})
							</h3>
							<div className="space-y-3">
								{template.testCases.slice(0, 3).map((testCase, index) => (
									<Card key={testCase.input || `testcase-${index}`}>
										<CardContent className="py-3">
											<div className="space-y-2 text-sm">
												<div>
													<span className="font-medium">Input: </span>
													<span className="text-muted-foreground">
														{testCase.input}
													</span>
												</div>
												{testCase.expectedOutput && (
													<div>
														<span className="font-medium">Expected: </span>
														<span className="text-muted-foreground line-clamp-2">
															{testCase.expectedOutput}
														</span>
													</div>
												)}
												{testCase.rubric && (
													<div>
														<span className="font-medium">Rubric: </span>
														<span className="text-muted-foreground text-xs">
															{testCase.rubric}
														</span>
													</div>
												)}
											</div>
										</CardContent>
									</Card>
								))}
								{template.testCases.length > 3 && (
									<p className="text-sm text-muted-foreground text-center">
										+ {template.testCases.length - 3} more test case
										{template.testCases.length - 3 !== 1 ? "s" : ""}
									</p>
								)}
							</div>
						</div>
					)}

					{/* Judge Prompt (model_eval only) */}
					{template.judgePrompt && (
						<div>
							<h3 className="font-semibold mb-2">Judge Prompt</h3>
							<Card>
								<CardContent className="py-3">
									<p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
										{template.judgePrompt}
									</p>
								</CardContent>
							</Card>
						</div>
					)}

					{/* Human Eval Criteria (human_eval only) */}
					{template.humanEvalCriteria &&
						template.humanEvalCriteria.length > 0 && (
							<div>
								<h3 className="font-semibold mb-2">Evaluation Criteria</h3>
								<div className="space-y-2">
									{template.humanEvalCriteria.map((criterion) => (
										<Card key={criterion.name}>
											<CardContent className="py-3">
												<div className="text-sm">
													<div className="font-medium">{criterion.name}</div>
													<div className="text-muted-foreground">
														{criterion.description}
													</div>
													<div className="text-xs text-muted-foreground mt-1">
														Scale: {criterion.scale}
													</div>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							</div>
						)}

					{/* Code (if available) */}
					{template.code && (
						<div>
							<div className="flex items-center justify-between mb-2">
								<h3 className="font-semibold">Code</h3>
								<Button
									variant="outline"
									size="sm"
									onClick={handleCopyCode}
									className="gap-2"
								>
									{copied ? (
										<>
											<CheckCircle2 className="h-4 w-4 text-green-500" />
											Copied!
										</>
									) : (
										<>
											<Copy className="h-4 w-4" />
											Copy Code
										</>
									)}
								</Button>
							</div>
							<pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
								<code>{template.code}</code>
							</pre>
						</div>
					)}

					{/* CTA */}
					<div className="flex gap-3">
						<Button asChild className="flex-1">
							<Link href="/evaluations/new">Use in Builder</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link href="/playground">Try in Playground</Link>
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
