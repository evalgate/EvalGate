import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type React from "react";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import CustomAutumnProvider from "@/lib/autumn-provider";
import "./globals.css";
import Script from "next/script";
import { AnalyticsProvider } from "@/components/analytics-provider";
import ErrorReporter from "@/components/ErrorReporter";
import { ErrorBoundary } from "@/components/error-boundary";
import { KeyboardShortcutsHelp } from "@/components/ui/keyboard-shortcuts-help";
import { SkipToContent } from "@/components/ui/skip-to-content";
import { WebMCPProvider } from "@/components/webmcp-provider";
import VisualEditsMessenger from "../visual-edits/VisualEditsMessenger";

export const metadata: Metadata = {
	title: "EvalAI — Stop LLM Regressions in CI in 2 Minutes",
	description:
		"EvalAI is CI for AI behavior. Stop LLM regressions before they reach production. No infra. No lock-in. 1.4k+ npm downloads/month. TypeScript & Python SDKs. Integrates with LangChain, CrewAI, AutoGen.",
	generator: "EvalAI",
	keywords: [
		"ai evaluation",
		"llm observability",
		"agent tracing",
		"workflow dag",
		"cost tracking",
		"decision auditing",
		"governance",
		"evalai",
		"typescript sdk",
		"python sdk",
		"multi-agent",
		"langchain",
		"crewai",
		"autogen",
	],
	openGraph: {
		title: "EvalAI",
		description: "Stop LLM regressions in CI in 2 minutes",
		type: "website",
		url: "https://v0-ai-evaluation-platform-nu.vercel.app",
		siteName: "EvalAI",
	},
	alternates: {
		canonical: "https://v0-ai-evaluation-platform-nu.vercel.app",
	},
	icons: {
		icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
		apple: "/apple-icon",
	},
	other: {
		"llms.txt": "/llms.txt",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const appOrigin =
		process.env.NEXT_PUBLIC_SITE_URL ||
		process.env.BETTER_AUTH_BASE_URL ||
		"http://localhost:3000";

	return (
		<html
			lang="en"
			className={`${GeistSans.variable} ${GeistMono.variable}`}
			suppressHydrationWarning
			data-scroll-behavior="smooth"
		>
			<body className="antialiased font-sans">
				<SkipToContent />
				<ErrorReporter />
				<Script
					src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/scripts//route-messenger.js"
					strategy="afterInteractive"
					data-target-origin={appOrigin}
					data-message-type="ROUTE_CHANGE"
					data-include-search-params="true"
					data-only-in-iframe="true"
					data-debug="true"
					data-custom-data='{"appName": "YourApp", "version": "1.0.0", "greeting": "hi"}'
				/>
				<AnalyticsProvider>
					<Suspense fallback={null}>
						<ThemeProvider
							attribute="class"
							defaultTheme="dark"
							enableSystem
							disableTransitionOnChange
						>
							<CustomAutumnProvider>
								<ErrorBoundary>
									<main id="main-content" tabIndex={-1}>
										{children}
									</main>
								</ErrorBoundary>
							</CustomAutumnProvider>
							<Toaster />
							<KeyboardShortcutsHelp />
						</ThemeProvider>
					</Suspense>
				</AnalyticsProvider>
				<Analytics />
				<WebMCPProvider />
				<VisualEditsMessenger />
			</body>
		</html>
	);
}
