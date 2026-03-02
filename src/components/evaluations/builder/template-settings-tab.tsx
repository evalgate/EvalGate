"use client";

import {
	AlertCircle,
	CheckCircle2,
	Code,
	Info,
	MessageSquareText,
	Plus,
	X,
	Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useBuilder } from "./builder-context";

export function TemplateSettingsTab() {
	const { activeTemplateData, handleUpdateTemplateConfig } = useBuilder();
	if (!activeTemplateData) return null;

	return (
		<TabsContent value="settings" className="flex-1 min-h-0 mt-0">
			<ScrollArea className="h-full">
				<div className="space-y-6 pr-4 pb-4">
					{/* Custom Name */}
					<div className="space-y-1.5">
						<Label htmlFor="template-name" className="text-xs">
							Custom Name (optional)
						</Label>
						<Input
							id="template-name"
							placeholder={activeTemplateData.template.name}
							value={activeTemplateData.config.name || ""}
							onChange={(e) =>
								handleUpdateTemplateConfig(activeTemplateData.id, {
									name: e.target.value,
								})
							}
							className="h-9"
						/>
					</div>

					{/* Custom Description */}
					<div className="space-y-1.5">
						<Label htmlFor="template-desc" className="text-xs">
							Custom Description (optional)
						</Label>
						<Textarea
							id="template-desc"
							placeholder={activeTemplateData.template.description}
							value={activeTemplateData.config.description || ""}
							onChange={(e) =>
								handleUpdateTemplateConfig(activeTemplateData.id, {
									description: e.target.value,
								})
							}
							rows={3}
							className="text-sm"
						/>
					</div>

					{/* Evaluation Thresholds */}
					<div className="space-y-3">
						<Label className="text-sm font-semibold flex items-center gap-1.5">
							<Zap className="h-4 w-4 text-primary" />
							Scoring Thresholds
						</Label>
						<Card>
							<CardContent className="p-4 space-y-3">
								<div className="space-y-1.5">
									<Label htmlFor="passing-score" className="text-xs">
										Passing Score (%)
									</Label>
									<Input
										id="passing-score"
										type="number"
										min="0"
										max="100"
										placeholder="80"
										value={
											activeTemplateData.config.thresholds?.passingScore || ""
										}
										onChange={(e) =>
											handleUpdateTemplateConfig(activeTemplateData.id, {
												thresholds: {
													...activeTemplateData.config.thresholds,
													passingScore:
														parseInt(e.target.value, 10) || undefined,
												},
											})
										}
										className="h-9"
									/>
									<p className="text-[11px] text-muted-foreground">
										Minimum score required to pass this evaluation
									</p>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="warning-threshold" className="text-xs">
										Warning Threshold (%)
									</Label>
									<Input
										id="warning-threshold"
										type="number"
										min="0"
										max="100"
										placeholder="90"
										value={
											activeTemplateData.config.thresholds?.warningThreshold ||
											""
										}
										onChange={(e) =>
											handleUpdateTemplateConfig(activeTemplateData.id, {
												thresholds: {
													...activeTemplateData.config.thresholds,
													warningThreshold:
														parseInt(e.target.value, 10) || undefined,
												},
											})
										}
										className="h-9"
									/>
									<p className="text-[11px] text-muted-foreground">
										Score below this triggers a warning flag
									</p>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Custom Test Cases */}
					{activeTemplateData.template.testCases &&
						activeTemplateData.template.testCases.length > 0 && (
							<TestCasesEditor
								activeTemplateData={activeTemplateData}
								onUpdate={handleUpdateTemplateConfig}
							/>
						)}

					{/* Custom Evaluation Criteria */}
					{activeTemplateData.template.humanEvalCriteria &&
						activeTemplateData.template.humanEvalCriteria.length > 0 && (
							<CriteriaEditor
								activeTemplateData={activeTemplateData}
								onUpdate={handleUpdateTemplateConfig}
							/>
						)}

					{/* Custom Judge Prompt */}
					{activeTemplateData.template.judgePrompt && (
						<div className="space-y-1.5">
							<Label
								htmlFor="custom-prompt"
								className="text-sm font-semibold flex items-center gap-1.5"
							>
								<Code className="h-4 w-4 text-purple-600" />
								Custom Judge Prompt
							</Label>
							<Textarea
								id="custom-prompt"
								placeholder="Leave empty to use default prompt, or customize the LLM evaluation instructions..."
								value={activeTemplateData.config.customPrompt || ""}
								onChange={(e) =>
									handleUpdateTemplateConfig(activeTemplateData.id, {
										customPrompt: e.target.value,
									})
								}
								rows={12}
								className="text-xs font-mono"
							/>
							<p className="text-xs text-muted-foreground flex items-start gap-1.5">
								<Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
								<span>
									Customize how the LLM judge evaluates responses. Include
									specific tone preferences, domain knowledge requirements, or
									style guidelines.
								</span>
							</p>
						</div>
					)}

					{/* Reset to Defaults */}
					<Card className="border-muted-foreground/20">
						<CardContent className="p-3">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									handleUpdateTemplateConfig(activeTemplateData.id, {
										customTestCases: undefined,
										customCriteria: undefined,
										customPrompt: undefined,
										thresholds: undefined,
									});
								}}
								className="w-full gap-2"
							>
								<AlertCircle className="h-3.5 w-3.5" />
								Reset All Customizations to Default
							</Button>
						</CardContent>
					</Card>
				</div>
			</ScrollArea>
		</TabsContent>
	);
}

