"use client";

import { CheckCircle2, Code, Copy, Rocket, Terminal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface WizardProps {
	apiKey?: string;
	onComplete?: () => void;
}

export function GettingStartedWizard({ apiKey, onComplete }: WizardProps) {
	const [currentStep, setCurrentStep] = useState(0);
	const [completedSteps, setCompletedSteps] = useState<number[]>([]);

	const steps = [
		{
			title: "Install SDK",
			description: "Add our SDK to your project",
			icon: Terminal,
			code: "# TypeScript\nnpm install @evalgate/sdk\n\n# Python\npip install pauly4010-evalgate-sdk",
		},
		{
			title: "Set Environment Variables",
			description: "Configure your API credentials",
			icon: Code,
			code: `EVALAI_API_KEY=${apiKey || "your-api-key"}
EVALAI_PROJECT_ID=your-project-id`,
		},
		{
			title: "Create Your First Trace",
			description: "Start monitoring your LLM calls",
			icon: Rocket,
			code: `import { AIEvalClient } from '@your-org/ai-eval-sdk';

const client = new AIEvalClient();

await client.traces.create({
  name: 'My First Trace',
  input: { query: 'Hello world' },
  output: { response: 'Hi there!' }
});`,
		},
	];

	const copyCode = (code: string) => {
		navigator.clipboard.writeText(code);
		toast.success("Copied to clipboard!");
	};

	const markStepComplete = (step: number) => {
		if (!completedSteps.includes(step)) {
			setCompletedSteps([...completedSteps, step]);
		}
		if (step < steps.length - 1) {
			setCurrentStep(step + 1);
		} else if (onComplete) {
			onComplete();
		}
	};

	return (
		<Card className="p-6 max-w-3xl mx-auto">
			<div className="mb-6">
				<h2 className="text-2xl font-bold mb-2">Getting Started</h2>
				<p className="text-muted-foreground">
					Follow these steps to start evaluating your AI applications
				</p>
			</div>

			{/* Progress Bar */}
			<div className="mb-8">
				<div className="flex items-center justify-between mb-2">
					{steps.map((step, index) => (
						<div
							key={`step-${step.title}`}
							className="flex items-center flex-1"
						>
							<div
								className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
									completedSteps.includes(index)
										? "bg-green-500 border-green-500 text-white"
										: index === currentStep
											? "border-blue-500 text-blue-500"
											: "border-muted text-muted-foreground"
								}`}
							>
								{completedSteps.includes(index) ? (
									<CheckCircle2 className="h-5 w-5" />
								) : (
									<span>{index + 1}</span>
								)}
							</div>
							{index < steps.length - 1 && (
								<div
									className={`h-0.5 flex-1 mx-2 ${
										completedSteps.includes(index) ? "bg-green-500" : "bg-muted"
									}`}
								/>
							)}
						</div>
					))}
				</div>
			</div>

			{/* Current Step */}
			<div className="space-y-6">
				{steps.map((step, index) => {
					const Icon = step.icon;
					const isActive = index === currentStep;
					const isCompleted = completedSteps.includes(index);

					if (!isActive && !isCompleted) return null;

					return (
						<div
							key={step.title}
							className={`space-y-4 ${isActive ? "opacity-100" : "opacity-50"}`}
						>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
									<Icon className="h-5 w-5 text-blue-500" />
								</div>
								<div>
									<h3 className="font-semibold">{step.title}</h3>
									<p className="text-sm text-muted-foreground">
										{step.description}
									</p>
								</div>
							</div>

							<div className="relative">
								<pre className="bg-muted/50 rounded-lg p-4 overflow-x-auto text-sm">
									<code>{step.code}</code>
								</pre>
								<Button
									size="icon"
									variant="ghost"
									className="absolute top-2 right-2"
									onClick={() => copyCode(step.code)}
								>
									<Copy className="h-4 w-4" />
								</Button>
							</div>

							{isActive && (
								<div className="flex gap-2">
									<Button onClick={() => markStepComplete(index)}>
										{index === steps.length - 1 ? "Finish" : "Next Step"}
									</Button>
									{index > 0 && (
										<Button
											variant="outline"
											onClick={() => setCurrentStep(index - 1)}
										>
											Back
										</Button>
									)}
								</div>
							)}
						</div>
					);
				})}
			</div>

			{completedSteps.length === steps.length && (
				<div className="mt-6 p-4 bg-green-500/10 text-green-600 rounded-lg flex items-center gap-2">
					<CheckCircle2 className="h-5 w-5" />
					<p className="font-medium">
						Congratulations! You're all set up. Check out your dashboard to see
						your first trace.
					</p>
				</div>
			)}
		</Card>
	);
}
