import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import {
	PricingOverageInfo,
	PricingRateLimits,
	StaticPricingCards,
} from "@/components/static-pricing-cards";
import { PricingHeader } from "./pricing-header";

export const metadata: Metadata = {
	title: "Pricing - EvalGate",
	description:
		"Start with our free Developer plan or upgrade for more traces, projects, and premium support. Transparent pricing with no hidden fees.",
	openGraph: {
		title: "Pricing - EvalGate",
		description:
			"Start with our free Developer plan or upgrade for more traces, projects, and premium support.",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Pricing - EvalGate",
		description:
			"Start with our free Developer plan or upgrade for more traces, projects, and premium support.",
	},
};

export default function PricingPage() {
	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col">
			{/* Header */}
			<PricingHeader />

			{/* Main Content */}
			<main className="mx-auto max-w-7xl px-4 sm:px-6 flex-1 py-8 sm:py-12 md:py-16">
				<div className="text-center mb-8 sm:mb-12">
					<h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 sm:mb-4">
						Choose Your Plan
					</h1>
					<p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
						Start with our free Developer plan or upgrade for more traces,
						projects, and premium support.
					</p>
				</div>

				{/* Static Pricing Cards */}
				<StaticPricingCards />

				{/* Overage Info */}
				<PricingOverageInfo />

				{/* Rate Limits */}
				<PricingRateLimits />
			</main>

			{/* Footer */}
			<Footer />
		</div>
	);
}
