"use client";

import { ArrowRight, CheckCircle, Play } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

export default function LocalDevelopmentPage() {
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
						<h1 className="text-3xl sm:text-4xl font-bold mb-4">
							Local Development
						</h1>
						<p className="text-lg text-muted-foreground mb-6">
							Set up your development environment to contribute to the AI
							Evaluation Platform
						</p>
						<div className="space-y-2 text-sm">
							<div className="flex items-center gap-2 text-sm text-green-600">
								<CheckCircle className="h-4 w-4" />
								<span>Node.js {"&gt;="} 18</span>
							</div>
							<div className="flex items-center gap-2 text-sm text-green-600">
								<CheckCircle className="h-4 w-4" />
								<span>pnpm {"&gt;="} 10</span>
							</div>
							<div className="flex items-center gap-2 text-sm text-green-600">
								<CheckCircle className="h-4 w-4" />
								TypeScript
							</div>
						</div>
					</div>

					{/* Prerequisites */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Prerequisites</h2>
						<div className="space-y-4">
							<div className="flex items-start gap-3">
								<div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold mt-0.5">
									1
								</div>
								<div>
									<h3 className="font-semibold">Install Node.js &amp; pnpm</h3>
									<p className="text-sm text-muted-foreground">
										Make sure you have Node.js version 18 or higher installed
									</p>
									<div className="bg-muted rounded-lg p-3 font-mono text-sm mt-2">
										<code>node --version</code>
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold mt-0.5">
									2
								</div>
								<div>
									<h3 className="font-semibold">pnpm {">="} 10</h3>
									<p className="text-sm text-muted-foreground">
										Install pnpm package manager if you don't have it
									</p>
									<div className="bg-muted rounded-lg p-3 font-mono text-sm mt-2">
										<code>npm install -g pnpm</code>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* Setup Steps */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Setup Instructions</h2>
						<div className="space-y-6">
							<div className="flex items-start gap-3">
								<div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold mt-0.5">
									1
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2">Clone the repository</h3>
									<div className="bg-muted rounded-lg p-4 font-mono text-sm">
										<pre>{`git clone https://github.com/evalgate/ai-evaluation-platform.git
cd ai-evaluation-platform`}</pre>
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold mt-0.5">
									2
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2">Install dependencies</h3>
									<div className="bg-muted rounded-lg p-4 font-mono text-sm">
										<code>pnpm install</code>
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold mt-0.5">
									3
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2">
										Set up environment variables
									</h3>
									<div className="bg-muted rounded-lg p-4 font-mono text-sm">
										<code>cp .env.example .env.local</code>
									</div>
									<p className="text-sm text-muted-foreground mt-2">
										Edit .env.local with your PostgreSQL, OAuth, and auth
										secrets
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold mt-0.5">
									4
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2">Set up the database</h3>
									<div className="bg-muted rounded-lg p-4 font-mono text-sm">
										<code>pnpm drizzle-kit push</code>
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold mt-0.5">
									5
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2">
										Start the development server
									</h3>
									<div className="bg-muted rounded-lg p-4 font-mono text-sm">
										<code>pnpm dev</code>
									</div>
									<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mt-2">
										<div className="flex items-center gap-2 text-green-700 dark:text-green-300">
											<CheckCircle className="h-4 w-4" />
											<span className="text-sm font-medium">
												App available at:
											</span>
										</div>
										<p className="font-mono text-sm mt-1">
											http://localhost:3000
										</p>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* Development Commands */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Development Commands</h2>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<h3 className="font-semibold flex items-center gap-2">
									<Play className="h-4 w-4" />
									Development
								</h3>
								<div className="space-y-2">
									<div className="bg-muted rounded-lg p-3 font-mono text-sm">
										<code>pnpm dev</code>
										<p className="text-xs text-muted-foreground mt-1">
											Start development server
										</p>
									</div>
									<div className="bg-muted rounded-lg p-3 font-mono text-sm">
										<code>pnpm build</code>
										<p className="text-xs text-muted-foreground mt-1">
											Production build
										</p>
									</div>
								</div>
							</div>

							<div className="space-y-2">
								<h3 className="font-semibold flex items-center gap-2">
									<CheckCircle className="h-4 w-4" />
									Testing
								</h3>
								<div className="space-y-2">
									<div className="bg-muted rounded-lg p-3 font-mono text-sm">
										<code>pnpm test</code>
										<p className="text-xs text-muted-foreground mt-1">
											Run tests
										</p>
									</div>
									<div className="bg-muted rounded-lg p-3 font-mono text-sm">
										<code>pnpm drizzle-kit push</code>
										<p className="text-xs text-muted-foreground mt-1">
											Database migrations
										</p>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* SDK Note */}
					<Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
						<h2 className="text-xl font-semibold mb-3 text-blue-700 dark:text-blue-300">
							SDK Package
						</h2>
						<p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
							The SDK package (@evalgate/sdk) is published to npm separately.
							For SDK consumers, use the standard install command rather than
							setting up the full development environment.
						</p>
						<div className="bg-muted rounded-lg p-3 font-mono text-sm">
							<code>npm install @evalgate/sdk</code>
						</div>
					</Card>

					{/* Next Steps */}
					<Card className="p-6">
						<div className="text-center">
							<h2 className="text-xl font-semibold mb-4">
								Ready to start developing?
							</h2>
							<p className="text-muted-foreground mb-6">
								Now that your environment is set up, explore these resources:
							</p>
							<div className="flex justify-center gap-4">
								<Button variant="outline" asChild>
									<Link href="/guides/architecture">
										Architecture Overview{" "}
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
