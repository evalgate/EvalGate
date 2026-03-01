"use client";

import { ArrowRight, FileText, Shield, Zap } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

export default function ApiContractPage() {
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
							<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
								<FileText className="h-6 w-6 text-blue-500" />
							</div>
							<div>
								<h1 className="text-3xl sm:text-4xl font-bold mb-2">
									API Contract
								</h1>
								<p className="text-lg text-muted-foreground">
									Public API specification and response schemas
								</p>
							</div>
						</div>
						<div className="flex flex-wrap gap-4">
							<div className="flex items-center gap-2 text-sm text-green-600">
								<Shield className="h-4 w-4" />
								Stable contract
							</div>
							<div className="flex items-center gap-2 text-sm text-green-600">
								<Zap className="h-4 w-4" />
								OpenAPI available
							</div>
						</div>
					</div>

					{/* Notice */}
					<Card className="p-6 mb-8 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
						<div className="flex items-start gap-3">
							<Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
							<div>
								<h2 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
									Stability Commitment
								</h2>
								<p className="text-sm text-blue-600 dark:text-blue-400">
									Fields documented here are stable. Breaking changes will be
									versioned and announced. See{" "}
									<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
										docs/openapi.json
									</code>{" "}
									for machine-readable schema.
								</p>
							</div>
						</div>
					</Card>

					{/* Standard Error Envelope */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">
							1. Standard Error Envelope
						</h2>
						<p className="text-muted-foreground mb-4">
							All API errors return this JSON shape:
						</p>
						<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto mb-4">
							<pre>{`{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Unauthorized",
    "details": null,
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}`}</pre>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<h3 className="font-semibold mb-2">Error Codes</h3>
								<div className="bg-muted rounded-lg p-3 text-sm">
									<code>
										UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR,
										RATE_LIMITED, CONFLICT, INTERNAL_ERROR, SERVICE_UNAVAILABLE,
										QUOTA_EXCEEDED, NO_ORG_MEMBERSHIP
									</code>
								</div>
							</div>
							<div>
								<h3 className="font-semibold mb-2">HTTP Status Mapping</h3>
								<div className="space-y-1 text-sm">
									<div>
										<code className="bg-muted px-1 rounded">UNAUTHORIZED</code>{" "}
										→ 401
									</div>
									<div>
										<code className="bg-muted px-1 rounded">FORBIDDEN</code> →
										403
									</div>
									<div>
										<code className="bg-muted px-1 rounded">NOT_FOUND</code> →
										404
									</div>
									<div>
										<code className="bg-muted px-1 rounded">
											VALIDATION_ERROR
										</code>{" "}
										→ 400
									</div>
									<div>
										<code className="bg-muted px-1 rounded">RATE_LIMITED</code>{" "}
										→ 429
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* MCP Response Shape */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">
							2. MCP Response Shape
						</h2>

						<div className="space-y-6">
							<div>
								<h3 className="font-semibold mb-2">
									GET /api/mcp/tools (anonymous)
								</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`{
  "mcpVersion": "1",
  "tools": [
    {
      "name": "string",
      "description": "string",
      "inputSchema": { "type": "object", "properties": { ... } },
      "version": "string (optional)",
      "longRunning": "boolean (optional)"
    }
  ]
}`}</pre>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-2">
									POST /api/mcp/call (authenticated)
								</h3>
								<div className="grid gap-4 md:grid-cols-2">
									<div>
										<h4 className="text-sm font-medium mb-2">Success (200)</h4>
										<div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-x-auto">
											<pre>{`{
  "ok": true,
  "content": [
    { "type": "json", "json": { /* tool-specific result */ } },
    { "type": "text", "text": "..." }
  ]
}`}</pre>
										</div>
									</div>
									<div>
										<h4 className="text-sm font-medium mb-2">
											Error (4xx/5xx)
										</h4>
										<div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-x-auto">
											<pre>{`{
  "ok": false,
  "error": {
    "code": "string",
    "message": "string",
    "requestId": "uuid"
  }
}`}</pre>
										</div>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* Quality Score Response */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">
							3. Quality Score Response Shape
						</h2>

						<div className="space-y-6">
							<div>
								<h3 className="font-semibold mb-2">
									GET /api/quality?evaluationId=&action=latest
								</h3>
								<div className="grid gap-4 md:grid-cols-2">
									<div>
										<h4 className="text-sm font-medium mb-2">
											When score exists (200)
										</h4>
										<div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-x-auto max-h-48">
											<pre>{`{
  "id": 1,
  "evaluationRunId": 1,
  "evaluationId": 1,
  "organizationId": 1,
  "score": 85,
  "total": 10,
  "traceCoverageRate": "1.0",
  "provenanceCoverageRate": "0.9",
  "breakdown": {},
  "flags": [],
  "evidenceLevel": "strong",
  "scoringVersion": "v1",
  "model": null,
  "createdAt": "2024-01-15T12:00:00.000Z",
  "baselineScore": 80,
  "regressionDelta": 5,
  "regressionDetected": false,
  "baselineMissing": false
}`}</pre>
										</div>
									</div>
									<div>
										<h4 className="text-sm font-medium mb-2">
											When no scores yet (200)
										</h4>
										<div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-x-auto">
											<pre>{`{
  "score": null,
  "message": "No quality scores computed yet"
}`}</pre>
										</div>
									</div>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-2">
									POST /api/quality (recompute)
								</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`{
  "success": true,
  "runId": 1,
  "score": 92,
  "breakdown": {},
  "flags": [],
  "evidenceLevel": "strong",
  "scoringVersion": "v1",
  "scoringSpecHash": "sha256-hex"
}`}</pre>
								</div>
							</div>
						</div>
					</Card>

					{/* Runs Import */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">4. Runs Import</h2>
						<p className="text-muted-foreground mb-4">
							POST /api/evaluations/[id]/runs/import - Import local run results
							for an existing evaluation.
						</p>

						<div className="space-y-4">
							<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
								<p className="text-sm text-yellow-700 dark:text-yellow-300">
									<strong>Headers:</strong>{" "}
									<code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">
										Idempotency-Key
									</code>{" "}
									(optional) — prevents duplicate runs on CI retry
								</p>
							</div>

							<div>
								<h3 className="font-semibold mb-2">Request Body</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`{
  "environment": "dev",
  "importClientVersion": "1.5.0",
  "results": [
    { "testCaseId": 1, "status": "passed", "output": "...", "latencyMs": 100 }
  ]
}`}</pre>
								</div>
								<p className="text-sm text-muted-foreground mt-2">
									<strong>Policy:</strong> All-or-nothing. Invalid test cases
									reject the entire request.
								</p>
							</div>

							<div>
								<h3 className="font-semibold mb-2">
									Response (201 or 200 on idempotent replay)
								</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`{
  "runId": 1,
  "score": 85,
  "flags": [],
  "dashboardUrl": "https://.../evaluations/42/runs/1"
}`}</pre>
								</div>
							</div>
						</div>
					</Card>

					{/* Report Payload */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">
							5. Report Payload Schema
						</h2>
						<p className="text-muted-foreground mb-4">
							POST /api/reports (create report) - Generate signed shareable
							reports
						</p>

						<div className="space-y-4">
							<div>
								<h3 className="font-semibold mb-2">Request</h3>
								<div className="bg-muted rounded-lg p-3 font-mono text-sm">
									<code>{`{ evaluationId, evaluationRunId, expiresInDays?, policyName? }`}</code>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-2">Response (201)</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`{
  "shareToken": "hex",
  "shareUrl": "https://.../r/{shareToken}",
  "apiUrl": "https://.../api/r/{shareToken}",
  "expiresAt": "2024-02-15T00:00:00.000Z"
}`}</pre>
								</div>
							</div>
						</div>
					</Card>

					{/* Versioning */}
					<Card className="p-6">
						<h2 className="text-xl font-semibold mb-4">Versioning</h2>
						<div className="space-y-2 text-sm">
							<div>
								<strong>Error envelope:</strong> Stable since v1
							</div>
							<div>
								<strong>Report payload:</strong>{" "}
								<code className="bg-muted px-1 rounded">version: "2.0"</code>;{" "}
								<code className="bg-muted px-1 rounded">
									signatureAlgorithm: "hmac-sha256-v1"
								</code>
							</div>
							<div>
								<strong>Quality:</strong>{" "}
								<code className="bg-muted px-1 rounded">
									scoringVersion: "v1"
								</code>
								; <code className="bg-muted px-1 rounded">scoringSpecHash</code>{" "}
								for audit
							</div>
						</div>
					</Card>

					{/* Next Steps */}
					<Card className="p-6 mt-8">
						<div className="text-center">
							<h2 className="text-xl font-semibold mb-4">Explore More</h2>
							<div className="flex justify-center gap-4">
								<Button variant="outline" asChild>
									<Link href="/api-reference">
										Full API Reference <ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
								<Button asChild>
									<Link href="/docs/openapi.json" target="_blank">
										Download OpenAPI Schema{" "}
										<ArrowRight className="ml-2 h-4 w-4" />
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
