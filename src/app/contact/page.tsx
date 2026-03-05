export const dynamic = "force-static";
export const revalidate = 3600;

import { Bug, Github, GitPullRequest, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col">
			{/* Header */}
			<header className="border-b border-border">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
					<div className="flex items-center justify-between gap-3">
						<Link href="/" className="text-base sm:text-xl font-bold truncate">
							EvalGate
						</Link>
						<Button asChild size="sm" className="h-9 flex-shrink-0">
							<Link href="/dashboard">Dashboard</Link>
						</Button>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 flex-1">
				{/* Hero */}
				<div className="mb-8 sm:mb-12 text-center">
					<h1 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4">
						Get in Touch
					</h1>
					<p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
						Have a question, found a bug, or want to contribute? The best way to
						reach us is through GitHub.
					</p>
				</div>

				{/* Contact Options */}
				<section className="mb-12 sm:mb-16">
					<div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
						<a
							href="https://github.com/evalgate/ai-evaluation-platform/issues/new"
							target="_blank"
							rel="noopener noreferrer"
							className="rounded-lg border border-border bg-card p-5 sm:p-6 text-center hover:border-blue-500/40 transition-colors"
						>
							<div className="flex justify-center mb-3 sm:mb-4">
								<div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-500/10">
									<Bug className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
								</div>
							</div>
							<h3 className="font-semibold mb-2 text-sm sm:text-base">
								Report a Bug
							</h3>
							<p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
								Found an issue? Open a GitHub Issue with details and we'll look
								into it.
							</p>
							<span className="text-xs sm:text-sm text-blue-500">
								Open an Issue
							</span>
						</a>

						<a
							href="https://github.com/evalgate/ai-evaluation-platform/issues"
							target="_blank"
							rel="noopener noreferrer"
							className="rounded-lg border border-border bg-card p-5 sm:p-6 text-center hover:border-blue-500/40 transition-colors"
						>
							<div className="flex justify-center mb-3 sm:mb-4">
								<div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-500/10">
									<MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
								</div>
							</div>
							<h3 className="font-semibold mb-2 text-sm sm:text-base">
								Ask a Question
							</h3>
							<p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
								Questions about integration, the SDK, or the platform? Start a
								discussion.
							</p>
							<span className="text-xs sm:text-sm text-blue-500">
								View Issues
							</span>
						</a>

						<a
							href="https://github.com/evalgate/ai-evaluation-platform/pulls"
							target="_blank"
							rel="noopener noreferrer"
							className="rounded-lg border border-border bg-card p-5 sm:p-6 text-center hover:border-blue-500/40 transition-colors"
						>
							<div className="flex justify-center mb-3 sm:mb-4">
								<div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-500/10">
									<GitPullRequest className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
								</div>
							</div>
							<h3 className="font-semibold mb-2 text-sm sm:text-base">
								Contribute
							</h3>
							<p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
								Want to add a feature or fix a bug? Open a Pull Request on
								GitHub.
							</p>
							<span className="text-xs sm:text-sm text-blue-500">
								Open a PR
							</span>
						</a>
					</div>
				</section>

				{/* Community */}
				<section>
					<div className="rounded-lg border border-border bg-card p-6 sm:p-8 text-center">
						<h2 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3">
							Open Source
						</h2>
						<p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 max-w-2xl mx-auto px-2">
							EvalGate is open source. Star the repo, open issues, submit PRs —
							all contributions are welcome.
						</p>
						<div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
							<Button variant="outline" asChild className="w-full sm:w-auto">
								<a
									href="https://github.com/evalgate/ai-evaluation-platform"
									target="_blank"
									rel="noopener noreferrer"
								>
									<Github className="mr-2 h-4 w-4" />
									View on GitHub
								</a>
							</Button>
							<Button variant="outline" asChild className="w-full sm:w-auto">
								<Link href="/documentation">View Documentation</Link>
							</Button>
						</div>
					</div>
				</section>
			</main>

			<Footer />
		</div>
	);
}
