export const dynamic = "force-static";
export const revalidate = 3600;

import Link from "next/link";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col">
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

			<main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 flex-1">
				<div className="mb-8 sm:mb-12">
					<h1 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4">
						Terms of Service
					</h1>
					<p className="text-sm sm:text-base text-muted-foreground">
						Last updated: March 1, 2025
					</p>
				</div>

				<div className="prose prose-neutral dark:prose-invert max-w-none">
					<section className="mb-8 sm:mb-12">
						<h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
							Agreement to Terms
						</h2>
						<p className="text-muted-foreground mb-4">
							By accessing or using EvalGate ("we," "our," or "us") at{" "}
							<a
								href="https://evalgate.com"
								className="text-primary hover:underline"
							>
								https://evalgate.com
							</a>
							, you agree to be bound by these Terms of Service. If you do not
							agree, do not use our services.
						</p>
					</section>

					<section className="mb-8 sm:mb-12">
						<h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
							Description of Service
						</h2>
						<p className="text-muted-foreground mb-4">
							EvalGate provides evaluation infrastructure for AI systems:
							tracing, testing, and judging LLM calls. We offer a web platform,
							TypeScript SDK (@evalgate/sdk), Python SDK
							(pauly4010-evalgate-sdk), CLI tools, and API access. Services are
							provided as-is and may change over time.
						</p>
					</section>

					<section className="mb-8 sm:mb-12">
						<h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
							Acceptable Use
						</h2>
						<p className="text-muted-foreground mb-4">You agree not to:</p>
						<ul className="list-disc pl-6 text-muted-foreground space-y-2">
							<li>Violate any applicable laws or regulations</li>
							<li>Infringe on intellectual property or privacy rights</li>
							<li>Transmit malware, spam, or harmful content</li>
							<li>
								Attempt to gain unauthorized access to our systems or data
							</li>
							<li>Abuse rate limits or overload our infrastructure</li>
							<li>Use the service for illegal or harmful purposes</li>
						</ul>
					</section>

					<section className="mb-8 sm:mb-12">
						<h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
							Account and API Keys
						</h2>
						<p className="text-muted-foreground mb-4">
							You are responsible for maintaining the confidentiality of your
							account credentials and API keys. Do not share API keys or commit
							them to version control. We may suspend or terminate accounts that
							violate these terms.
						</p>
					</section>

					<section className="mb-8 sm:mb-12">
						<h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
							Data and Privacy
						</h2>
						<p className="text-muted-foreground mb-4">
							Your use of EvalGate is also governed by our{" "}
							<Link href="/privacy" className="text-primary hover:underline">
								Privacy Policy
							</Link>
							. By using our services, you consent to the collection and use of
							information as described therein.
						</p>
					</section>

					<section className="mb-8 sm:mb-12">
						<h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
							Intellectual Property
						</h2>
						<p className="text-muted-foreground mb-4">
							EvalGate and its SDKs are provided under the MIT License. You
							retain ownership of your data and content. We do not claim rights
							to your evaluation inputs, outputs, or test cases.
						</p>
					</section>

					<section className="mb-8 sm:mb-12">
						<h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
							Disclaimer of Warranties
						</h2>
						<p className="text-muted-foreground mb-4">
							The service is provided "as is" and "as available" without
							warranties of any kind. We do not guarantee uninterrupted access,
							accuracy of evaluations, or fitness for a particular purpose.
						</p>
					</section>

					<section className="mb-8 sm:mb-12">
						<h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
							Limitation of Liability
						</h2>
						<p className="text-muted-foreground mb-4">
							To the maximum extent permitted by law, EvalGate shall not be
							liable for any indirect, incidental, special, consequential, or
							punitive damages arising from your use of the service.
						</p>
					</section>

					<section className="mb-8 sm:mb-12">
						<h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
							Changes
						</h2>
						<p className="text-muted-foreground mb-4">
							We may update these terms from time to time. Material changes will
							be posted on this page with an updated date. Continued use after
							changes constitutes acceptance.
						</p>
					</section>

					<section className="mb-8 sm:mb-12">
						<h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
							Contact
						</h2>
						<p className="text-muted-foreground mb-4">
							Questions about these terms? Open an issue at{" "}
							<a
								href="https://github.com/evalgate/ai-evaluation-platform/issues"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline"
							>
								GitHub Issues
							</a>
							.
						</p>
					</section>
				</div>
			</main>

			<Footer />
		</div>
	);
}
