/**
 * Interactive Playground Component
 * Try AI evaluations in < 30 seconds, no signup required
 * Includes 3 canned demos + a "Test Your Own" custom eval mode
 */

"use client";

import {
	ArrowRight,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Copy,
	Download,
	Play,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { QualityScore } from "@/lib/ai-quality-score";
import { AIQualityScoreCard } from "./ai-quality-score-card";
import { EmailCaptureWidget } from "./email-capture-widget";

interface PlaygroundTest {
	id?: number | string;
	status?: string;
	input?: string;
	query?: string;
	task?: string;
	expected?: string;
	actual?: string;
	generated?: string;
	score?: number;
	notes?: string;
	context?: string;
}

interface PlaygroundProps {
	onSignupPrompt?: () => void;
}

// Demo data interfaces
interface DemoItem {
	pass: boolean;
	score?: number;
	input?: string;
	expected?: string;
	actual?: string;
	reasoning?: string;
}

interface DemoResult {
	name: string;
	overall?: number;
	items?: DemoItem[];
	qualityScore?: QualityScore;
	results?: {
		summary: {
			totalTests: number;
			passed: number;
			failed: number;
			passRate: string;
		};
		testResults: DemoItem[];
		qualityMetrics: unknown;
		totalTests?: number;
		passed?: number;
		failed?: number;
		tests?: DemoItem[];
	};
}

const ASSERTION_GROUPS = [
	{
		name: "Safety",
		assertions: [
			{ id: "no-pii", label: "No PII detected", defaultChecked: true },
			{ id: "professional", label: "Professional tone", defaultChecked: true },
			{ id: "proper-grammar", label: "Proper grammar", defaultChecked: true },
		],
	},
	{
		name: "Quality",
		assertions: [
			{
				id: "positive-sentiment",
				label: "Positive sentiment",
				defaultChecked: false,
			},
			{
				id: "negative-sentiment",
				label: "Negative sentiment",
				defaultChecked: false,
			},
			{
				id: "neutral-sentiment",
				label: "Neutral sentiment",
				defaultChecked: false,
			},
		],
	},
	{
		name: "Structure",
		assertions: [
			{ id: "valid-json", label: "Valid JSON", defaultChecked: false },
			{
				id: "contains-code",
				label: "Contains code blocks",
				defaultChecked: false,
			},
		],
	},
	{
		name: "Factuality",
		needsExpected: true,
		assertions: [
			{
				id: "not-hallucinated",
				label: "No hallucination (needs expected output)",
				defaultChecked: false,
			},
			{
				id: "matches-expected",
				label: "Matches expected output exactly",
				defaultChecked: false,
			},
		],
	},
];

const DEFAULT_ASSERTIONS = ASSERTION_GROUPS.flatMap((g) => g.assertions)
	.filter((a) => a.defaultChecked)
	.map((a) => a.id);

export function InteractivePlayground({
	onSignupPrompt,
}: PlaygroundProps = {}) {
	const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const [results, setResults] = useState<DemoResult | null>(null);
	const [showEmailCapture, setShowEmailCapture] = useState(false);

	// Custom eval state
	const [customInput, setCustomInput] = useState("");
	const [customOutput, setCustomOutput] = useState("");
	const [customExpected, setCustomExpected] = useState("");
	const [showExpected, setShowExpected] = useState(false);
	const [selectedAssertions, setSelectedAssertions] =
		useState<string[]>(DEFAULT_ASSERTIONS);
	const [customKeywords, setCustomKeywords] = useState("");
	const [customLengthMin, setCustomLengthMin] = useState("");
	const [customLengthMax, setCustomLengthMax] = useState("");

	const scenarios = [
		{
			id: "chatbot-accuracy",
			name: "Chatbot Accuracy",
			description:
				"See how well a customer service chatbot handles common questions",
			preview: "Preview: quality score, pass/fail split, and top failure notes",
			icon: "💬",
			difficulty: "Beginner",
			time: "30s",
			color: "from-blue-500/10 to-blue-500/5",
		},
		{
			id: "rag-hallucination",
			name: "RAG Hallucination",
			description:
				"Detect when AI makes up information not in source documents",
			preview: "Preview: hallucination flags with expected vs actual output",
			icon: "🔍",
			difficulty: "Intermediate",
			time: "45s",
			color: "from-purple-500/10 to-purple-500/5",
		},
		{
			id: "code-quality",
			name: "Code Generation",
			description:
				"Evaluate if generated code actually works and follows best practices",
			preview:
				"Preview: failed test cases, score breakdown, and recommendations",
			icon: "💻",
			difficulty: "Advanced",
			time: "1m",
			color: "from-green-500/10 to-green-500/5",
		},
		{
			id: "custom",
			name: "Test Your Own",
			description:
				"Paste your AI's input and output, pick assertions, see results instantly",
			preview: "Preview: instant assertion checks using your own output",
			icon: "🧪",
			difficulty: "Custom",
			time: "instant",
			color: "from-orange-500/10 to-orange-500/5",
		},
	];

	const toggleAssertion = (id: string) => {
		setSelectedAssertions((prev) =>
			prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
		);
	};

	const handleRunEvaluation = async (scenarioId: string) => {
		if (scenarioId === "custom") {
			// For custom, just select the scenario to show the form
			setSelectedScenario("custom");
			setResults(null);
			return;
		}

		setSelectedScenario(scenarioId);
		setIsRunning(true);
		setResults(null);

		try {
			const demoTypeMap: Record<string, string> = {
				"chatbot-accuracy": "chatbot",
				"rag-hallucination": "rag",
				"code-quality": "codegen",
			};

			const demoType = demoTypeMap[scenarioId] || "chatbot";
			const response = await fetch(`/api/demo/${demoType}`);
			if (!response.ok) throw new Error("Failed to run evaluation");
			const data = (await response.json()) as DemoResult;

			const overallScore = Math.round((data.overall || 0.87) * 100);
			const passRate =
				data.results?.summary?.totalTests && data.results?.summary?.passed
					? (data.results.summary.passed / data.results.summary.totalTests) *
						100
					: 87;

			const calculateGrade = (score: number): QualityScore["grade"] => {
				if (score >= 97) return "A+";
				if (score >= 93) return "A";
				if (score >= 87) return "B+";
				if (score >= 83) return "B";
				if (score >= 77) return "C+";
				if (score >= 73) return "C";
				if (score >= 60) return "D";
				return "F";
			};

			const transformedData = {
				name:
					scenarios.find((s) => s.id === scenarioId)?.name || "Demo Evaluation",
				results: {
					totalTests: data.items?.length || 10,
					passed:
						data.items?.filter(
							// biome-ignore lint/suspicious/noExplicitAny: demo data
							(item: any) => item.pass,
						).length || 8,
					failed:
						data.items?.filter(
							// biome-ignore lint/suspicious/noExplicitAny: demo data
							(item: any) => !item.pass,
						).length || 2,
					tests: data.items || [],
				},
				qualityScore: {
					overall: overallScore,
					grade: calculateGrade(overallScore),
					metrics: {
						accuracy: Math.round(passRate),
						safety: Math.round(passRate * 0.95),
						latency: 85,
						cost: 80,
						consistency: Math.round(passRate * 0.9),
					},
					trend: 0,
					insights: [
						overallScore >= 90
							? "🎯 Excellent performance across all metrics"
							: "✅ Good performance with room for improvement",
						"⚡ Fast response times",
						"💰 Cost-efficient operations",
					],
					recommendations:
						overallScore >= 90
							? [
									"Continue monitoring for regressions",
									"Run A/B tests on prompt variations",
									"Expand test coverage to edge cases",
								]
							: [
									"Add more specific instructions to your prompts",
									"Consider using few-shot learning",
									"Review and update your evaluation rubric",
								],
				},
			};

			setResults(transformedData as unknown as DemoResult);
			setTimeout(() => setShowEmailCapture(true), 2000);
			toast.success("Evaluation complete!", {
				description: "Sign up to save and share your results",
			});
		} catch {
			toast.error("Something went wrong", { description: "Please try again" });
		} finally {
			setIsRunning(false);
		}
	};

	const handleCustomEval = async () => {
		setIsRunning(true);

		try {
			const response = await fetch("/api/demo/custom-eval", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					input: customInput,
					output: customOutput,
					expectedOutput: customExpected || undefined,
					assertions: selectedAssertions,
					keywords: customKeywords
						? customKeywords
								.split(",")
								.map((k) => k.trim())
								.filter(Boolean)
						: undefined,
					lengthMin: customLengthMin
						? parseInt(customLengthMin, 10)
						: undefined,
					lengthMax: customLengthMax
						? parseInt(customLengthMax, 10)
						: undefined,
				}),
			});

			if (!response.ok) {
				const err = await response.json().catch(() => ({}));
				throw new Error(err.error || "Failed to run evaluation");
			}

			const data = await response.json();
			setResults(data);
			setTimeout(() => setShowEmailCapture(true), 2000);
			toast.success("Evaluation complete!", {
				description: `${data.results.passed}/${data.results.totalTests} assertions passed`,
			});
		} catch (error) {
			toast.error("Something went wrong", {
				description:
					error instanceof Error ? error.message : "Please try again",
			});
		} finally {
			setIsRunning(false);
		}
	};

	const handleReset = () => {
		setSelectedScenario(null);
		setResults(null);
		setShowEmailCapture(false);
		setIsRunning(false);
		// Reset custom eval form state
		setCustomInput("");
		setCustomOutput("");
		setCustomExpected("");
		setShowExpected(false);
		setSelectedAssertions(DEFAULT_ASSERTIONS);
		setCustomKeywords("");
		setCustomLengthMin("");
		setCustomLengthMax("");
	};

	const handleCopyResults = () => {
		if (!results) return;

		const summary = `
Evaluation Results: ${results.name}
Grade: ${results.qualityScore?.grade || "N/A"} (${results.qualityScore?.overall || 0}/100)

Summary:
- Total Tests: ${results.results?.totalTests || 0}
- Passed: ${results.results?.passed || 0}
- Failed: ${results.results?.failed || 0}
- Pass Rate: ${results.results?.totalTests ? Math.round(((results.results?.passed || 0) / results.results?.totalTests) * 100) : 0}%

Quality Metrics:
- Accuracy: ${results.qualityScore?.metrics?.accuracy || 0}/100
- Safety: ${results.qualityScore?.metrics?.safety || 0}/100
- Latency: ${results.qualityScore?.metrics?.latency || 0}/100
- Cost: ${results.qualityScore?.metrics?.cost || 0}/100
- Consistency: ${results.qualityScore?.metrics?.consistency || 0}/100

Key Insights:
${(results.qualityScore?.insights || []).map((i: string) => `- ${i}`).join("\n")}

Recommendations:
${(results.qualityScore?.recommendations || []).map((r: string) => `- ${r}`).join("\n")}
    `.trim();

		navigator.clipboard.writeText(summary);
		toast.success("Results copied to clipboard!");
	};

	const handleExport = () => {
		if (!results) return;

		const exportData = {
			name: results.name || "Untitled Evaluation",
			timestamp: new Date().toISOString(),
			scenario: selectedScenario,
			summary: {
				totalTests: results.results?.totalTests || 0,
				passed: results.results?.passed || 0,
				failed: results.results?.failed || 0,
				passRate: `${Math.round(((results.results?.passed || 0) / (results.results?.totalTests || 1)) * 100)}%`,
			},
			qualityScore: results.qualityScore,
			testResults: results.results?.tests?.map((test: PlaygroundTest) => ({
				id: test.id,
				status: test.status,
				input: test.input || test.query || test.task,
				expected: test.expected,
				actual: test.actual || test.generated,
				score: test.score,
				notes: test.notes,
				context: test.context,
			})),
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `evaluation-results-${Date.now()}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success("Results exported successfully!");
	};

	// Determine what to render
	const isCustomForm = selectedScenario === "custom" && !results && !isRunning;

	return (
		<div className="w-full max-w-7xl mx-auto space-y-8">
			{/* Hero Section */}
			<div className="text-center space-y-4">
				<Badge variant="secondary" className="text-sm">
					Try demos instantly—no signup
				</Badge>
				<h2 className="text-4xl font-bold tracking-tight">
					Try AI Evaluation in 30 Seconds
				</h2>
				<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
					Choose a scenario below to run a real demo endpoint and see sample
					results instantly. Sign up to save results and use the API.
				</p>
			</div>

			{/* Scenario Selection */}
			{!selectedScenario && (
				<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
					{scenarios.map((scenario) => (
						<Card
							key={scenario.id}
							className={`cursor-pointer transition-all hover:scale-105 hover:shadow-lg bg-gradient-to-br ${scenario.color} ${
								scenario.id === "custom" ? "border-dashed border-2" : ""
							}`}
							onClick={() => handleRunEvaluation(scenario.id)}
						>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="text-5xl mb-4">{scenario.icon}</div>
									<div className="flex flex-col gap-1">
										<Badge variant="outline" className="text-xs">
											{scenario.difficulty}
										</Badge>
										<Badge variant="secondary" className="text-xs">
											{scenario.time}
										</Badge>
									</div>
								</div>
								<CardTitle className="text-xl">{scenario.name}</CardTitle>
								<CardDescription>
									{scenario.description}
									<span className="mt-1 block text-xs">{scenario.preview}</span>
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Button
									className="w-full"
									variant={scenario.id === "custom" ? "outline" : "default"}
								>
									<Play className="h-4 w-4 mr-2" />
									{scenario.id === "custom"
										? "Start Custom Check"
										: "Run Demo (sample results)"}
								</Button>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Custom Eval Form */}
			{isCustomForm && (
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="text-2xl">Test Your Own AI</CardTitle>
								<CardDescription>
									Paste your AI&apos;s input and output, select assertions, and
									see results instantly
								</CardDescription>
							</div>
							<Button variant="ghost" onClick={handleReset}>
								&larr; Back
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-6">
						{/* Input */}
						<div className="space-y-2">
							<label className="text-sm font-medium" htmlFor="custom-input">
								Input Prompt{" "}
								<span className="text-muted-foreground font-normal">
									(optional)
								</span>
							</label>
							<Textarea
								id="custom-input"
								value={customInput}
								onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
									setCustomInput(e.target.value)
								}
								placeholder="What did you ask the AI? e.g., 'Summarize the following document...'"
								rows={3}
							/>
						</div>

						{/* Output */}
						<div className="space-y-2">
							<label className="text-sm font-medium" htmlFor="custom-output">
								AI Output <span className="text-red-500">*</span>
							</label>
							<Textarea
								id="custom-output"
								value={customOutput}
								onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
									setCustomOutput(e.target.value)
								}
								placeholder="Paste the AI's response here..."
								rows={5}
							/>
						</div>

						{/* Expected Output (collapsible) */}
						<div>
							<Button
								variant="ghost"
								className="px-0 text-sm"
								onClick={() => setShowExpected(!showExpected)}
							>
								{showExpected ? (
									<ChevronUp className="h-4 w-4 mr-1" />
								) : (
									<ChevronDown className="h-4 w-4 mr-1" />
								)}
								{showExpected ? "Hide" : "Add"} expected output (optional)
							</Button>
							{showExpected && (
								<div className="mt-2 space-y-2">
									<Textarea
										value={customExpected}
										onChange={(e) => setCustomExpected(e.target.value)}
										placeholder="The ground-truth or expected response. Used for hallucination checks and exact match."
										rows={3}
									/>
								</div>
							)}
						</div>

						{/* Assertion Picker */}
						<div className="space-y-4">
							<h3 className="text-sm font-medium">Choose Assertions</h3>
							<div className="grid md:grid-cols-2 gap-6">
								{ASSERTION_GROUPS.map((group) => {
									const isDisabled = group.needsExpected && !customExpected;
									return (
										<div key={group.name} className="space-y-3">
											<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
												{group.name}
												{group.needsExpected && !customExpected && (
													<span className="ml-1 text-xs font-normal normal-case">
														(add expected output)
													</span>
												)}
											</h4>
											<div className="space-y-2">
												{group.assertions.map((assertion) => (
													<label
														key={assertion.id}
														htmlFor={`assertion-${assertion.id}`}
														className={`flex items-center gap-2 text-sm ${isDisabled ? "opacity-50" : "cursor-pointer"}`}
													>
														<Checkbox
															id={`assertion-${assertion.id}`}
															checked={selectedAssertions.includes(
																assertion.id,
															)}
															onCheckedChange={() =>
																!isDisabled && toggleAssertion(assertion.id)
															}
															disabled={isDisabled}
														/>
														{assertion.label}
													</label>
												))}
											</div>
										</div>
									);
								})}
							</div>

							{/* Extra inputs for special assertions */}
							<div className="space-y-4">
								{selectedAssertions.includes("contains-keywords") && (
									<div className="space-y-2">
										<label htmlFor="keywords" className="text-sm font-medium">
											Keywords (comma-separated)
										</label>
										<Textarea
											id="keywords"
											value={customKeywords}
											onChange={(e) => setCustomKeywords(e.target.value)}
											placeholder="refund, policy, 30 days"
											rows={1}
										/>
									</div>
								)}
								{selectedAssertions.includes("length-check") && (
									<div className="space-y-2 flex-1">
										<label htmlFor="max-length" className="text-sm font-medium">
											Max length (chars)
										</label>
										<input
											id="max-length"
											type="number"
											value={customLengthMax}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
												setCustomLengthMax(e.target.value)
											}
											placeholder="1000"
											className="w-full px-3 py-2 border rounded-md bg-background text-sm"
										/>
									</div>
								)}
							</div>

							{/* Keywords & Length toggles (not in groups) */}
							<div className="flex flex-wrap gap-4 pt-2 border-t">
								<label
									htmlFor="contains-keywords"
									className="flex items-center gap-2 text-sm cursor-pointer"
								>
									<Checkbox
										id="contains-keywords"
										checked={selectedAssertions.includes("contains-keywords")}
										onCheckedChange={() => toggleAssertion("contains-keywords")}
									/>
									Contains keywords
								</label>
								<label
									htmlFor="length-check"
									className="flex items-center gap-2 text-sm cursor-pointer"
								>
									<Checkbox
										id="length-check"
										checked={selectedAssertions.includes("length-check")}
										onCheckedChange={() => toggleAssertion("length-check")}
									/>
									Length range
								</label>
							</div>
						</div>

						{/* Run Button */}
						<Button
							className="w-full"
							size="lg"
							onClick={handleCustomEval}
							disabled={!customOutput.trim() || selectedAssertions.length === 0}
						>
							<Play className="h-4 w-4 mr-2" />
							Run Evaluation ({selectedAssertions.length} assertion
							{selectedAssertions.length !== 1 ? "s" : ""})
						</Button>
					</CardContent>
				</Card>
			)}

			{/* Loading State */}
			{isRunning && (
				<Card>
					<CardContent className="py-12">
						<div className="flex flex-col items-center justify-center space-y-4">
							<div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
							<div className="text-center space-y-2">
								<p className="text-lg font-semibold">Running evaluation...</p>
								<p className="text-sm text-muted-foreground">
									{selectedScenario === "custom"
										? `Running ${selectedAssertions.length} assertion${selectedAssertions.length !== 1 ? "s" : ""}...`
										: `Testing ${scenarios.find((s) => s.id === selectedScenario)?.name}`}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Results */}
			{results && !isRunning && (
				<div className="space-y-6">
					{/* Action Bar */}
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-2xl font-bold">Evaluation Results</h3>
							<p className="text-muted-foreground">
								{results.name} &bull; {results.results?.totalTests} tests
							</p>
						</div>
						<div className="flex gap-2">
							<Button variant="outline" onClick={handleCopyResults}>
								<Copy className="h-4 w-4 mr-2" />
								Copy
							</Button>
							<Button variant="outline" onClick={handleExport}>
								<Download className="h-4 w-4 mr-2" />
								Export
							</Button>
							<Button onClick={handleReset}>Try Another</Button>
						</div>
					</div>

					{/* Quality Score */}
					{results?.qualityScore && (
						<AIQualityScoreCard score={results.qualityScore} />
					)}

					{/* Test Results */}
					<Card>
						<CardHeader>
							<CardTitle>Test Results</CardTitle>
							<CardDescription>
								{results.results?.passed} passed &bull;{" "}
								{results.results?.failed} failed
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Tabs defaultValue="all" className="w-full">
								<TabsList className="grid w-full grid-cols-3">
									<TabsTrigger value="all">
										All ({results.results?.totalTests})
									</TabsTrigger>
									<TabsTrigger value="passed">
										Passed ({results.results?.passed})
									</TabsTrigger>
									<TabsTrigger value="failed">
										Failed ({results.results?.failed})
									</TabsTrigger>
								</TabsList>

								<TabsContent value="all" className="space-y-4 mt-4">
									{results?.results?.tests?.map((test: PlaygroundTest) => (
										<TestResultCard key={test.id} test={test} />
									))}
								</TabsContent>

								<TabsContent value="passed" className="space-y-4 mt-4">
									{results?.results?.tests
										?.filter((t: PlaygroundTest) => t.status === "passed")
										?.map((test: PlaygroundTest) => (
											<TestResultCard key={test.id} test={test} />
										))}
								</TabsContent>

								<TabsContent value="failed" className="space-y-4 mt-4">
									{results?.results?.tests
										?.filter((t: PlaygroundTest) => t.status === "failed")
										?.map((test: PlaygroundTest) => (
											<TestResultCard key={test.id} test={test} />
										))}
								</TabsContent>
							</Tabs>
						</CardContent>
					</Card>

					{/* Email Capture Widget */}
					{showEmailCapture && (
						<EmailCaptureWidget
							source="playground"
							context={{
								scenario: selectedScenario,
								score: results?.qualityScore?.overall || 0,
								testsPassed: results?.results?.passed || 0,
								totalTests: results?.results?.totalTests || 0,
							}}
							onSuccess={() => setShowEmailCapture(false)}
						/>
					)}

					{/* CTA */}
					{!showEmailCapture && (
						<Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
							<CardContent className="py-8">
								<div className="text-center space-y-4">
									<h3 className="text-2xl font-bold">Love what you see?</h3>
									<p className="text-muted-foreground max-w-2xl mx-auto">
										Sign up now to save these results, run unlimited
										evaluations, and share your quality scores with your team.
									</p>
									<div className="flex gap-4 justify-center">
										<Button size="lg" onClick={onSignupPrompt}>
											Start Free Trial
											<ArrowRight className="h-4 w-4 ml-2" />
										</Button>
										<Button size="lg" variant="outline">
											View Pricing
										</Button>
									</div>
									<p className="text-xs text-muted-foreground">
										No credit card required &bull; 14-day free trial &bull;
										Cancel unknowntime
									</p>
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			)}
		</div>
	);
}

function TestResultCard({ test }: { test: PlaygroundTest }) {
	const isPassed = test.status === "passed";

	return (
		<Card className={isPassed ? "border-green-500/20" : "border-red-500/20"}>
			<CardContent className="py-4">
				<div className="flex items-start gap-4">
					<div className="flex-shrink-0 mt-1">
						{isPassed ? (
							<CheckCircle2 className="h-6 w-6 text-green-500" />
						) : (
							<XCircle className="h-6 w-6 text-red-500" />
						)}
					</div>

					<div className="flex-1 space-y-2">
						<div className="flex items-center justify-between">
							<p className="font-medium">
								{test.input || test.query || test.task || "Test"}
							</p>
							<Badge variant={isPassed ? "default" : "destructive"}>
								{test.score || 0}/100
							</Badge>
						</div>

						{test.expected && (
							<div className="text-sm">
								<span className="text-muted-foreground">Expected: </span>
								<span>{test.expected}</span>
							</div>
						)}

						<div className="text-sm">
							<span className="text-muted-foreground">Actual: </span>
							<span>{test.actual || test.generated || "No output"}</span>
						</div>

						{test.notes && (
							<div className="text-sm text-muted-foreground italic">
								{test.notes}
							</div>
						)}

						{test.context && (
							<details className="text-sm">
								<summary className="cursor-pointer text-muted-foreground hover:text-foreground">
									View context
								</summary>
								<div className="mt-2 p-3 bg-muted rounded-md">
									{test.context}
								</div>
							</details>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
