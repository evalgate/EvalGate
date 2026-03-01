export const dynamic = "force-static";
export const revalidate = 3600;

import { Heart, Rocket, Users, Zap } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";

export default function CareersPage() {
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
				<div className="mb-12 sm:mb-16 text-center">
					<h1 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4">
						Join Our Team
					</h1>
					<p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto px-2">
						Help us build the future of AI quality assurance. We're looking for
						talented individuals who are passionate about making AI systems more
						reliable and trustworthy.
					</p>
				</div>

				{/* Why Join Us */}
				<section className="mb-12 sm:mb-16">
					<h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-center">
						Why Work With Us
					</h2>
					<div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
						<div className="rounded-lg border border-border bg-card p-5 sm:p-6 text-center">
							<div className="flex justify-center mb-3 sm:mb-4">
								<div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-500/10">
									<Rocket className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
								</div>
							</div>
							<h3 className="font-semibold mb-2 text-sm sm:text-base">
								Cutting-Edge Technology
							</h3>
							<p className="text-xs sm:text-sm text-muted-foreground">
								Work on challenging problems at the intersection of AI and
								software engineering.
							</p>
						</div>

						<div className="rounded-lg border border-border bg-card p-5 sm:p-6 text-center">
							<div className="flex justify-center mb-3 sm:mb-4">
								<div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-500/10">
									<Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
								</div>
							</div>
							<h3 className="font-semibold mb-2 text-sm sm:text-base">
								Talented Team
							</h3>
							<p className="text-xs sm:text-sm text-muted-foreground">
								Collaborate with experienced engineers and researchers from top
								tech companies.
							</p>
						</div>

						<div className="rounded-lg border border-border bg-card p-5 sm:p-6 text-center">
							<div className="flex justify-center mb-3 sm:mb-4">
								<div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-500/10">
									<Heart className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
								</div>
							</div>
							<h3 className="font-semibold mb-2 text-sm sm:text-base">
								Great Benefits
							</h3>
							<p className="text-xs sm:text-sm text-muted-foreground">
								Competitive compensation, equity, health insurance, and
								unlimited PTO.
							</p>
						</div>

						<div className="rounded-lg border border-border bg-card p-5 sm:p-6 text-center">
							<div className="flex justify-center mb-3 sm:mb-4">
								<div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-500/10">
									<Zap className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
								</div>
							</div>
							<h3 className="font-semibold mb-2 text-sm sm:text-base">
								Fast-Paced Growth
							</h3>
							<p className="text-xs sm:text-sm text-muted-foreground">
								Rapid career development in a high-growth startup environment.
							</p>
						</div>
					</div>
				</section>

				{/* Values */}
				<section className="mb-12 sm:mb-16">
					<h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
						Our Values
					</h2>
					<div className="rounded-lg border border-border bg-card p-5 sm:p-6 md:p-8">
						<div className="grid gap-4 sm:gap-6 md:grid-cols-2">
							<div>
								<h3 className="font-semibold mb-2 text-sm sm:text-base">
									🎯 Customer First
								</h3>
								<p className="text-xs sm:text-sm text-muted-foreground">
									We obsess over developer experience and build tools that
									engineers love to use.
								</p>
							</div>
							<div>
								<h3 className="font-semibold mb-2 text-sm sm:text-base">
									🚀 Move Fast
								</h3>
								<p className="text-xs sm:text-sm text-muted-foreground">
									Ship quickly, learn from users, and iterate. Bias towards
									action over endless planning.
								</p>
							</div>
							<div>
								<h3 className="font-semibold mb-2 text-sm sm:text-base">
									🤝 Collaborate Openly
								</h3>
								<p className="text-xs sm:text-sm text-muted-foreground">
									Share knowledge, give feedback, and help teammates succeed. No
									silos.
								</p>
							</div>
							<div>
								<h3 className="font-semibold mb-2 text-sm sm:text-base">
									💡 Think Long-Term
								</h3>
								<p className="text-xs sm:text-sm text-muted-foreground">
									Build for scale, write clean code, and make decisions that
									compound over time.
								</p>
							</div>
							<div>
								<h3 className="font-semibold mb-2 text-sm sm:text-base">
									🌍 Remote-First
								</h3>
								<p className="text-xs sm:text-sm text-muted-foreground">
									Work from unknownwhere, async communication, and flexible
									schedules.
								</p>
							</div>
							<div>
								<h3 className="font-semibold mb-2 text-sm sm:text-base">
									📚 Always Learning
								</h3>
								<p className="text-xs sm:text-sm text-muted-foreground">
									Stay curious, experiment with new tech, and share what you
									learn.
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* No Open Positions Message */}
				<section className="mb-12 sm:mb-16">
					<div className="rounded-lg border border-border bg-card p-8 sm:p-10 md:p-12 text-center">
						<div className="flex justify-center mb-4 sm:mb-6">
							<div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-muted">
								<Users className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
							</div>
						</div>
						<h2 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3">
							No Open Positions Right Now
						</h2>
						<p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 max-w-2xl mx-auto px-2">
							We don't have unknown specific roles open at the moment, but we're
							always interested in connecting with exceptional talent. If you're
							passionate about AI evaluation and believe you'd be a great
							addition to our team, we'd love to hear from you.
						</p>
						<Button asChild size="lg" className="w-full sm:w-auto">
							<Link href="/contact">Get in Touch</Link>
						</Button>
					</div>
				</section>

				{/* Benefits */}
				<section className="mb-12 sm:mb-16">
					<h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
						Benefits & Perks
					</h2>
					<div className="grid gap-3 sm:gap-4 md:grid-cols-2">
						<div className="rounded-lg border border-border bg-card p-3 sm:p-4">
							<h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">
								💰 Competitive Compensation
							</h3>
							<p className="text-xs sm:text-sm text-muted-foreground">
								Market-rate salary plus generous equity package
							</p>
						</div>
						<div className="rounded-lg border border-border bg-card p-3 sm:p-4">
							<h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">
								🏥 Health Coverage
							</h3>
							<p className="text-xs sm:text-sm text-muted-foreground">
								Comprehensive medical, dental, and vision insurance
							</p>
						</div>
						<div className="rounded-lg border border-border bg-card p-3 sm:p-4">
							<h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">
								🏖️ Unlimited PTO
							</h3>
							<p className="text-xs sm:text-sm text-muted-foreground">
								Take time off when you need it, no accrual required
							</p>
						</div>
						<div className="rounded-lg border border-border bg-card p-3 sm:p-4">
							<h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">
								💻 Equipment Budget
							</h3>
							<p className="text-xs sm:text-sm text-muted-foreground">
								Latest MacBook, monitors, and unknown tools you need
							</p>
						</div>
						<div className="rounded-lg border border-border bg-card p-3 sm:p-4">
							<h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">
								📚 Learning Budget
							</h3>
							<p className="text-xs sm:text-sm text-muted-foreground">
								Conferences, courses, books — invest in your growth
							</p>
						</div>
						<div className="rounded-lg border border-border bg-card p-3 sm:p-4">
							<h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">
								🌴 Team Retreats
							</h3>
							<p className="text-xs sm:text-sm text-muted-foreground">
								Quarterly offsites to connect and collaborate in person
							</p>
						</div>
					</div>
				</section>
			</main>

			<Footer />
		</div>
	);
}
