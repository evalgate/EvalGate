import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { HomeFeatures } from "@/components/home-features";
import { HomeHeader } from "@/components/home-header";
import { HomeHero } from "@/components/home-hero";
import { HomeScreenshots } from "@/components/home-screenshots";
import { InteractivePlayground } from "@/components/interactive-playground";

export const metadata: Metadata = {
	title: "EvalAI - Stop LLM Regressions in CI in 2 Minutes",
	description:
		"EvalAI is CI for AI behavior. Stop LLM regressions before they reach production. No infra. No lock-in. 1.4k+ npm downloads/month. TypeScript & Python SDKs.",
	openGraph: {
		title: "EvalAI - Stop LLM Regressions in CI in 2 Minutes",
		description:
			"EvalAI is CI for AI behavior. Stop LLM regressions before they reach production. No infra. No lock-in.",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "EvalAI - Stop LLM Regressions in CI in 2 Minutes",
		description:
			"EvalAI is CI for AI behavior. Stop LLM regressions before they reach production. No infra. No lock-in.",
	},
};

export default function HomePage() {
	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col">
			<HomeHeader />

			<main className="flex-1">
				<HomeHero />
				<HomeFeatures />
				<HomeScreenshots />

				{/* Interactive Playground Section */}
				<section
					id="playground"
					className="py-16 sm:py-20 bg-background scroll-mt-16"
				>
					<div className="container mx-auto px-4">
						<InteractivePlayground />
					</div>
				</section>
			</main>

			<Footer />
		</div>
	);
}
