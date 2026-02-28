"use client";

import {
	AlertTriangle,
	ArrowRight,
	Camera,
	CheckCircle,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

export default function DemoPage() {
	const { data: session } = useSession();

	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col">
			{/* Header */}
			<header className="border-b border-border">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
					<div className="flex items-center justify-between gap-3">
						<Link href="/">
							<h1 className="text-base sm:text-xl font-bold truncate">
								AI Evaluation Platform
							</h1>
						</Link>
						<div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
							<ThemeToggle />
							{session?.user ? (
								<Button asChild size="sm" className="h-9">
									<Link href="/dashboard">Dashboard</Link>
								</Button>
							) : (
								<>
									<Button
										variant="ghost"
										asChild
										size="sm"
										className="h-9 hidden sm:flex"
									>
										<Link href="/auth/login">Sign in</Link>
									</Button>
									<Button asChild size="sm" className="h-9">
										<Link href="/auth/sign-up">Get started</Link>
									</Button>
								</>
							)}
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="flex-1">
				<div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
					{/* Breadcrumb */}
					<nav className="mb-8">
						<Link
							href="/documentation"
							className="text-sm text-muted-foreground hover:text-foreground transition-colors"
						>
							← Back to Documentation
						</Link>
					</nav>

					{/* Hero */}
					<div className="mb-12">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10">
								<Camera className="h-6 w-6 text-orange-500" />
							</div>
							<div>
								<h1 className="text-3xl sm:text-4xl font-bold mb-2">
									EvalAI Gate Demo
								</h1>
								<p className="text-lg text-muted-foreground">
									Show, don't tell. Here's what a failing gate looks like in
									GitHub Actions, and what it looks like after you fix the
									regression.
								</p>
							</div>
						</div>
					</div>

					{/* Failing Gate */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
							<XCircle className="h-5 w-5 text-red-500" />
							Failing Gate
						</h2>
						<p className="text-muted-foreground mb-6">
							When your score drops below the baseline, CI fails. With{" "}
							<code className="bg-muted px-1 rounded">--format github</code>,
							you get:
						</p>

						<div className="space-y-4">
							<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
								<h3 className="font-semibold text-red-700 dark:text-red-300 mb-2">
									What You See
								</h3>
								<ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
									<li>
										• <strong>Annotations</strong> —{" "}
										<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
											::error
										</code>{" "}
										markers on failed test cases (visible in Files changed)
									</li>
									<li>
										• <strong>Step summary</strong> — Verdict, score, delta vs
										baseline, and failing cases
									</li>
								</ul>
							</div>

							<div className="bg-muted rounded-lg p-6">
								<div className="flex items-center gap-2 mb-4">
									<div className="bg-red-100 dark:bg-red-900 rounded p-2">
										<XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
									</div>
									<h3 className="font-semibold text-red-600 dark:text-red-400">
										GitHub Actions Output
									</h3>
								</div>
								<div className="bg-background border rounded-lg p-4 font-mono text-sm">
									<pre className="text-red-600 dark:text-red-400">{`## EvalAI Gate

❌ FAILED: score_below_baseline

**Score:** 78/100 (baseline 92, -14 pts)

### 2 failing cases

- **Hello** — expected: greeting, got "Hi there"
- **2 + 2 = ?** — expected: 4, got ""

[View Dashboard](https://eval.ai/dashboard/evaluations/42/runs/123)`}</pre>
								</div>
							</div>

							<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
								<div className="flex items-start gap-3">
									<AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
									<div>
										<h3 className="font-semibold text-yellow-700 dark:text-yellow-300 mb-2">
											What This Means
										</h3>
										<p className="text-sm text-yellow-600 dark:text-yellow-400">
											Your evaluation score dropped from 92 to 78 (-14 points),
											indicating a regression. The CI gate blocked the merge to
											protect your production quality.
										</p>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* Passing Gate */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
							<CheckCircle className="h-5 w-5 text-green-500" />
							Passing Gate
						</h2>
						<p className="text-muted-foreground mb-6">
							After you fix the regressions (or adjust the baseline), the gate
							passes.
						</p>

						<div className="space-y-4">
							<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
								<h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">
									Success Indicators
								</h3>
								<ul className="text-sm text-green-600 dark:text-green-400 space-y-1">
									<li>• Score meets or exceeds baseline</li>
									<li>• No failing test cases</li>
									<li>• CI pipeline continues to next steps</li>
									<li>• Merge can proceed safely</li>
								</ul>
							</div>

							<div className="bg-muted rounded-lg p-6">
								<div className="flex items-center gap-2 mb-4">
									<div className="bg-green-100 dark:bg-green-900 rounded p-2">
										<CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
									</div>
									<h3 className="font-semibold text-green-600 dark:text-green-400">
										GitHub Actions Output
									</h3>
								</div>
								<div className="bg-background border rounded-lg p-4 font-mono text-sm">
									<pre className="text-green-600 dark:text-green-400">{`## EvalAI Gate

✅ PASSED

**Score:** 92/100`}</pre>
								</div>
							</div>

							<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
								<div className="flex items-start gap-3">
									<CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
									<div>
										<h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
											Quality Maintained
										</h3>
										<p className="text-sm text-blue-600 dark:text-blue-400">
											Your evaluation maintained the expected quality score of
											92/100. The regression gate confirms no quality
											degradation in this change.
										</p>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* Key Features */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">
							Key Features in Action
						</h2>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-3">
								<h3 className="font-semibold flex items-center gap-2">
									<XCircle className="h-4 w-4 text-red-500" />
									Failure Detection
								</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Automatic regression detection</li>
									<li>• Detailed failure analysis</li>
									<li>• Baseline comparison</li>
									<li>• Score delta calculation</li>
								</ul>
							</div>

							<div className="space-y-3">
								<h3 className="font-semibold flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-500" />
									Success Validation
								</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Quality score verification</li>
									<li>• Test case pass/fail summary</li>
									<li>• Performance metrics</li>
									<li>• Trend analysis</li>
								</ul>
							</div>

							<div className="space-y-3">
								<h3 className="font-semibold flex items-center gap-2">
									<AlertTriangle className="h-4 w-4 text-yellow-500" />
									CI Integration
								</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• GitHub Actions annotations</li>
									<li>• Step summary reports</li>
									<li>• Dashboard links</li>
									<li>• Import failing runs</li>
								</ul>
							</div>

							<div className="space-y-3">
								<h3 className="font-semibold flex items-center gap-2">
									<Camera className="h-4 w-4 text-blue-500" />
									Debugging Support
								</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Failing case details</li>
									<li>• Expected vs actual output</li>
									<li>• Error messages</li>
									<li>• Performance metrics</li>
								</ul>
							</div>
						</div>
					</Card>

					{/* How to Capture Screenshots */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
							<Camera className="h-5 w-5" />
							How to Capture Screenshots
						</h2>

						<div className="space-y-4">
							<ol className="space-y-3">
								<li className="flex items-start gap-3">
									<div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold mt-0.5">
										1
									</div>
									<div>
										<h3 className="font-semibold">
											Add the GitHub Actions workflow
										</h3>
										<p className="text-sm text-muted-foreground">
											Follow the{" "}
											<Link
												href="/docs/ci/github-actions"
												className="text-blue-500 hover:underline"
											>
												GitHub Actions integration guide
											</Link>{" "}
											to add the workflow to your repo
										</p>
									</div>
								</li>

								<li className="flex items-start gap-3">
									<div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold mt-0.5">
										2
									</div>
									<div>
										<h3 className="font-semibold">
											Intentionally break a test case
										</h3>
										<p className="text-sm text-muted-foreground">
											Modify a test case to trigger a failure and see the gate
											in action
										</p>
									</div>
								</li>

								<li className="flex items-start gap-3">
									<div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold mt-0.5">
										3
									</div>
									<div>
										<h3 className="font-semibold">
											Screenshot the failing run
										</h3>
										<p className="text-sm text-muted-foreground">
											Capture the "EvalAI gate" step in the GitHub Actions run
										</p>
									</div>
								</li>

								<li className="flex items-start gap-3">
									<div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold mt-0.5">
										4
									</div>
									<div>
										<h3 className="font-semibold">
											Fix and screenshot the passing run
										</h3>
										<p className="text-sm text-muted-foreground">
											Fix the regression and capture the successful gate pass
										</p>
									</div>
								</li>
							</ol>

							<div className="bg-muted rounded-lg p-4">
								<h3 className="font-semibold mb-2">File Locations</h3>
								<p className="text-sm text-muted-foreground mb-2">
									Place images in{" "}
									<code className="bg-background px-1 rounded">
										docs/images/
									</code>{" "}
									as:
								</p>
								<div className="space-y-1 font-mono text-sm">
									<div>
										• <code>evalai-gate-fail.png</code> — Failing gate
										screenshot
									</div>
									<div>
										• <code>evalai-gate-pass.png</code> — Passing gate
										screenshot
									</div>
								</div>
								<p className="text-xs text-muted-foreground mt-2">
									Run{" "}
									<code className="bg-background px-1 rounded">
										pnpm create:demo-placeholders
									</code>{" "}
									to create minimal placeholders
								</p>
							</div>
						</div>
					</Card>

					{/* Next Steps */}
					<Card className="p-6">
						<div className="text-center">
							<h2 className="text-xl font-semibold mb-4">Try It Yourself</h2>
							<p className="text-muted-foreground mb-6">
								Ready to set up your own regression gate?
							</p>
							<div className="flex justify-center gap-4">
								<Button variant="outline" asChild>
									<Link href="/guides/quick-start">
										Quick Start Guide <ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
								<Button variant="outline" asChild>
									<Link href="/docs/ci/github-actions">
										GitHub Actions Setup <ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
								<Button asChild>
									<Link href="/dashboard">
										Get Started <ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
							</div>
						</div>
					</Card>
				</div>
			</main>

			{/* Footer */}
			<Footer />
		</div>
	);
}
