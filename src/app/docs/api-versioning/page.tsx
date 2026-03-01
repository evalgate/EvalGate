"use client";

import { AlertTriangle, ArrowRight, Code, GitBranch } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

export default function APIVersioningPage() {
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
								<GitBranch className="h-6 w-6 text-blue-500" />
							</div>
							<div>
								<h1 className="text-3xl sm:text-4xl font-bold mb-2">
									API Versioning Strategy
								</h1>
								<p className="text-lg text-muted-foreground">
									How we version and maintain API stability for different
									audiences
								</p>
							</div>
						</div>
					</div>

					{/* Current State */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Current State</h2>

						<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto mb-4">
							<table className="w-full">
								<thead>
									<tr className="border-b">
										<th className="text-left py-2">Path</th>
										<th className="text-left py-2">Audience</th>
										<th className="text-left py-2">Stability</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td className="py-2">
											<code>/api/*</code>
										</td>
										<td className="py-2">Internal (dashboard, SDK, MCP)</td>
										<td className="py-2">Can change without notice</td>
									</tr>
									<tr>
										<td className="py-2">
											<code>/api/v1/*</code>
										</td>
										<td className="py-2">
											Public (rewrites to <code>/api/*</code>)
										</td>
										<td className="py-2">
											Same handlers; version prefix for future stability
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</Card>

					{/* Request Headers */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
							<Code className="h-5 w-5" />
							Request Headers (SDK / CLI)
						</h2>
						<p className="text-muted-foreground mb-4">
							All SDK and CLI requests send version headers so the platform can
							identify client versions:
						</p>

						<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto mb-4">
							<table className="w-full">
								<thead>
									<tr className="border-b">
										<th className="text-left py-2">Header</th>
										<th className="text-left py-2">Source</th>
										<th className="text-left py-2">Purpose</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td className="py-2">
											<code>X-EvalGate-SDK-Version</code>
										</td>
										<td className="py-2">
											<code>@evalgate/sdk</code> package version
										</td>
										<td className="py-2">Identify SDK release</td>
									</tr>
									<tr>
										<td className="py-2">
											<code>X-EvalGate-Spec-Version</code>
										</td>
										<td className="py-2">
											<code>docs/openapi.json</code> <code>info.version</code>
										</td>
										<td className="py-2">Identify API spec version</td>
									</tr>
								</tbody>
							</table>
						</div>

						<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
							<p className="text-sm text-blue-600 dark:text-blue-400">
								These headers are sent on every request. The platform can use
								them for compatibility checks, deprecation warnings, and support
								debugging.
							</p>
						</div>
					</Card>

					{/* Policy */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Versioning Policy</h2>

						<div className="space-y-6">
							<div className="border-l-4 border-orange-500 pl-4">
								<h3 className="font-semibold mb-2 text-orange-600">
									Internal API (<code>/api</code>)
								</h3>
								<p className="text-sm text-muted-foreground mb-2">
									Used by the hosted dashboard, SDK, MCP tools, and CI. We may
									add, change, or remove endpoints.
								</p>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>
										• Breaking changes are acceptable for internal consumers
									</li>
									<li>• We coordinate via SDK releases and changelogs</li>
									<li>• No stability guarantees required</li>
								</ul>
							</div>

							<div className="border-l-4 border-green-500 pl-4">
								<h3 className="font-semibold mb-2 text-green-600">
									Public API (<code>/api/v1</code>)
								</h3>
								<p className="text-sm text-muted-foreground mb-2">
									A Next.js rewrite maps <code>/api/v1/*</code> →{" "}
									<code>/api/*</code> so the same handlers serve both.
								</p>
								<p className="text-sm text-muted-foreground mb-3">
									When we document the public API for third-party integrations,
									we will:
								</p>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>
										• Commit to stability guarantees (see{" "}
										<Link
											href="/docs/api-contract"
											className="text-blue-500 hover:underline"
										>
											API contract
										</Link>
										)
									</li>
									<li>
										• Version the OpenAPI spec (e.g. <code>openapi: 3.1.0</code>
										, <code>info.version: "1.0.0"</code>)
									</li>
									<li>• Provide migration paths for breaking changes</li>
									<li>• Maintain backward compatibility when possible</li>
								</ul>
							</div>
						</div>
					</Card>

					{/* Breaking Changes and CI */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">
							Breaking Changes and CI
						</h2>

						<div className="space-y-4">
							<div>
								<h3 className="font-semibold mb-3">
									When the OpenAPI spec changes:
								</h3>
								<ol className="space-y-3">
									<li className="flex items-start gap-3">
										<div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold mt-0.5">
											1
										</div>
										<div>
											<p className="text-sm">
												Add an entry to{" "}
												<code className="bg-muted px-1 rounded">
													docs/OPENAPI_CHANGELOG.md
												</code>{" "}
												for the new version
											</p>
										</div>
									</li>

									<li className="flex items-start gap-3">
										<div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold mt-0.5">
											2
										</div>
										<div>
											<p className="text-sm">
												Run{" "}
												<code className="bg-muted px-1 rounded">
													pnpm version:spec X.Y.Z
												</code>{" "}
												(updates <code>docs/openapi.json</code> and{" "}
												<code>src/packages/sdk/src/version.ts</code>)
											</p>
										</div>
									</li>

									<li className="flex items-start gap-3">
										<div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold mt-0.5">
											3
										</div>
										<div>
											<p className="text-sm">
												Run{" "}
												<code className="bg-muted px-1 rounded">
													pnpm openapi:snapshot
												</code>{" "}
												to update the stored spec hash
											</p>
										</div>
									</li>

									<li className="flex items-start gap-3">
										<div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold mt-0.5">
											4
										</div>
										<div>
											<p className="text-sm">Commit all changes</p>
										</div>
									</li>
								</ol>
							</div>

							<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
								<div className="flex items-start gap-3">
									<AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
									<div>
										<h3 className="font-semibold text-yellow-700 dark:text-yellow-300 mb-2">
											CI Validation
										</h3>
										<p className="text-sm text-yellow-600 dark:text-yellow-400">
											CI runs{" "}
											<code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">
												audit:openapi
											</code>{" "}
											which fails unless:
										</p>
										<ul className="text-sm text-yellow-600 dark:text-yellow-400 mt-2 space-y-1">
											<li>• Snapshot is updated</li>
											<li>• Changelog has the version entry</li>
											<li>
												• <code>info.version</code> matches{" "}
												<code>SPEC_VERSION</code>
											</li>
										</ul>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* Migration Path */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Migration Path</h2>

						<div className="space-y-4">
							<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
								<h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">
									Implementation (Done)
								</h3>
								<ol className="space-y-2 text-sm text-green-600 dark:text-green-400">
									<li>
										1. Next.js rewrite in{" "}
										<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
											next.config.ts
										</code>
										:{" "}
										<code>
											{
												"{ source: '/api/v1/:path*', destination: '/api/:path*' }"
											}
										</code>
									</li>
									<li>
										2. <code>/api/*</code> remains for internal use;
										SDK/dashboard consumers unchanged
									</li>
									<li>
										3. Document versioning and deprecation policy in{" "}
										<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
											docs/api-contract.md
										</code>{" "}
										when ready
									</li>
								</ol>
							</div>
						</div>
					</Card>

					{/* Version Headers Example */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">
							Version Headers Example
						</h2>

						<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
							<pre>{`// Example request headers
GET /api/v1/evaluations/42
Host: eval.ai
Authorization: Bearer sk_test_...
X-EvalGate-SDK-Version: 1.5.0
X-EvalGate-Spec-Version: 1.0.0
Content-Type: application/json`}</pre>
						</div>

						<div className="mt-4 space-y-3">
							<h3 className="font-semibold">Server Response Headers</h3>
							<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
								<pre>{`HTTP/2 200 OK
Content-Type: application/json
X-EvalGate-API-Version: v1
X-EvalGate-Spec-Version: 1.0.0
X-EvalGate-Deprecation-Warning: endpoint will be deprecated on 2024-06-01`}</pre>
							</div>
						</div>
					</Card>

					{/* References */}
					<Card className="p-6">
						<h2 className="text-xl font-semibold mb-4">References</h2>

						<div className="space-y-2">
							<div className="flex items-center gap-2 text-sm">
								<div className="h-2 w-2 rounded-full bg-blue-500"></div>
								<span>
									<strong>OpenAPI spec:</strong>{" "}
									<code className="bg-muted px-1 rounded">
										src/lib/api-docs.ts
									</code>{" "}
									(served at <code>/api/docs</code>)
								</span>
							</div>
							<div className="flex items-center gap-2 text-sm">
								<div className="h-2 w-2 rounded-full bg-green-500"></div>
								<span>
									<strong>Spec changelog:</strong>{" "}
									<code className="bg-muted px-1 rounded">
										docs/OPENAPI_CHANGELOG.md
									</code>{" "}
									(required for hash changes)
								</span>
							</div>
							<div className="flex items-center gap-2 text-sm">
								<div className="h-2 w-2 rounded-full bg-purple-500"></div>
								<span>
									<strong>Contract/stability:</strong>{" "}
									<code className="bg-muted px-1 rounded">
										docs/api-contract.md
									</code>
								</span>
							</div>
							<div className="flex items-center gap-2 text-sm">
								<div className="h-2 w-2 rounded-full bg-orange-500"></div>
								<span>
									<strong>Integration reference:</strong>{" "}
									<code className="bg-muted px-1 rounded">
										docs/INTEGRATION_REFERENCE.md
									</code>
								</span>
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
