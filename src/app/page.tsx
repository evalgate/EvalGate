import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { HomeFeatures } from "@/components/home-features";
import { HomeHeader } from "@/components/home-header";
import { HomeHero } from "@/components/home-hero";
import { InteractivePlayground } from "@/components/interactive-playground";

export const metadata: Metadata = {
  title: "AI Evaluation Platform - Build Confidence in Your AI Systems",
  description:
    "Comprehensive evaluation platform for testing, monitoring, and improving LLM applications. From unit tests to human feedback loops. Try demos instantly—no signup required.",
  openGraph: {
    title: "AI Evaluation Platform - Build Confidence in Your AI Systems",
    description:
      "Comprehensive evaluation platform for testing, monitoring, and improving LLM applications.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Evaluation Platform - Build Confidence in Your AI Systems",
    description:
      "Comprehensive evaluation platform for testing, monitoring, and improving LLM applications.",
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <HomeHeader />

      <main className="flex-1">
        <HomeHero />
        <HomeFeatures />

        {/* Interactive Playground Section */}
        <section id="playground" className="py-16 sm:py-20 bg-background scroll-mt-16">
          <div className="container mx-auto px-4">
            <InteractivePlayground />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
