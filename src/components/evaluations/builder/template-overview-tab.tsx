"use client";

import { CheckCircle2, MessageSquareText, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";
import { useBuilder } from "./builder-context";

export function TemplateOverviewTab() {
	const { activeTemplateData } = useBuilder();
	if (!activeTemplateData) return null;

	return (
		<TabsContent value="overview" className="flex-1 min-h-0 mt-0">
			<ScrollArea className="h-full">
				<div className="space-y-4 pr-4 pb-4">
					<div className="space-y-2">
						<Label className="text-sm font-semibold flex items-center gap-1.5">
							<Zap className="h-4 w-4 text-primary" />
							How This Evaluation Works
						</Label>
						<Card className="bg-muted/30">
							<CardContent className="p-3 space-y-3">
								<div className="space-y-2">
									<div className="flex items-center gap-2">
										<CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
										<span className="text-xs font-medium">
											Test Cases ({activeTemplateData.template.testCases.length}
											)
										</span>
									</div>
									{activeTemplateData.template.testCases.map((testCase, i) => (
										<Card
											key={testCase.input || `testcase-${i}`}
											className="border-l-2 border-l-primary/50"
										>
											<CardContent className="p-2 space-y-1.5">
												<div className="flex items-start gap-1.5">
													<Badge
														variant="secondary"
														className="text-[10px] px-1.5 py-0 mt-0.5 flex-shrink-0"
													>
														Test {i + 1}
													</Badge>
													<p className="text-xs font-medium flex-1">
														{testCase.rubric}
													</p>
												</div>
												<div className="space-y-1">
													<p className="text-[11px] text-muted-foreground">
														<span className="font-medium">Input:</span>{" "}
														{testCase.input}
													</p>
													<p className="text-[11px] text-muted-foreground">
														<span className="font-medium">Expected:</span>{" "}
														{testCase.expectedOutput}
													</p>
												</div>
											</CardContent>
										</Card>
									))}
								</div>

								{activeTemplateData.template.humanEvalCriteria && (
									<div className="space-y-2">
										<div className="flex items-center gap-2">
											<MessageSquareText className="h-3.5 w-3.5 text-blue-600" />
											<span className="text-xs font-medium">
												Human Evaluation Criteria
											</span>
										</div>
										{activeTemplateData.template.humanEvalCriteria.map(
											(criteria, i) => (
												<Card
													key={criteria.name || `criteria-${i}`}
													className="border-l-2 border-l-blue-500/50"
												>
													<CardContent className="p-2">
														<div className="flex items-start justify-between gap-2">
															<div className="flex-1 min-w-0">
																<p className="text-xs font-medium">
																	{criteria.name}
																</p>
																<p className="text-[11px] text-muted-foreground">
																	{criteria.description}
																</p>
															</div>
															<Badge
																variant="outline"
																className="text-[10px] px-1.5 py-0 flex-shrink-0"
															>
																{criteria.scale}
															</Badge>
														</div>
													</CardContent>
												</Card>
											),
										)}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</ScrollArea>
		</TabsContent>
	);
}