function TestCasesEditor({
	activeTemplateData,
	onUpdate,
}: {
	activeTemplateData: NonNullable<
		ReturnType<typeof useBuilder>["activeTemplateData"]
	>;
	onUpdate: ReturnType<typeof useBuilder>["handleUpdateTemplateConfig"];
}) {
	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<Label className="text-sm font-semibold flex items-center gap-1.5">
					<CheckCircle2 className="h-4 w-4 text-green-600" />
					Custom Test Cases
				</Label>
				<Button
					size="sm"
					variant="outline"
					onClick={() => {
						const currentCases = (activeTemplateData.config.customTestCases ||
							activeTemplateData.template.testCases) as Array<{
							input: string;
							expectedOutput: string;
							rubric: string;
						}>;
						onUpdate(activeTemplateData.id, {
							customTestCases: [
								...currentCases,
								{ input: "", expectedOutput: "", rubric: "" },
							],
						});
					}}
					className="h-7 gap-1"
				>
					<Plus className="h-3 w-3" />
					Add Test
				</Button>
			</div>
			<div className="space-y-3">
				{(
					activeTemplateData.config.customTestCases ||
					activeTemplateData.template.testCases
				).map((testCase, i) => (
					<Card
						key={testCase.input || `testcase-${i}`}
						className="border-l-2 border-l-primary/50"
					>
						<CardContent className="p-3 space-y-2">
							<div className="flex items-center justify-between">
								<Badge variant="secondary" className="text-[10px] px-1.5 py-0">
									Test {i + 1}
								</Badge>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => {
										const currentCases = (activeTemplateData.config
											.customTestCases ||
											activeTemplateData.template.testCases) as Array<{
											input: string;
											expectedOutput: string;
											rubric: string;
										}>;
										onUpdate(activeTemplateData.id, {
											customTestCases: currentCases.filter(
												(_, idx) => idx !== i,
											),
										});
									}}
									className="h-6 w-6 p-0 text-destructive hover:text-destructive"
								>
									<X className="h-3 w-3" />
								</Button>
							</div>
							<div className="space-y-2">
								<div className="space-y-1">
									<Label className="text-xs">Rubric/Criteria</Label>
									<Input
										placeholder="What should this test validate?"
										value={testCase.rubric}
										onChange={(e) => {
											const currentCases = (activeTemplateData.config
												.customTestCases || [
												...activeTemplateData.template.testCases,
											]) as Array<{
												input: string;
												expectedOutput: string;
												rubric: string;
											}>;
											currentCases[i] = {
												...currentCases[i],
												rubric: e.target.value,
											};
											onUpdate(activeTemplateData.id, {
												customTestCases: currentCases,
											});
										}}
										className="h-8 text-xs"
									/>
								</div>
								<div className="space-y-1">
									<Label className="text-xs">Test Input</Label>
									<Textarea
										placeholder="Input to test..."
										value={testCase.input}
										onChange={(e) => {
											const currentCases = (activeTemplateData.config
												.customTestCases || [
												...activeTemplateData.template.testCases,
											]) as Array<{
												input: string;
												expectedOutput: string;
												rubric: string;
											}>;
											currentCases[i] = {
												...currentCases[i],
												input: e.target.value,
											};
											onUpdate(activeTemplateData.id, {
												customTestCases: currentCases,
											});
										}}
										rows={2}
										className="text-xs"
									/>
								</div>
								<div className="space-y-1">
									<Label className="text-xs">Expected Output</Label>
									<Textarea
										placeholder="Expected result..."
										value={testCase.expectedOutput}
										onChange={(e) => {
											const currentCases = (activeTemplateData.config
												.customTestCases || [
												...activeTemplateData.template.testCases,
											]) as Array<{
												input: string;
												expectedOutput: string;
												rubric: string;
											}>;
											currentCases[i] = {
												...currentCases[i],
												expectedOutput: e.target.value,
											};
											onUpdate(activeTemplateData.id, {
												customTestCases: currentCases,
											});
										}}
										rows={2}
										className="text-xs"
									/>
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

function CriteriaEditor({
	activeTemplateData,
	onUpdate,
}: {
	activeTemplateData: NonNullable<
		ReturnType<typeof useBuilder>["activeTemplateData"]
	>;
	onUpdate: ReturnType<typeof useBuilder>["handleUpdateTemplateConfig"];
}) {
	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<Label className="text-sm font-semibold flex items-center gap-1.5">
					<MessageSquareText className="h-4 w-4 text-blue-600" />
					Evaluation Criteria
				</Label>
				<Button
					size="sm"
					variant="outline"
					onClick={() => {
						const currentCriteria: Array<{
							name: string;
							description: string;
							scale: string;
						}> =
							activeTemplateData.config.customCriteria ||
							activeTemplateData.template.humanEvalCriteria ||
							[];
						onUpdate(activeTemplateData.id, {
							customCriteria: [
								...currentCriteria,
								{ name: "", description: "", scale: "1-5" },
							],
						});
					}}
					className="h-7 gap-1"
				>
					<Plus className="h-3 w-3" />
					Add Criteria
				</Button>
			</div>
			<div className="space-y-3">
				{(
					activeTemplateData.config.customCriteria ||
					activeTemplateData.template.humanEvalCriteria ||
					[]
				).map(
					(
						criteria: { name: string; description: string; scale: string },
						i: number,
					) => (
						<Card
							key={criteria.name || `criteria-${i}`}
							className="border-l-2 border-l-blue-500/50"
						>
							<CardContent className="p-3 space-y-2">
								<div className="flex items-center justify-between gap-2">
									<Badge
										variant="secondary"
										className="text-[10px] px-1.5 py-0"
									>
										Criteria {i + 1}
									</Badge>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => {
											const currentCriteria: Array<{
												name: string;
												description: string;
												scale: string;
											}> =
												activeTemplateData.config.customCriteria ||
												activeTemplateData.template.humanEvalCriteria ||
												[];
											onUpdate(activeTemplateData.id, {
												customCriteria: currentCriteria.filter(
													(_, idx) => idx !== i,
												),
											});
										}}
										className="h-6 w-6 p-0 text-destructive hover:text-destructive"
									>
										<X className="h-3 w-3" />
									</Button>
								</div>
								<div className="space-y-2">
									<div className="space-y-1">
										<Label className="text-xs">Criteria Name</Label>
										<Input
											placeholder="e.g., Tone & Voice"
											value={criteria.name}
											onChange={(e) => {
												const currentCriteria =
													activeTemplateData.config.customCriteria ||
													(activeTemplateData.template.humanEvalCriteria
														? [...activeTemplateData.template.humanEvalCriteria]
														: []);
												currentCriteria[i] = {
													...currentCriteria[i],
													name: e.target.value,
												};
												onUpdate(activeTemplateData.id, {
													customCriteria: currentCriteria,
												});
											}}
											className="h-8 text-xs"
										/>
									</div>
									<div className="space-y-1">
										<Label className="text-xs">Description</Label>
										<Textarea
											placeholder="What aspect should evaluators assess?"
											value={criteria.description}
											onChange={(e) => {
												const currentCriteria =
													activeTemplateData.config.customCriteria ||
													(activeTemplateData.template.humanEvalCriteria
														? [...activeTemplateData.template.humanEvalCriteria]
														: []);
												currentCriteria[i] = {
													...currentCriteria[i],
													description: e.target.value,
												};
												onUpdate(activeTemplateData.id, {
													customCriteria: currentCriteria,
												});
											}}
											rows={2}
											className="text-xs"
										/>
									</div>
									<div className="space-y-1">
										<Label className="text-xs">Rating Scale</Label>
										<Input
											placeholder="e.g., 1-5, Pass/Fail, Poor/Good/Excellent"
											value={criteria.scale}
											onChange={(e) => {
												const currentCriteria =
													activeTemplateData.config.customCriteria ||
													(activeTemplateData.template.humanEvalCriteria
														? [...activeTemplateData.template.humanEvalCriteria]
														: []);
												currentCriteria[i] = {
													...currentCriteria[i],
													scale: e.target.value,
												};
												onUpdate(activeTemplateData.id, {
													customCriteria: currentCriteria,
												});
											}}
											className="h-8 text-xs"
										/>
									</div>
								</div>
							</CardContent>
						</Card>
					),
				)}
			</div>
		</div>
	);
}
