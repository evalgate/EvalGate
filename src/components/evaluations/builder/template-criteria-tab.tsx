"use client";

import { AlertCircle, FileCode2, MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";
import { useBuilder } from "./builder-context";

export function TemplateCriteriaTab() {
	const { activeTemplateData } = useBuilder();
	if (!activeTemplateData) return null;

	return (
		<TabsContent value="criteria" className="flex-1 min-h-0 mt-0">
			<ScrollArea className="h-full">
				<div className="space-y-4 pr-4 pb-4">
					{activeTemplateData.template.code && (
						<div className="space-y-2">
							<Label className="text-sm font-semibold flex items-center gap-1.5">
								<FileCode2 className="h-4 w-4 text-purple-600" />
								Validation Code
							</Label>
							<Card className="bg-slate-950 border-slate-800">
								<CardContent className="p-4">
									<pre className="text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap break-words">
										{activeTemplateData.template.code}
									</pre>
								</CardContent>
							</Card>

							{activeTemplateData.template.id === "unit-content-safety" && (
								<Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
									<CardContent className="p-3 space-y-2">
										<div className="flex items-start gap-2">
											<AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
											<div className="flex-1">
												<p className="text-xs font-semibold text-orange-900 dark:text-orange-100">
													PII Detection Patterns
												</p>
												<ul className="text-xs text-orange-800 dark:text-orange-200 mt-1.5 space-y-1 list-disc list-inside">
													<li>
														<span className="font-medium">SSN:</span> Format
														XXX-XX-XXXX
													</li>
													<li>
														<span className="font-medium">Credit Cards:</span>{" "}
														16-digit card numbers with or without separators
													</li>
													<li>
														<span className="font-medium">
															Email Addresses:
														</span>{" "}
														Standard email format validation
													</li>
												</ul>
											</div>
										</div>
									</CardContent>
								</Card>
							)}

							{activeTemplateData.template.id === "unit-business-rules" && (
								<Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
									<CardContent className="p-3 space-y-2">
										<div className="flex items-start gap-2">
											<AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
											<div className="flex-1">
												<p className="text-xs font-semibold text-orange-900 dark:text-orange-100">
													Forbidden Phrases
												</p>
												<ul className="text-xs text-orange-800 dark:text-orange-200 mt-1.5 space-y-1 list-disc list-inside">
													<li>&quot;guaranteed returns&quot;</li>
													<li>&quot;risk-free investment&quot;</li>
													<li>&quot;get rich quick&quot;</li>
													<li>&quot;can&apos;t lose&quot;</li>
												</ul>
											</div>
										</div>
									</CardContent>
								</Card>
							)}
						</div>
					)}

					{activeTemplateData.template.judgePrompt && (
						<div className="space-y-2">
							<Label className="text-sm font-semibold flex items-center gap-1.5">
								<MessageSquareText className="h-4 w-4 text-blue-600" />
								LLM Judge Prompt
							</Label>
							<Card className="bg-slate-950 border-slate-800">
								<CardContent className="p-4">
									<pre className="text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap break-words">
										{activeTemplateData.template.judgePrompt}
									</pre>
								</CardContent>
							</Card>

							{activeTemplateData.template.id === "judge-safety" && (
								<Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
									<CardContent className="p-3 space-y-2">
										<div className="flex items-start gap-2">
											<AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
											<div className="flex-1">
												<p className="text-xs font-semibold text-red-900 dark:text-red-100">
													Safety Checks
												</p>
												<ul className="text-xs text-red-800 dark:text-red-200 mt-1.5 space-y-1 list-disc list-inside">
													<li>
														Potential harm (physical, psychological, financial)
													</li>
													<li>Bias or discrimination</li>
													<li>Inappropriate content</li>
													<li>Privacy violations</li>
													<li>Dangerous advice or misinformation</li>
												</ul>
											</div>
										</div>
									</CardContent>
								</Card>
							)}
						</div>
					)}

					{activeTemplateData.template.humanEvalCriteria && (
						<div className="space-y-2">
							<Label className="text-sm font-semibold flex items-center gap-1.5">
								<MessageSquareText className="h-4 w-4 text-blue-600" />
								Evaluation Criteria
							</Label>
							<div className="space-y-2">
								{activeTemplateData.template.humanEvalCriteria.map(
									(criteria, i) => (
										<Card
											key={criteria.name || `criteria-${i}`}
											className="border-l-4 border-l-blue-500"
										>
											<CardContent className="p-3 space-y-1.5">
												<div className="flex items-start justify-between gap-2">
													<h5 className="text-sm font-semibold">
														{criteria.name}
													</h5>
													<Badge className="text-[10px] px-2 py-0.5 flex-shrink-0">
														{criteria.scale}
													</Badge>
												</div>
												<p className="text-xs text-muted-foreground">
													{criteria.description}
												</p>
											</CardContent>
										</Card>
									),
								)}
							</div>
						</div>
					)}
				</div>
			</ScrollArea>
		</TabsContent>
	);
}
