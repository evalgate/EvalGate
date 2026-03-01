"use client";

import {
	AlertCircle,
	ArrowRight,
	CheckCircle,
	Code,
	Database,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

const validationSnippet = `// Shared validation function
function validateTestResult(result: TestResult): TestResult {
  // 1. Validate status enum
  if (!['passed', 'failed', 'error'].includes(result.status)) {
    throw new Error('Invalid status');
  }

  // 2. Validate assertionsJson structure
  if (result.assertionsJson) {
    const knownKeys = ['pii', 'toxicity', 'json_schema', 'functional', 'safety', 'judge'];
    const unknownKeys = Object.keys(result.assertionsJson).filter(k => !knownKeys.includes(k));
    if (unknownKeys.length > 0) {
      throw new Error('Unknown assertion keys: [list omitted for brevity]');
    }
  }

  // 3. Ensure consistency
  if (result.status === 'error' && !result.error) {
    throw new Error('Error status requires error field');
  }

  return result;
}`;

export default function TestResultSemanticsPage() {
	const { data: session } = useSession();

	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col">
			{/* Header */}
			<header className="border-b border-border">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
					<div className="flex items-center justify-between gap-3">
						<Link href="/">
							<h1 className="text-base sm:text-xl font-bold truncate">
								EvalGate
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
							<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
								<Database className="h-6 w-6 text-purple-500" />
							</div>
							<div>
								<h1 className="text-3xl sm:text-4xl font-bold mb-2">
									Test Result Semantics
								</h1>
								<p className="text-lg text-muted-foreground">
									Canonical contract for evaluation test results across all
									evaluators
								</p>
							</div>
						</div>
						<div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
							<p className="text-sm text-purple-600 dark:text-purple-400">
								This document defines the canonical semantics for evaluation
								test results across all evaluators (unit test, model eval,
								shadow eval, trace-linked, etc.). Every producer of{" "}
								<code className="bg-purple-100 dark:bg-purple-800 px-1 rounded">
									test_results
								</code>{" "}
								must conform to this contract.
							</p>
						</div>
					</div>

					{/* Status Values */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Status Values</h2>

						<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto mb-4">
							<table className="w-full">
								<thead>
									<tr className="border-b">
										<th className="text-left py-2">Status</th>
										<th className="text-left py-2">Meaning</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td className="py-2">
											<code className="text-green-600">passed</code>
										</td>
										<td className="py-2">
											All primary assertions passed. The test case met the
											evaluation criteria.
										</td>
									</tr>
									<tr>
										<td className="py-2">
											<code className="text-red-600">failed</code>
										</td>
										<td className="py-2">
											One or more primary assertions failed. The output did not
											meet the evaluation criteria.
										</td>
									</tr>
									<tr>
										<td className="py-2">
											<code className="text-orange-600">error</code>
										</td>
										<td className="py-2">
											Execution or infrastructure failure (e.g., executor
											timeout, LLM error, network failure).
										</td>
									</tr>
								</tbody>
							</table>
						</div>

						<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
							<div className="flex items-start gap-3">
								<AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
								<div>
									<h3 className="font-semibold text-yellow-700 dark:text-yellow-300 mb-2">
										Important Note
									</h3>
									<p className="text-sm text-yellow-600 dark:text-yellow-400">
										<code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">
											skipped
										</code>{" "}
										is deprecated for new code. Use{" "}
										<code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">
											passed
										</code>{" "}
										with{" "}
										<code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">
											assertionsJson
										</code>{" "}
										indicating skip reason if needed.
									</p>
								</div>
							</div>
						</div>
					</Card>

					{/* assertionsJson */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">
							assertionsJson (Optional)
						</h2>

						<div className="space-y-4">
							<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
								<p className="text-sm text-blue-600 dark:text-blue-400">
									<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
										assertionsJson
									</code>{" "}
									may exist{" "}
									<strong>
										even when <code>status=passed</code>
									</strong>
									. This supports:
								</p>
								<ul className="text-sm text-blue-600 dark:text-blue-400 mt-2 space-y-1">
									<li>
										• <strong>Passed functional, failed safety:</strong> Output
										passed correctness checks but failed a safety assertion
										(e.g., PII detected, toxicity)
									</li>
									<li>
										• <strong>Partial results:</strong> Some assertion
										categories can be computed independently. All results are
										stored for audit and compliance
									</li>
								</ul>
							</div>

							<div>
								<h3 className="font-semibold mb-3">Envelope Shape</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`{
  "pii": false,
  "toxicity": false,
  "json_schema": true,
  "functional": true
}`}</pre>
								</div>
							</div>

							<div className="space-y-3">
								<h3 className="font-semibold">Key Points</h3>
								<ul className="text-sm text-muted-foreground space-y-2">
									<li className="flex items-start gap-2">
										<div className="h-2 w-2 rounded-full bg-green-500 mt-1.5"></div>
										<div>
											<strong>Known keys:</strong>{" "}
											<code className="bg-muted px-1 rounded">pii</code>,{" "}
											<code className="bg-muted px-1 rounded">toxicity</code>,{" "}
											<code className="bg-muted px-1 rounded">json_schema</code>
											,{" "}
											<code className="bg-muted px-1 rounded">functional</code>,{" "}
											<code className="bg-muted px-1 rounded">safety</code>,{" "}
											<code className="bg-muted px-1 rounded">judge</code>
										</div>
									</li>
									<li className="flex items-start gap-2">
										<div className="h-2 w-2 rounded-full bg-red-500 mt-1.5"></div>
										<div>
											<strong>Unknown keys</strong> must be rejected or stored
											in <code className="bg-muted px-1 rounded">meta</code>{" "}
											only—they do not count toward safety/compliance
										</div>
									</li>
									<li className="flex items-start gap-2">
										<div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5"></div>
										<div>
											<strong>Write boundary:</strong> All producers must use
											the shared transformer/validator before writing. Reject
											unknown assertion keys at the write boundary
										</div>
									</li>
								</ul>
							</div>
						</div>
					</Card>

					{/* Consistency Rules */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Consistency Rules</h2>

						<div className="space-y-4">
							<div className="border-l-4 border-green-500 pl-4">
								<h3 className="font-semibold text-green-600 mb-1">
									1. Universal Production
								</h3>
								<p className="text-sm text-muted-foreground">
									Every evaluator produces{" "}
									<code className="bg-muted px-1 rounded">status</code> +
									optional{" "}
									<code className="bg-muted px-1 rounded">assertionsJson</code>{" "}
									consistently.
								</p>
							</div>

							<div className="border-l-4 border-blue-500 pl-4">
								<h3 className="font-semibold text-blue-600 mb-1">
									2. Passed Status Meaning
								</h3>
								<p className="text-sm text-muted-foreground">
									<code className="bg-muted px-1 rounded">status=passed</code>{" "}
									means the primary evaluation gate passed. It does NOT imply
									all safety assertions passed—check{" "}
									<code className="bg-muted px-1 rounded">assertionsJson</code>{" "}
									for that.
								</p>
							</div>

							<div className="border-l-4 border-red-500 pl-4">
								<h3 className="font-semibold text-red-600 mb-1">
									3. Failed Status Meaning
								</h3>
								<p className="text-sm text-muted-foreground">
									<code className="bg-muted px-1 rounded">status=failed</code>{" "}
									means the primary gate failed.{" "}
									<code className="bg-muted px-1 rounded">assertionsJson</code>{" "}
									may provide breakdown.
								</p>
							</div>

							<div className="border-l-4 border-orange-500 pl-4">
								<h3 className="font-semibold text-orange-600 mb-1">
									4. Error Status Meaning
								</h3>
								<p className="text-sm text-muted-foreground">
									<code className="bg-muted px-1 rounded">status=error</code>{" "}
									means execution failed before assertions could run.{" "}
									<code className="bg-muted px-1 rounded">error</code> field
									should be populated.
								</p>
							</div>
						</div>
					</Card>

					{/* Status Examples */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Status Examples</h2>

						<div className="space-y-6">
							<div>
								<h3 className="font-semibold mb-2 flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-500" />
									Functional Pass, Safety Fail
								</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`{
  "status": "passed",
  "assertionsJson": {
    "functional": true,
    "pii": false,
    "toxicity": true,
    "safety": false
  },
  "output": "The answer is 42",
  "error": null
}`}</pre>
								</div>
								<p className="text-sm text-muted-foreground mt-2">
									The answer is correct (functional pass) but contains toxic
									content (safety fail).
								</p>
							</div>

							<div>
								<h3 className="font-semibold mb-2 flex items-center gap-2">
									<XCircle className="h-4 w-4 text-red-500" />
									Functional Fail
								</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`{
  "status": "failed",
  "assertionsJson": {
    "functional": false,
    "json_schema": true,
    "pii": false
  },
  "output": "I don't understand the question",
  "error": null
}`}</pre>
								</div>
								<p className="text-sm text-muted-foreground mt-2">
									The output doesn't meet the functional requirements, so status
									is failed.
								</p>
							</div>

							<div>
								<h3 className="font-semibold mb-2 flex items-center gap-2">
									<AlertCircle className="h-4 w-4 text-orange-500" />
									Execution Error
								</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`{
  "status": "error",
  "assertionsJson": null,
  "output": null,
  "error": "LLM API timeout after 30 seconds"
}`}</pre>
								</div>
								<p className="text-sm text-muted-foreground mt-2">
									Execution failed before assertions could run.
								</p>
							</div>
						</div>
					</Card>

					{/* Producers */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Producers</h2>

						<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto mb-4">
							<table className="w-full">
								<thead>
									<tr className="border-b">
										<th className="text-left py-2">Producer</th>
										<th className="text-left py-2">Location</th>
										<th className="text-left py-2">Notes</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td className="py-2">
											<code>EvaluationService.run</code>
										</td>
										<td className="py-2">
											<code>src/lib/services/evaluation.service.ts</code>
										</td>
										<td className="py-2">Unit test, model eval, A/B test</td>
									</tr>
									<tr>
										<td className="py-2">
											<code>ShadowEvalService</code>
										</td>
										<td className="py-2">
											<code>src/lib/services/shadow-eval.service.ts</code>
										</td>
										<td className="py-2">Shadow evals</td>
									</tr>
									<tr>
										<td className="py-2">
											<code>EvalWorker</code>
										</td>
										<td className="py-2">
											<code>src/lib/workers/eval-worker.ts</code>
										</td>
										<td className="py-2">Async worker path</td>
									</tr>
									<tr>
										<td className="py-2">
											<code>Trace-linked executor</code>
										</td>
										<td className="py-2">
											<code>src/lib/services/eval-executor.ts</code>
										</td>
										<td className="py-2">Trace-linked runs</td>
									</tr>
								</tbody>
							</table>
						</div>

						<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
							<p className="text-sm text-blue-600 dark:text-blue-400">
								All must use{" "}
								<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
									runAssertions()
								</code>{" "}
								(when enabled) and the shared assertion envelope before
								inserting into{" "}
								<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
									test_results
								</code>
								.
							</p>
						</div>
					</Card>

					{/* Implementation Guidelines */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
							<Code className="h-5 w-5" />
							Implementation Guidelines
						</h2>
						<div className="space-y-4">
							<div>
								<h3 className="font-semibold mb-2">Validation Pipeline</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{validationSnippet}</pre>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-2">Best Practices</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Always validate at write boundary</li>
									<li>• Use shared assertion envelope transformer</li>
									<li>• Log assertion results for debugging</li>
									<li>• Handle partial results gracefully</li>
									<li>• Provide meaningful error messages</li>
								</ul>
							</div>
						</div>
					</Card>

					{/* Next Steps */}
					<Card className="p-6">
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
									<Link href="/docs/integration-reference">
										Integration Reference{" "}
										<ArrowRight className="ml-2 h-4 w-4" />
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
