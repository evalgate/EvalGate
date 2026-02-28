"use client";

import {
	AlertTriangle,
	ArrowRight,
	CheckCircle,
	Eye,
	Shield,
} from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

export default function ShareLinksPage() {
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
							<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
								<Shield className="h-6 w-6 text-green-500" />
							</div>
							<div>
								<h1 className="text-3xl sm:text-4xl font-bold mb-2">
									Share Link Privacy
								</h1>
								<p className="text-lg text-muted-foreground">
									How export data is validated and privacy-scrubbed for public
									sharing
								</p>
							</div>
						</div>
					</div>

					{/* Overview */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">
							Privacy Scrubbing Overview
						</h2>
						<p className="text-muted-foreground mb-4">
							This document describes how export data is validated and what
							guarantees the
							<code className="bg-muted px-1 rounded">
								privacyScrubbed: true
							</code>{" "}
							flag provides when viewing shared evaluations.
						</p>

						<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
							<div className="flex items-start gap-3">
								<Shield className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
								<div>
									<h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">
										Security Guarantee
									</h3>
									<p className="text-sm text-green-600 dark:text-green-400">
										Export data for public share links is validated at publish
										time. unknown sensitive data is rejected before storage - no
										secrets can ever reach the public.
									</p>
								</div>
							</div>
						</div>
					</Card>

					{/* What Is Scrubbed */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">What Is Scrubbed</h2>
						<p className="text-muted-foreground mb-4">
							Export data for public share links is validated at publish time.
							The following are
							<strong> rejected</strong> (never stored):
						</p>

						<div className="space-y-6">
							<div>
								<h3 className="font-semibold mb-3 text-red-600">
									❌ Secret-like Keys
								</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Case-insensitive, unknownwhere in the object tree:
								</p>
								<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
									<div className="grid gap-2 md:grid-cols-3 text-sm">
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												apiKey
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												api_key
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												authorization
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												bearer
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												bearer_token
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												secret
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												password
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												token
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												organizationId
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												organization_id
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												userId
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												user_id
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												createdBy
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												created_by
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												annotatorId
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												annotator_id
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												internalNotes
											</code>
										</div>
										<div>
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												internal_notes
											</code>
										</div>
									</div>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-3 text-red-600">
									❌ Secret-like Values
								</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Detected in strings:
								</p>
								<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
									<div className="space-y-2 text-sm">
										<div>
											• OpenAI-style API keys (
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												sk-...
											</code>
											)
										</div>
										<div>• Bearer tokens</div>
										<div>• JWTs (JSON Web Tokens)</div>
									</div>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-3 text-red-600">
									❌ Unauthorized Top-level Keys
								</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Top-level keys not in the allowlist are rejected:
								</p>
								<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
									<div className="space-y-2 text-sm">
										<div>
											•{" "}
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												_internal
											</code>
										</div>
										<div>
											•{" "}
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												share_id
											</code>
										</div>
										<div>
											•{" "}
											<code className="bg-red-100 dark:bg-red-800 px-1 rounded">
												published_at
											</code>
										</div>
									</div>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-3 text-green-600">
									✅ Allowed Top-level Keys
								</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Only these keys are permitted in shared exports:
								</p>
								<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
									<div className="grid gap-2 md:grid-cols-3 text-sm">
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												evaluation
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												timestamp
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												summary
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												qualityScore
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												type
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												testResults
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												evaluations
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												judgeEvaluations
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												criteria
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												interRaterReliability
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												variants
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												results
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												statisticalSignificance
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												comparison
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												codeValidation
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												judgePrompt
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												judgeModel
											</code>
										</div>
										<div>
											<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
												aggregateMetrics
											</code>
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className="mt-4 p-3 bg-muted rounded-lg text-xs">
							<strong>Implementation:</strong>{" "}
							<code className="bg-background px-1 rounded">
								src/lib/shared-exports/sanitize.ts
							</code>
						</div>
					</Card>

					{/* When Scrubbing Happens */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">
							When Scrubbing Happens
						</h2>

						<div className="space-y-6">
							<div className="border-l-4 border-blue-500 pl-4">
								<h3 className="font-semibold mb-2 flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-blue-500" />
									Write-time Only
								</h3>
								<p className="text-sm text-muted-foreground mb-3">
									The single write path for{" "}
									<code className="bg-muted px-1 rounded">shared_exports</code>{" "}
									uses
									<code className="bg-muted px-1 rounded">
										prepareExportForShare()
									</code>{" "}
									(sanitize + validate). All inserts/updates to{" "}
									<code className="bg-muted px-1 rounded">
										shared_exports.exportData
									</code>{" "}
									go through this path.
								</p>
								<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
									<p className="text-sm text-blue-600 dark:text-blue-400">
										If unknown forbidden keys or secret-like values are
										detected, the request fails with a validation error.
										<strong>
											No unsanitized export can ever be persisted.
										</strong>
									</p>
								</div>
							</div>

							<div className="border-l-4 border-green-500 pl-4">
								<h3 className="font-semibold mb-2 flex items-center gap-2">
									<Eye className="h-4 w-4 text-green-500" />
									Read-time
								</h3>
								<p className="text-sm text-muted-foreground mb-3">
									The export endpoint{" "}
									<code className="bg-muted px-1 rounded">
										GET /api/exports/[shareId]
									</code>{" "}
									returns stored
									<code className="bg-muted px-1 rounded">exportData</code>{" "}
									(already validated at publish) and sets
									<code className="bg-muted px-1 rounded">
										privacyScrubbed: true
									</code>{" "}
									in the DTO.
								</p>
							</div>
						</div>
					</Card>

					{/* What privacyScrubbed Means */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">
							What{" "}
							<code className="bg-muted px-1 rounded">
								privacyScrubbed: true
							</code>{" "}
							Means
						</h2>

						<div className="space-y-4">
							<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
								<h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">
									✅ What It Guarantees
								</h3>
								<ul className="text-sm text-green-600 dark:text-green-400 space-y-1">
									<li>
										• Export data was <strong>validated</strong> at publish time
									</li>
									<li>• No PII/secrets in the payload</li>
									<li>
										• Implementation uses{" "}
										<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
											assertNoSecrets
										</code>{" "}
										(rejects)
									</li>
									<li>• Data with secrets never reaches storage</li>
								</ul>
							</div>

							<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
								<h3 className="font-semibold text-yellow-700 dark:text-yellow-300 mb-2 flex items-center gap-2">
									<AlertTriangle className="h-4 w-4" />
									⚠️ What It Does NOT Mean
								</h3>
								<ul className="text-sm text-yellow-600 dark:text-yellow-400 space-y-1">
									<li>
										• No PII in evaluation names or descriptions — those are
										allowed and may contain user-provided text
									</li>
									<li>
										• No scrubbing of content within allowed fields (e.g. test
										case inputs/outputs)
									</li>
									<li>
										• Content filtering or sanitization of user-provided text
									</li>
								</ul>
							</div>
						</div>
					</Card>

					{/* Security Flow */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Security Flow</h2>
						<div className="space-y-4">
							<div className="flex items-center gap-4">
								<div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
									1
								</div>
								<div>
									<h3 className="font-semibold">Export Request</h3>
									<p className="text-sm text-muted-foreground">
										User requests to share evaluation data
									</p>
								</div>
							</div>

							<div className="flex items-center gap-4">
								<div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold">
									2
								</div>
								<div>
									<h3 className="font-semibold">Validation</h3>
									<p className="text-sm text-muted-foreground">
										<code className="bg-muted px-1 rounded">
											prepareExportForShare()
										</code>{" "}
										scans for secrets and forbidden keys
									</p>
								</div>
							</div>

							<div className="flex items-center gap-4">
								<div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">
									3
								</div>
								<div>
									<h3 className="font-semibold">Storage</h3>
									<p className="text-sm text-muted-foreground">
										Only validated data is stored with{" "}
										<code className="bg-muted px-1 rounded">
											privacyScrubbed: true
										</code>
									</p>
								</div>
							</div>

							<div className="flex items-center gap-4">
								<div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold">
									4
								</div>
								<div>
									<h3 className="font-semibold">Public Access</h3>
									<p className="text-sm text-muted-foreground">
										unknownone can view the scrubbed data via share link
									</p>
								</div>
							</div>
						</div>
					</Card>

					{/* Related Documentation */}
					<Card className="p-6">
						<h2 className="text-xl font-semibold mb-4">
							Related Documentation
						</h2>
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<h3 className="font-semibold mb-2">Exporting and Sharing</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Full export and share workflow guide
								</p>
								<Button variant="outline" size="sm" asChild>
									<Link href="/docs/exporting-sharing">
										View Guide <ArrowRight className="ml-2 h-3 w-3" />
									</Link>
								</Button>
							</div>

							<div>
								<h3 className="font-semibold mb-2">API Contract</h3>
								<p className="text-sm text-muted-foreground mb-3">
									ShareExportDTO shape and specifications
								</p>
								<Button variant="outline" size="sm" asChild>
									<Link href="/docs/api-contract">
										View Contract <ArrowRight className="ml-2 h-3 w-3" />
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
