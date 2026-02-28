"use client";

import { ArrowRight, CheckCircle, Clock, Database, Zap } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

export default function JobsPage() {
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
								<Clock className="h-6 w-6 text-blue-500" />
							</div>
							<div>
								<h1 className="text-3xl sm:text-4xl font-bold mb-2">
									Background Job Runner
								</h1>
								<p className="text-lg text-muted-foreground">
									DB-backed job queue built on SQLite/Turso for reliable async
									processing
								</p>
							</div>
						</div>
						<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
							<p className="text-sm text-blue-600 dark:text-blue-400">
								Jobs are stored in the{" "}
								<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
									jobs
								</code>{" "}
								table and processed by
								<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
									runDueJobs()
								</code>
								, invoked every minute via Vercel Cron at
								<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
									POST /api/jobs/run
								</code>
								.
							</p>
						</div>
					</div>

					{/* Invariants */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">System Invariants</h2>
						<p className="text-muted-foreground mb-6">
							These are the rules the job system must always obey:
						</p>

						<div className="space-y-6">
							<div className="border-l-4 border-green-500 pl-4">
								<h3 className="font-semibold mb-2 text-green-600">
									1. Idempotency is enforced
								</h3>
								<p className="text-sm text-muted-foreground mb-2">
									At both enqueue-time and handler-time:
								</p>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>
										• Enqueue uses{" "}
										<code className="bg-muted px-1 rounded">
											INSERT … ON CONFLICT DO NOTHING
										</code>{" "}
										on idempotency key
									</li>
									<li>
										• Webhook handler checks existing successful deliveries
										before sending
									</li>
								</ul>
							</div>

							<div className="border-l-4 border-blue-500 pl-4">
								<h3 className="font-semibold mb-2 text-blue-600">
									2. Jobs never get "stuck"
								</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>
										• Worker crashes mid-run → job reclaimable after{" "}
										<code className="bg-muted px-1 rounded">locked_until</code>{" "}
										expires (2 min TTL)
									</li>
									<li>
										• Reclaimed jobs tagged with{" "}
										<code className="bg-muted px-1 rounded">
											JOB_LOCK_TIMEOUT_RECLAIMED
										</code>{" "}
										for traceability
									</li>
								</ul>
							</div>

							<div className="border-l-4 border-purple-500 pl-4">
								<h3 className="font-semibold mb-2 text-purple-600">
									3. Retries are deterministic
								</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>
										• Backoff math is stable (exponential with ±10% jitter)
									</li>
									<li>
										• <code className="bg-muted px-1 rounded">next_run_at</code>{" "}
										stored and queryable for every pending retry
									</li>
									<li>
										•{" "}
										<code className="bg-muted px-1 rounded">
											attempt {">="} maxAttempts
										</code>{" "}
										→ <code className="bg-muted px-1 rounded">dead_letter</code>
									</li>
								</ul>
							</div>

							<div className="border-l-4 border-orange-500 pl-4">
								<h3 className="font-semibold mb-2 text-orange-600">
									4. Observability is not optional
								</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Every attempt records timing, duration, error codes</li>
									<li>
										• Structured logs on enqueue, claim, success, failure,
										reclaim
									</li>
									<li>
										• DLQ searchable by org + type + error code + time window
									</li>
								</ul>
							</div>

							<div className="border-l-4 border-red-500 pl-4">
								<h3 className="font-semibold mb-2 text-red-600">
									5. Payloads are validated
								</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>
										• Max 128 KB serialized size, 10 levels depth, 500 keys
									</li>
									<li>• Zod schema validation per job type (optional skip)</li>
								</ul>
							</div>
						</div>

						<div className="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
							<p className="text-sm text-green-600 dark:text-green-400">
								<strong>Acceptance criteria:</strong> You can answer "What
								failed? why? how often? is it stuck? who owns it?" in under 30
								seconds.
							</p>
						</div>
					</Card>

					{/* Status Lifecycle */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Status Lifecycle</h2>

						<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto mb-4">
							<pre>{`enqueue()  (atomic idempotency via ON CONFLICT DO NOTHING)
    │
    ▼
 pending  ──────────────────────────────────────────────────────────────────┐
    │                                                                        │
    │  optimistic claim (UPDATE WHERE status='pending'                       │
    │    OR (status='running' AND locked_until <= now))                      │
    ▼                                                                        │
 running  ── handler throws, attempt < maxAttempts ──► pending (backoff)    │
    │              │                                                         │
    │              ├── 429 → RATE_LIMITED (Retry-After)                      │
    │              ├── 5xx → UPSTREAM_5XX                                    │
    │              └── other → HANDLER_ERROR                                 │
    │                                                                        │
    │  handler throws, attempt >= maxAttempts                                │
    ├──────────────────────────────────────────────────────────────────────► dead_letter
    │                                                                        │
    │  payload invalid (Zod) at runner time                                  │
    ├──────────────────────────────────────────────────────────────────────► dead_letter
    │                                                                        │
    │  no handler registered                                                 │
    ├──────────────────────────────────────────────────────────────────────► dead_letter
    │                                                                        │
    │  handler succeeds                                                      │
    ▼                                                                        │
 success                                                                     │
                                                                             │
 POST /api/jobs/:id/retry ◄──────────────────────────────────────────────────┘
    │  mode: now | later | reset`}</pre>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
								<h3 className="font-semibold text-green-700 dark:text-green-300 mb-1">
									Terminal States
								</h3>
								<div className="text-sm text-green-600 dark:text-green-400">
									<code>success</code>, <code>dead_letter</code>
								</div>
							</div>
							<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
								<h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-1">
									Retriable States
								</h3>
								<div className="text-sm text-blue-600 dark:text-blue-400">
									<code>pending</code>, <code>running</code> (via TTL reclaim)
								</div>
							</div>
						</div>
					</Card>

					{/* Enqueue Safety */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Enqueue Safety</h2>

						<div className="space-y-6">
							<div>
								<h3 className="font-semibold mb-3 flex items-center gap-2">
									<Database className="h-4 w-4" />
									Atomic Idempotency
								</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`INSERT INTO jobs (...) VALUES (...)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING id`}</pre>
								</div>
								<p className="text-sm text-muted-foreground mt-2">
									If 0 rows returned → conflict → SELECT existing job ID. Two
									concurrent{" "}
									<code className="bg-muted px-1 rounded">enqueue()</code> calls
									with the same idempotencyKey return the same job ID with zero
									duplicates.
								</p>
							</div>

							<div>
								<h3 className="font-semibold mb-3 flex items-center gap-2">
									<CheckCircle className="h-4 w-4" />
									Payload Validation
								</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Before insertion,{" "}
									<code className="bg-muted px-1 rounded">enqueue()</code>{" "}
									validates:
								</p>
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-sm">
										<div className="h-2 w-2 rounded-full bg-green-500"></div>
										<span>
											<strong>Size:</strong> serialized JSON ≤ 128 KB
										</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<div className="h-2 w-2 rounded-full bg-blue-500"></div>
										<span>
											<strong>Depth:</strong> max 10 levels of nesting
										</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<div className="h-2 w-2 rounded-full bg-purple-500"></div>
										<span>
											<strong>Keys:</strong> max 500 total keys
										</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<div className="h-2 w-2 rounded-full bg-orange-500"></div>
										<span>
											<strong>Schema:</strong> Zod validation per job type
											(skippable via{" "}
											<code className="bg-muted px-1 rounded">
												skipValidation: true
											</code>
											)
										</span>
									</div>
								</div>
								<p className="text-sm text-muted-foreground mt-3">
									Violations throw{" "}
									<code className="bg-muted px-1 rounded">EnqueueError</code>{" "}
									with code{" "}
									<code className="bg-muted px-1 rounded">
										PAYLOAD_TOO_LARGE
									</code>{" "}
									or{" "}
									<code className="bg-muted px-1 rounded">PAYLOAD_INVALID</code>
									.
								</p>
							</div>
						</div>
					</Card>

					{/* Job Types */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Common Job Types</h2>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-3">
								<h3 className="font-semibold text-blue-600">
									Webhook Delivery
								</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• HTTP POST to external endpoints</li>
									<li>• Retry on 429/5xx with exponential backoff</li>
									<li>• Signature verification for security</li>
									<li>• Delivery tracking and receipts</li>
								</ul>
							</div>

							<div className="space-y-3">
								<h3 className="font-semibold text-green-600">
									Report Generation
								</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• PDF/CSV export creation</li>
									<li>• Large dataset processing</li>
									<li>• Template rendering</li>
									<li>• Email delivery</li>
								</ul>
							</div>

							<div className="space-y-3">
								<h3 className="font-semibold text-purple-600">Data Cleanup</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Retention policy enforcement</li>
									<li>• Cache invalidation</li>
									<li>• Archive old records</li>
									<li>• GDPR compliance tasks</li>
								</ul>
							</div>

							<div className="space-y-3">
								<h3 className="font-semibold text-orange-600">Notifications</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Email notifications</li>
									<li>• Slack/Discord integrations</li>
									<li>• SMS alerts</li>
									<li>• Push notifications</li>
								</ul>
							</div>
						</div>
					</Card>

					{/* Error Handling */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">
							Error Handling & Retries
						</h2>

						<div className="space-y-4">
							<div>
								<h3 className="font-semibold mb-2">Retry Strategy</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`// Exponential backoff with jitter
delay = baseDelay * (2 ^ attempt) * (0.9 + Math.random() * 0.2)

// Max attempts by job type
webhook: 5 attempts (1s, 2s, 4s, 8s, 16s)
report: 3 attempts (30s, 60s, 120s)
cleanup: 2 attempts (5m, 15m)`}</pre>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-2">Error Classification</h3>
								<div className="grid gap-3 md:grid-cols-2">
									<div className="space-y-2">
										<h4 className="text-sm font-medium text-red-600">
											Retryable Errors
										</h4>
										<ul className="text-xs text-muted-foreground space-y-1">
											<li>
												• <code>RATE_LIMITED</code> - HTTP 429
											</li>
											<li>
												• <code>UPSTREAM_5XX</code> - Server errors
											</li>
											<li>
												• <code>TIMEOUT</code> - Network timeouts
											</li>
											<li>
												• <code>NETWORK_ERROR</code> - Connection failures
											</li>
										</ul>
									</div>
									<div className="space-y-2">
										<h4 className="text-sm font-medium text-orange-600">
											Non-Retryable Errors
										</h4>
										<ul className="text-xs text-muted-foreground space-y-1">
											<li>
												• <code>HANDLER_ERROR</code> - Logic errors
											</li>
											<li>
												• <code>PAYLOAD_INVALID</code> - Validation failures
											</li>
											<li>
												• <code>AUTHENTICATION_FAILED</code> - Auth errors
											</li>
											<li>
												• <code>NOT_FOUND</code> - Missing resources
											</li>
										</ul>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* Monitoring */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
							<Zap className="h-5 w-5" />
							Monitoring & Observability
						</h2>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-3">
								<h3 className="font-semibold">Metrics</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Queue depth by job type</li>
									<li>• Processing latency (P50, P95, P99)</li>
									<li>• Success/failure rates</li>
									<li>• Retry attempt distributions</li>
								</ul>
							</div>

							<div className="space-y-3">
								<h3 className="font-semibold">Alerting</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• DLQ size thresholds</li>
									<li>• High retry rates</li>
									<li>• Stuck job detection</li>
									<li>• Processing latency spikes</li>
								</ul>
							</div>

							<div className="space-y-3">
								<h3 className="font-semibold">Logs</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Structured JSON logs</li>
									<li>• Job lifecycle events</li>
									<li>• Error stack traces</li>
									<li>• Performance timing</li>
								</ul>
							</div>

							<div className="space-y-3">
								<h3 className="font-semibold">Debugging</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Job inspection UI</li>
									<li>• Manual retry controls</li>
									<li>• Payload preview</li>
									<li>• Execution history</li>
								</ul>
							</div>
						</div>
					</Card>

					{/* API Endpoints */}
					<Card className="p-6">
						<h2 className="text-xl font-semibold mb-4">API Endpoints</h2>

						<div className="space-y-4">
							<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
								<pre>{`POST /api/jobs/enqueue
{
  "type": "webhook_delivery",
  "payload": { "url": "...", "data": {...} },
  "idempotencyKey": "unique-key",
  "runAt": "2024-01-15T10:30:00Z",  // optional
  "priority": "normal"  // low | normal | high
}

POST /api/jobs/run
// Cron endpoint - processes due jobs

GET /api/jobs/:id
// Job status and metadata

POST /api/jobs/:id/retry
{
  "mode": "now" | "later" | "reset"
}`}</pre>
							</div>
						</div>
					</Card>

					{/* Next Steps */}
					<Card className="p-6 mt-8">
						<div className="text-center">
							<h2 className="text-xl font-semibold mb-4">Learn More</h2>
							<div className="flex justify-center gap-4">
								<Button variant="outline" asChild>
									<Link href="/docs/api-contract">
										API Contract <ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
								<Button variant="outline" asChild>
									<Link href="/docs/stability">
										System Stability <ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
								<Button asChild>
									<Link href="/dashboard">
										View Job Queue <ArrowRight className="ml-2 h-4 w-4" />
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
