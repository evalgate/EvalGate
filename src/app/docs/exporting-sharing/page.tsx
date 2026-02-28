"use client";

import { ArrowRight, Download, FileText, Share2, Users } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

export default function ExportingSharingPage() {
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
							<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
								<Share2 className="h-6 w-6 text-blue-500" />
							</div>
							<div>
								<h1 className="text-3xl sm:text-4xl font-bold mb-2">
									Exporting and Sharing
								</h1>
								<p className="text-lg text-muted-foreground">
									Complete guide to exporting evaluation results and sharing
									them publicly
								</p>
							</div>
						</div>
					</div>

					{/* Quick Start */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Quick Start</h2>
						<div className="grid gap-6 md:grid-cols-2">
							<div>
								<h3 className="font-semibold mb-3 flex items-center gap-2">
									<Download className="h-4 w-4" />
									Export an Evaluation
								</h3>
								<ol className="space-y-2 text-sm text-muted-foreground">
									<li>1. Navigate to your evaluation detail page</li>
									<li>
										2. Click the <strong>Export</strong> button in the header
									</li>
									<li>3. Choose your export options:</li>
									<li className="ml-4">
										• <strong>Download only</strong>: Get a JSON file
									</li>
									<li className="ml-4">
										• <strong>Publish as demo</strong>: Make it publicly
										accessible
									</li>
								</ol>
							</div>

							<div>
								<h3 className="font-semibold mb-3 flex items-center gap-2">
									<Users className="h-4 w-4" />
									Share an Evaluation
								</h3>
								<ol className="space-y-2 text-sm text-muted-foreground">
									<li>
										1. Click <strong>Export</strong> → Check "Make this export
										public as demo"
									</li>
									<li>2. (Optional) Enter a custom share ID</li>
									<li>
										3. Click <strong>Export & Publish</strong>
									</li>
									<li>4. Copy the generated share link</li>
									<li>5. Share with unknownone!</li>
								</ol>
							</div>
						</div>
					</Card>

					{/* Export Options */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Export Options</h2>

						<div className="space-y-6">
							<div>
								<h3 className="font-semibold mb-3">
									Standard Export (Download Only)
								</h3>
								<p className="text-muted-foreground mb-4">
									Downloads a comprehensive JSON file with all evaluation data:
								</p>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto mb-4">
									<pre>{`{
  "evaluation": {
    "id": "eval-123",
    "name": "Chatbot Safety Test",
    "type": "unit_test",
    "category": "adversarial"
  },
  "timestamp": "2025-11-11T20:00:00Z",
  "summary": {
    "totalTests": 50,
    "passed": 45,
    "failed": 5,
    "passRate": "90%"
  },
  "qualityScore": {
    "overall": 90,
    "grade": "A",
    "metrics": { ... },
    "insights": [ ... ],
    "recommendations": [ ... ]
  },
  "testResults": [ ... ]
}`}</pre>
								</div>

								<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
									<h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
										Filename Format
									</h4>
									<div className="space-y-1 text-sm text-blue-600 dark:text-blue-400">
										<div>
											• Unit Test:{" "}
											<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
												unit_test-adversarial-chatbot-safety-1731360000.json
											</code>
										</div>
										<div>
											• Human Eval:{" "}
											<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
												human_eval-legal-qa-evaluation-1731360000.json
											</code>
										</div>
										<div>
											• Model Eval:{" "}
											<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
												model_eval-ragas-rag-system-1731360000.json
											</code>
										</div>
										<div>
											• A/B Test:{" "}
											<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
												ab_test-prompt-optimization-1731360000.json
											</code>
										</div>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* Publishing as Demo */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Publishing as Demo</h2>

						<div className="space-y-6">
							<div>
								<h3 className="font-semibold mb-3">What is a Public Demo?</h3>
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-sm">
										<div className="h-2 w-2 rounded-full bg-green-500"></div>
										<span>It becomes publicly accessible via a share link</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<div className="h-2 w-2 rounded-full bg-green-500"></div>
										<span>unknownone can view results without signing in</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<div className="h-2 w-2 rounded-full bg-green-500"></div>
										<span>Viewers can copy or download the data</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<div className="h-2 w-2 rounded-full bg-green-500"></div>
										<span>
											Perfect for showcasing your work or sharing with
											stakeholders
										</span>
									</div>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-3">How to Publish</h3>
								<div className="space-y-4">
									<div>
										<h4 className="text-sm font-medium mb-2">
											Option 1: Via Export Modal
										</h4>
										<ol className="space-y-1 text-sm text-muted-foreground">
											<li>
												1. Click <strong>Export</strong> button
											</li>
											<li>
												2. Check ☑️{" "}
												<strong>"Make this export public as demo"</strong>
											</li>
											<li>
												3. (Optional) Enter custom share ID:{" "}
												<code className="bg-muted px-1 rounded">
													my-chatbot-eval
												</code>
											</li>
											<li>
												4. Click <strong>Export & Publish</strong>
											</li>
										</ol>
									</div>

									<div>
										<h4 className="text-sm font-medium mb-2">
											Option 2: Via API
										</h4>
										<p className="text-sm text-muted-foreground">
											See API Methods section below
										</p>
									</div>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-3">Custom Share IDs</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Instead of auto-generated tokens, you can use memorable share
									IDs:
								</p>
								<div className="grid gap-2 md:grid-cols-2">
									<div className="bg-muted rounded-lg p-3">
										<code className="text-sm">my-chatbot-eval</code>
									</div>
									<div className="bg-muted rounded-lg p-3">
										<code className="text-sm">compunknown-q4-benchmark</code>
									</div>
									<div className="bg-muted rounded-lg p-3">
										<code className="text-sm">rag-system-test</code>
									</div>
									<div className="bg-muted rounded-lg p-3">
										<code className="text-sm">safety-assessment-2024</code>
									</div>
								</div>
								<p className="text-xs text-muted-foreground mt-2">
									Rules: 3-50 chars, letters, numbers, hyphens, underscores only
								</p>
							</div>
						</div>
					</Card>

					{/* Sharing Links */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Sharing Links</h2>

						<div className="space-y-4">
							<div>
								<h3 className="font-semibold mb-3">Link Formats</h3>
								<div className="space-y-2">
									<div className="bg-muted rounded-lg p-3 font-mono text-sm">
										<div>Web Interface:</div>
										<code>https://eval.ai/demo/&#123;shareId&#125;</code>
									</div>
									<div className="bg-muted rounded-lg p-3 font-mono text-sm">
										<div>API Access:</div>
										<code>https://eval.ai/api/demo/&#123;shareId&#125;</code>
									</div>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-3">What Viewers See</h3>
								<div className="grid gap-4 md:grid-cols-2">
									<div className="space-y-2">
										<h4 className="text-sm font-medium flex items-center gap-2">
											<FileText className="h-4 w-4" />
											Evaluation Details
										</h4>
										<ul className="text-sm text-muted-foreground space-y-1">
											<li>• Name, type, and category</li>
											<li>• Creation timestamp</li>
											<li>• Test case count</li>
										</ul>
									</div>
									<div className="space-y-2">
										<h4 className="text-sm font-medium flex items-center gap-2">
											<Download className="h-4 w-4" />
											Results & Actions
										</h4>
										<ul className="text-sm text-muted-foreground space-y-1">
											<li>• Pass/fail summary</li>
											<li>• Quality score (if computed)</li>
											<li>• Download full JSON</li>
											<li>• Copy share link</li>
										</ul>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* API Methods */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">API Methods</h2>

						<div className="space-y-6">
							<div>
								<h3 className="font-semibold mb-3">Export Evaluation</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`GET /api/evaluations/{id}/runs/{runId}/export`}</pre>
								</div>
								<p className="text-sm text-muted-foreground mt-2">
									Returns evaluation data in the standard export format
								</p>
							</div>

							<div>
								<h3 className="font-semibold mb-3">Create Public Share</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`POST /api/reports
{
  "evaluationId": "eval-123",
  "evaluationRunId": "run-456",
  "expiresInDays": 30,
  "shareId": "my-custom-id"  // optional
}`}</pre>
								</div>
								<div className="bg-muted rounded-lg p-3 font-mono text-sm mt-2">
									<pre>{`{
  "shareToken": "hex-token",
  "shareUrl": "https://eval.ai/demo/my-custom-id",
  "apiUrl": "https://eval.ai/api/demo/my-custom-id",
  "expiresAt": "2024-02-15T00:00:00.000Z"
}`}</pre>
								</div>
							</div>
						</div>
					</Card>

					{/* Best Practices */}
					<Card className="p-6">
						<h2 className="text-xl font-semibold mb-4">Best Practices</h2>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-3">
								<h3 className="font-semibold text-green-600">✅ Do</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Use descriptive share IDs for easy sharing</li>
									<li>• Set appropriate expiration dates for sensitive data</li>
									<li>• Review data before publishing publicly</li>
									<li>• Use custom domains for white-label sharing</li>
								</ul>
							</div>
							<div className="space-y-3">
								<h3 className="font-semibold text-red-600">❌ Don't</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Share sensitive test data or PII</li>
									<li>• Use share IDs that reveal internal information</li>
									<li>• Forget to set expiration for temporary shares</li>
									<li>• Assume share links are private</li>
								</ul>
							</div>
						</div>
					</Card>

					{/* Next Steps */}
					<Card className="p-6 mt-8">
						<div className="text-center">
							<h2 className="text-xl font-semibold mb-4">
								Related Documentation
							</h2>
							<div className="flex justify-center gap-4">
								<Button variant="outline" asChild>
									<Link href="/docs/api-contract">
										API Contract <ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
								<Button variant="outline" asChild>
									<Link href="/docs/share-links">
										Share Links Privacy <ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
								<Button asChild>
									<Link href="/api-reference">
										API Reference <ArrowRight className="ml-2 h-4 w-4" />
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
