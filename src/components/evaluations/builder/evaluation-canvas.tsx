"use client";

import { GripVertical, Rocket, Settings, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useBuilder } from "./builder-context";
import type { EvaluationBuilderProps } from "./types";

export function EvaluationCanvas({ onDeploy }: EvaluationBuilderProps) {
	const {
		selectedTemplates,
		activeTemplate,
		setActiveTemplate,
		evaluationName,
		setEvaluationName,
		evaluationDescription,
		setEvaluationDescription,
		draggedTemplate,
		setDraggedTemplate,
		handleAddTemplate,
		handleRemoveTemplate,
		handleOpenSettings,
	} = useBuilder();

	const handleDeploy = () => {
		if (!evaluationName || selectedTemplates.length === 0) return;
		const types = selectedTemplates.map((t) => t.template.type);
		onDeploy({
			name: evaluationName,
			description: evaluationDescription,
			type: types[0],
			templates: selectedTemplates,
		});
	};

	return (
		<Card className="flex-1 flex flex-col">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-base">Evaluation Canvas</CardTitle>
						<CardDescription className="text-xs">
							{selectedTemplates.length} template
							{selectedTemplates.length !== 1 ? "s" : ""} selected
						</CardDescription>
					</div>
					<Button
						onClick={handleDeploy}
						disabled={!evaluationName || selectedTemplates.length === 0}
						size="sm"
						className="gap-2"
					>
						<Rocket className="h-3.5 w-3.5" />
						Deploy Evaluation
					</Button>
				</div>
			</CardHeader>
			<CardContent className="flex-1 p-4 pt-0">
				<div className="space-y-3 mb-4">
					<div className="space-y-1.5">
						<Label htmlFor="eval-name" className="text-xs">
							Evaluation Name *
						</Label>
						<Input
							id="eval-name"
							placeholder="e.g., Production Chatbot Safety Evaluation"
							value={evaluationName}
							onChange={(e) => setEvaluationName(e.target.value)}
							className="h-9"
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="eval-desc" className="text-xs">
							Description (optional)
						</Label>
						<Textarea
							id="eval-desc"
							placeholder="Describe what this evaluation tests..."
							value={evaluationDescription}
							onChange={(e) => setEvaluationDescription(e.target.value)}
							rows={2}
							className="text-sm"
						/>
					</div>
				</div>

				<section
					aria-label="Evaluation canvas"
					className={cn(
						"border-2 border-dashed rounded-lg p-4 min-h-[400px]",
						draggedTemplate ? "border-primary bg-primary/5" : "border-muted",
						selectedTemplates.length === 0 &&
							"flex items-center justify-center",
					)}
					onDragOver={(e) => e.preventDefault()}
					onDrop={(e) => {
						e.preventDefault();
						if (draggedTemplate) {
							handleAddTemplate(draggedTemplate);
							setDraggedTemplate(null);
						}
					}}
				>
					{selectedTemplates.length === 0 ? (
						<div className="text-center max-w-sm">
							<div className="rounded-full bg-muted w-16 h-16 flex items-center justify-center mx-auto mb-3">
								<GripVertical className="h-8 w-8 text-muted-foreground" />
							</div>
							<h3 className="font-semibold mb-1">No templates added yet</h3>
							<p className="text-sm text-muted-foreground">
								Drag templates from the library or click to add them to your
								evaluation
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{selectedTemplates.map((selected) => {
								const Icon = selected.template.icon;
								const isActive = activeTemplate === selected.id;
								return (
									<Card
										key={selected.id}
										className={cn(
											"cursor-pointer transition-all",
											isActive && "ring-2 ring-primary border-primary",
										)}
										onClick={() => setActiveTemplate(selected.id)}
									>
										<CardContent className="p-3">
											<div className="flex items-start gap-3">
												<div className="flex items-center gap-2">
													<GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
													<div className="rounded-md bg-primary/10 p-2">
														<Icon className="h-4 w-4 text-primary" />
													</div>
												</div>
												<div className="flex-1 min-w-0">
													<div className="flex items-start justify-between gap-2">
														<div className="flex-1">
															<div className="flex items-center gap-2">
																<h4 className="font-medium text-sm">
																	{selected.config.name ||
																		selected.template.name}
																</h4>
																<Badge variant="secondary" className="text-xs">
																	{selected.template.type.replace("_", " ")}
																</Badge>
															</div>
															<p className="text-xs text-muted-foreground mt-1">
																{selected.config.description ||
																	selected.template.description}
															</p>
														</div>
														<div className="flex items-center gap-1">
															<Button
																variant="ghost"
																size="sm"
																onClick={(e) => {
																	e.stopPropagation();
																	handleOpenSettings(selected.id);
																}}
																className="h-7 w-7 p-0"
															>
																<Settings className="h-3.5 w-3.5" />
															</Button>
															<Button
																variant="ghost"
																size="sm"
																onClick={(e) => {
																	e.stopPropagation();
																	handleRemoveTemplate(selected.id);
																}}
																className="h-7 w-7 p-0 text-destructive hover:text-destructive"
															>
																<Trash2 className="h-3.5 w-3.5" />
															</Button>
														</div>
													</div>
												</div>
											</div>
										</CardContent>
									</Card>
								);
							})}
						</div>
					)}
				</section>
			</CardContent>
		</Card>
	);
}
