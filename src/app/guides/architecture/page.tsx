"use client";

import { ArrowRight, FolderTree, GitBranch, Package } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

export default function ArchitecturePage() {
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
						<h1 className="text-3xl sm:text-4xl font-bold mb-4">
							Architecture Overview
						</h1>
						<p className="text-lg text-muted-foreground mb-6">
							Understanding the structure and components of the AI Evaluation
							Platform
						</p>
					</div>

					{/* Project Structure */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
							<FolderTree className="h-5 w-5" />
							Project Structure
						</h2>
						<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
							<pre>{`ai-evaluation-platform/
├── src/app/              # Next.js App Router pages
│   ├── api/              # REST API routes (55+ endpoints)
│   │   ├── evaluations/  # Eval CRUD, runs, test-cases, publish
│   │   ├── llm-judge/    # LLM Judge evaluate, configs, alignment
│   │   ├── traces/       # Distributed tracing + spans
│   │   └── ...
├── src/packages/sdk/     # TypeScript SDK (@pauly4010/evalai-sdk)
├── src/lib/              # Core services, utilities, templates
├── src/db/               # Database layer (Drizzle ORM schema)
└── drizzle/              # Database migrations`}</pre>
						</div>
					</Card>

					{/* Key Components */}
					<div className="grid gap-6 mb-8">
						<Card className="p-6">
							<div className="flex items-center gap-3 mb-4">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
									<GitBranch className="h-5 w-5 text-blue-500" />
								</div>
								<h3 className="text-lg font-semibold">Next.js App Router</h3>
							</div>
							<p className="text-muted-foreground mb-3">
								Modern React framework with App Router for optimal performance
								and developer experience.
							</p>
							<ul className="text-sm text-muted-foreground space-y-1">
								<li>• Server-side rendering with React Server Components</li>
								<li>
									• 55+ API endpoints for evaluations, traces, and LLM judge
								</li>
								<li>• Authentication middleware and protected routes</li>
								<li>• Responsive UI with Tailwind CSS</li>
							</ul>
						</Card>

						<Card className="p-6">
							<div className="flex items-center gap-3 mb-4">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
									<Package className="h-5 w-5 text-green-500" />
								</div>
								<h3 className="text-lg font-semibold">TypeScript SDK</h3>
							</div>
							<p className="text-muted-foreground mb-3">
								Published as @pauly4010/evalai-sdk to npm for easy integration.
							</p>
							<ul className="text-sm text-muted-foreground space-y-1">
								<li>• Full TypeScript support with type definitions</li>
								<li>• OpenAI integration helpers</li>
								<li>• Evaluation runners and assertions</li>
								<li>• Tracing and monitoring capabilities</li>
							</ul>
						</Card>

						<Card className="p-6">
							<div className="flex items-center gap-3 mb-4">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
									<FolderTree className="h-5 w-5 text-purple-500" />
								</div>
								<h3 className="text-lg font-semibold">Database Layer</h3>
							</div>
							<p className="text-muted-foreground mb-3">
								Drizzle ORM with PostgreSQL for efficient data management.
							</p>
							<ul className="text-sm text-muted-foreground space-y-1">
								<li>• Type-safe database operations</li>
								<li>• Automatic migrations in drizzle/ directory</li>
								<li>• Optimized for evaluation results and traces</li>
								<li>• Support for both local and cloud deployment</li>
							</ul>
						</Card>
					</div>

					{/* API Endpoints Overview */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">API Endpoints</h2>
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<h3 className="font-semibold mb-2 text-blue-600">
									Evaluations
								</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• CRUD operations for evaluations</li>
									<li>• Test case management</li>
									<li>• Run execution and results</li>
									<li>• Publishing and sharing</li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold mb-2 text-green-600">LLM Judge</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Judge configuration</li>
									<li>• Evaluation execution</li>
									<li>• Alignment and scoring</li>
									<li>• Custom rubrics</li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold mb-2 text-purple-600">Tracing</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Distributed tracing</li>
									<li>• Span management</li>
									<li>• Performance monitoring</li>
									<li>• Error tracking</li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold mb-2 text-orange-600">
									Core Services
								</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Authentication & authorization</li>
									<li>• Organization management</li>
									<li>• API key handling</li>
									<li>• Webhook processing</li>
								</ul>
							</div>
						</div>
					</Card>

					{/* Technology Stack */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Technology Stack</h2>
						<div className="grid gap-4 md:grid-cols-3">
							<div>
								<h3 className="font-semibold mb-2">Frontend</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Next.js 14+ (App Router)</li>
									<li>• React 18+</li>
									<li>• TypeScript</li>
									<li>• Tailwind CSS</li>
									<li>• shadcn/ui components</li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold mb-2">Backend</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Node.js</li>
									<li>• Next.js API routes</li>
									<li>• Drizzle ORM</li>
									<li>• PostgreSQL</li>
									<li>• NextAuth.js</li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold mb-2">Development</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• pnpm package manager</li>
									<li>• Vitest for testing</li>
									<li>• Playwright for e2e</li>
									<li>• ESLint & Biome</li>
									<li>• GitHub Actions CI</li>
								</ul>
							</div>
						</div>
					</Card>

					{/* Next Steps */}
					<Card className="p-6">
						<div className="text-center">
							<h2 className="text-xl font-semibold mb-4">
								Explore the Architecture
							</h2>
							<p className="text-muted-foreground mb-6">
								Dive deeper into specific components and integration patterns
							</p>
							<div className="flex justify-center gap-4">
								<Button variant="outline" asChild>
									<Link href="/guides/local-development">
										Local Development <ArrowRight className="ml-2 h-4 w-4" />
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
