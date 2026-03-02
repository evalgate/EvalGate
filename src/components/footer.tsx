import Image from "next/image";
import Link from "next/link";

export function Footer() {
	return (
		<footer className="border-t border-border py-8 sm:py-12">
			<div className="mx-auto max-w-7xl px-4 sm:px-6">
				<div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
					<div>
						<h3 className="mb-3 text-sm font-semibold">Product</h3>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li>
								<Link href="/evaluations" className="hover:text-foreground">
									Evaluations
								</Link>
							</li>
							<li>
								<Link href="/traces" className="hover:text-foreground">
									Traces
								</Link>
							</li>
							<li>
								<Link href="/llm-judge" className="hover:text-foreground">
									LLM Judge
								</Link>
							</li>
							<li>
								<Link href="/changelog" className="hover:text-foreground">
									Changelog
								</Link>
							</li>
							<li>
								<Link href="/pricing" className="hover:text-foreground">
									Pricing
								</Link>
							</li>
						</ul>
					</div>
					<div>
						<h3 className="mb-3 text-sm font-semibold">Developers</h3>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li>
								<Link href="/sdk" className="hover:text-foreground">
									SDK
								</Link>
							</li>
							<li>
								<Link href="/api-reference" className="hover:text-foreground">
									API Reference
								</Link>
							</li>
							<li>
								<Link href="/documentation" className="hover:text-foreground">
									Documentation
								</Link>
							</li>
							<li>
								<Link href="/guides" className="hover:text-foreground">
									Guides
								</Link>
							</li>
							<li>
								<a
									href="https://github.com/pauly7610/ai-evaluation-platform"
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-foreground"
								>
									GitHub
								</a>
							</li>
						</ul>
					</div>
					<div>
						<h3 className="mb-3 text-sm font-semibold">Community</h3>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li>
								<a
									href="https://github.com/pauly7610/ai-evaluation-platform/issues"
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-foreground"
								>
									Report an Issue
								</a>
							</li>
							<li>
								<a
									href="https://github.com/pauly7610/ai-evaluation-platform/pulls"
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-foreground"
								>
									Open a PR
								</a>
							</li>
							<li>
								<Link href="/about" className="hover:text-foreground">
									About
								</Link>
							</li>
						</ul>
					</div>
					<div>
						<h3 className="mb-3 text-sm font-semibold">Legal</h3>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li>
								<Link href="/privacy" className="hover:text-foreground">
									Privacy
								</Link>
							</li>
							<li>
								<Link href="/terms" className="hover:text-foreground">
									Terms
								</Link>
							</li>
							<li>
								<Link href="/security" className="hover:text-foreground">
									Security
								</Link>
							</li>
						</ul>
					</div>
				</div>
				<div className="mt-8 sm:mt-12 border-t border-border pt-8">
					<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
						<p className="text-sm text-muted-foreground">
							© {new Date().getFullYear()} EvalGate. All rights reserved.
						</p>
						<div className="flex gap-2 items-center">
							<a
								href="https://www.npmjs.com/package/@evalgate/sdk"
								target="_blank"
								rel="noopener noreferrer"
								className="opacity-70 hover:opacity-100 transition-opacity"
							>
								<Image
									src="https://img.shields.io/npm/v/@evalgate/sdk.svg"
									alt="npm version"
									width={20}
									height={20}
									className="h-5"
								/>
							</a>
							<a
								href="https://www.npmjs.com/package/@evalgate/sdk"
								target="_blank"
								rel="noopener noreferrer"
								className="opacity-70 hover:opacity-100 transition-opacity"
							>
								<Image
									src="https://img.shields.io/npm/dm/@evalgate/sdk.svg"
									alt="npm downloads"
									width={20}
									height={20}
									className="h-5"
								/>
							</a>
							<a
								href="https://pypi.org/project/pauly4010-evalgate-sdk/"
								target="_blank"
								rel="noopener noreferrer"
								className="opacity-70 hover:opacity-100 transition-opacity"
							>
								<Image
									src="https://img.shields.io/pypi/v/pauly4010-evalgate-sdk.svg"
									alt="PyPI version"
									width={20}
									height={20}
									className="h-5"
								/>
							</a>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
